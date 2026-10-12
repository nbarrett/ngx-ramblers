import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { nativeWalkingSite } from "../../functions/native-walking";
import { routeVisibleToMember } from "../../functions/route-access";
import { LegacyWalkingRecoveryState } from "../../models/legacy-walking-recovery.model";
import { followCacheKey, isLiveFollowMode, RouteFollowSession } from "../../models/route-follow.model";
import { StoredValue } from "../../models/ui-actions";
import { LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { UiActionsService } from "../ui-actions.service";
import { RouteFollowCacheService } from "./route-follow-cache.service";

@Injectable({providedIn: "root"})
export class LegacyWalkingRecoveryService {
  private cache = inject(RouteFollowCacheService);
  private uiActions = inject(UiActionsService);
  private memberLogin = inject(MemberLoginService);
  private logger = inject(LoggerFactory).createLogger("LegacyWalkingRecoveryService", NgxLoggerLevel.ERROR);

  async available(): Promise<LegacyWalkingRecoveryState> {
    if (nativeWalkingSite()) {
      const assigned = this.assignments();
      const session = this.legacySession();
      const routes = (await this.cache.legacyRoutes()).filter(route => !assigned[`route:${route.key}`]);
      const recoverableSession = session && !assigned[this.sessionKey(session)] && !this.uiActions.itemExistsFor(StoredValue.FOLLOW_SESSION) ? session : null;
      return {routes, session: recoverableSession};
    } else {
      return {routes: [], session: null};
    }
  }

  async restore(keys: string[], includeSession: boolean): Promise<void> {
    const site = nativeWalkingSite();
    if (!site) {
      throw new Error("Choose the website that owns the saved data before restoring it.");
    } else {
      const available = await this.available();
      const selectedKeys = keys.filter(key => available.routes.some(route => route.key === key));
      const restored = await this.cache.restoreLegacyRoutes(selectedKeys, site);
      const assigned = restored.reduce((current, key) => ({...current, [`route:${key}`]: site}), this.assignments());
      if (nativeWalkingSite() !== site) {
        throw new Error("The selected website changed during recovery. Try again on the correct site.");
      } else {
        if (includeSession && available.session) {
          if (this.uiActions.itemExistsFor(StoredValue.FOLLOW_SESSION)) {
            throw new Error("Finish the current walking session before restoring another recording.");
          } else if (!this.uiActions.saveValueFor(StoredValue.FOLLOW_SESSION, available.session)) {
            throw new Error("The unfinished recording could not be restored. The original is still on this device.");
          } else {
            assigned[this.sessionKey(available.session)] = site;
          }
        }
        if (!this.uiActions.saveValueFor(StoredValue.APP_LEGACY_RECOVERY, assigned)) {
          throw new Error("The recovered data was saved, but its website assignment could not be stored. The originals are still on this device.");
        }
      }
    }
  }

  private assignments(): Record<string, string> {
    return this.uiActions.initialObjectValueFor<Record<string, string>>(StoredValue.APP_LEGACY_RECOVERY, {}) || {};
  }

  private sessionKey(session: RouteFollowSession): string {
    return `session:${followCacheKey(session)}`;
  }

  private legacySession(): RouteFollowSession | null {
    try {
      const raw = window.localStorage.getItem(StoredValue.FOLLOW_SESSION);
      const session = raw ? JSON.parse(raw) as RouteFollowSession : null;
      const visible = !session?.payload || routeVisibleToMember(session.payload, this.memberLogin.loggedInMember());
      return session && visible && isLiveFollowMode(session.mode) && followCacheKey(session) ? session : null;
    } catch (error) {
      this.logger.warn("Earlier walking session could not be read", error);
      return null;
    }
  }
}
