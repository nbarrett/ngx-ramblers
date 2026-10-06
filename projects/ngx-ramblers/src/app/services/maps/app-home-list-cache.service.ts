import { MemberLoginService } from "../member/member-login.service";
import { inject, Injectable } from "@angular/core";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { OsMapsListedRoute } from "../../models/os-maps-export.model";
import { RouteFollowOfflineStatus, RouteFollowPoint, RouteFollowSummary } from "../../models/route-follow.model";
import { StoredValue } from "../../models/ui-actions";

export interface AppHomeListSnapshot {
  routes: RouteFollowSummary[];
  walks: ExtendedGroupEvent[];
  websiteMapKeys: string[];
  importedOsMapsByKey: Record<string, OsMapsListedRoute>;
  previewPoints: Record<string, RouteFollowPoint[]>;
  offlineByKey: Record<string, RouteFollowOfflineStatus>;
}

@Injectable({
  providedIn: "root"
})
export class AppHomeListCacheService {
  private memberLogin = inject(MemberLoginService);
  private memoryMemberId: string | null = null;
  private memory: AppHomeListSnapshot | null = null;

  snapshot(): AppHomeListSnapshot | null {
    if (this.memory && this.memoryMemberId === (this.memberLogin.loggedInMember()?.memberId || null)) {
      return this.memory;
    } else {
      return this.readStored();
    }
  }

  save(snapshot: AppHomeListSnapshot): void {
    this.memoryMemberId = this.memberLogin.loggedInMember()?.memberId || null;
    this.memory = snapshot;
    try {
      const stored = {
        memberId: this.memoryMemberId,
        routes: snapshot.routes,
        walks: snapshot.walks,
        websiteMapKeys: snapshot.websiteMapKeys,
        importedOsMapsByKey: snapshot.importedOsMapsByKey,
        previewPoints: snapshot.previewPoints
      };
      window.sessionStorage.setItem(StoredValue.APP_HOME_LIST_CACHE, JSON.stringify(stored));
    } catch {
      this.memory = snapshot;
    }
  }

  private readStored(): AppHomeListSnapshot | null {
    try {
      const raw = window.sessionStorage.getItem(StoredValue.APP_HOME_LIST_CACHE);
      if (!raw) {
        return null;
      } else {
        const parsed = JSON.parse(raw);
        return (parsed.memberId || null) === (this.memberLogin.loggedInMember()?.memberId || null) ? {
          routes: parsed?.routes || [],
          walks: parsed?.walks || [],
          websiteMapKeys: parsed?.websiteMapKeys || [],
          importedOsMapsByKey: parsed?.importedOsMapsByKey || {},
          previewPoints: parsed?.previewPoints || {},
          offlineByKey: {}
        } : null;
      }
    } catch {
      return null;
    }
  }
}
