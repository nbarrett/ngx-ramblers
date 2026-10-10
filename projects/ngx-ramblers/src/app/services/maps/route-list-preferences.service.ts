import { inject, Injectable, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { StoredValue } from "../../models/ui-actions";
import { CachedMemberRoutePreferences, MemberRoutePreferences, RoutePreferenceAction, RoutePreferenceChange } from "../../models/member.model";
import { NamedEventType } from "../../models/broadcast.model";
import { nativeWalkingSite } from "../../functions/native-walking";
import { routePreferencesAfterChange } from "../../functions/route-preferences";
import { UiActionsService } from "../ui-actions.service";
import { MemberService } from "../member/member.service";
import { MemberLoginService } from "../member/member-login.service";
import { BroadcastService } from "../broadcast-service";
import { LoggerFactory } from "../logger-factory.service";
import { StringUtilsService } from "../string-utils.service";

@Injectable({providedIn: "root"})
export class RouteListPreferencesService implements OnDestroy {
  private uiActions = inject(UiActionsService);
  private members = inject(MemberService);
  private memberLogin = inject(MemberLoginService);
  private broadcast = inject(BroadcastService);
  private stringUtils = inject(StringUtilsService);
  private logger = inject(LoggerFactory).createLogger("RouteListPreferencesService", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];
  private preferences = this.anonymousPreferences();
  private pending: RoutePreferenceChange[] = [];
  private accountKey: string | null = null;
  private generation = 0;
  private operations = Promise.resolve();
  private cacheSaved = true;
  private online = () => void this.refresh();
  syncMessage: string | null = null;

  constructor() {
    this.subscriptions.push(this.broadcast.on(NamedEventType.MEMBER_LOGIN_COMPLETE, () => void this.refresh()));
    this.subscriptions.push(this.broadcast.on(NamedEventType.MEMBER_LOGOUT_COMPLETE, () => void this.refresh()));
    window.addEventListener("online", this.online);
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    window.removeEventListener("online", this.online);
  }

  favouriteKeys(): string[] {
    this.selectAccount();
    return this.preferences.favouriteKeys;
  }

  hiddenKeys(): string[] {
    this.selectAccount();
    return this.preferences.hiddenKeys;
  }

  hiddenCount(): number {
    return this.hiddenKeys().length;
  }

  hiddenMapsActionLabel(): string {
    return `Show ${this.stringUtils.pluraliseWithCount(this.hiddenCount(), "hidden map")}`;
  }

  isFavourite(key: string | null): boolean {
    return !!key && this.favouriteKeys().includes(key);
  }

  isHidden(key: string | null): boolean {
    return !!key && this.hiddenKeys().includes(key);
  }

  toggleFavourite(key: string | null): void {
    if (key) {
      this.change({action: this.isFavourite(key) ? RoutePreferenceAction.UNFAVOURITE : RoutePreferenceAction.FAVOURITE, key});
    }
  }

  unfavourite(key: string | null): void {
    if (key) {
      this.change({action: RoutePreferenceAction.UNFAVOURITE, key});
    }
  }

  hide(key: string | null): void {
    if (key && !this.isHidden(key)) {
      this.change({action: RoutePreferenceAction.HIDE, key});
    }
  }

  showHidden(): void {
    this.change({action: RoutePreferenceAction.SHOW_ALL, key: null});
  }

  refresh(): Promise<void> {
    this.selectAccount();
    return this.queue(true);
  }

  private anonymousPreferences(): MemberRoutePreferences {
    return {favouriteKeys: this.uiActions.initialObjectValueFor<string[]>(StoredValue.APP_FAVOURITE_ROUTES, []) || [],
      hiddenKeys: this.uiActions.initialObjectValueFor<string[]>(StoredValue.APP_HIDDEN_ROUTES, []) || []};
  }

  private selectAccount(): void {
    const memberId = this.memberLogin.loggedInMember()?.memberId || null;
    const accountKey = memberId ? `${nativeWalkingSite() || window.location.origin}:${memberId}` : null;
    if (accountKey !== this.accountKey) {
      this.generation++;
      this.accountKey = accountKey;
      const cache = this.uiActions.initialObjectValueFor<Record<string, CachedMemberRoutePreferences>>(StoredValue.APP_ROUTE_PREFERENCES, {}) || {};
      this.preferences = accountKey ? cache[accountKey]?.preferences || {favouriteKeys: [], hiddenKeys: []} : this.anonymousPreferences();
      this.pending = accountKey ? cache[accountKey]?.pending || [] : [];
      this.syncMessage = null;
    }
  }

  private change(change: RoutePreferenceChange): void {
    this.selectAccount();
    this.preferences = routePreferencesAfterChange(this.preferences, change);
    if (this.accountKey) {
      this.pending = [...this.pending, change];
      this.saveMemberCache();
      void this.queue(false);
    } else {
      const favouritesSaved = this.uiActions.saveValueFor(StoredValue.APP_FAVOURITE_ROUTES, this.preferences.favouriteKeys);
      const hiddenSaved = this.uiActions.saveValueFor(StoredValue.APP_HIDDEN_ROUTES, this.preferences.hiddenKeys);
      this.syncMessage = favouritesSaved && hiddenSaved ? null : "Preferences could not be saved on this device.";
    }
  }

  private saveMemberCache(): void {
    if (this.accountKey) {
      const cache = this.uiActions.initialObjectValueFor<Record<string, CachedMemberRoutePreferences>>(StoredValue.APP_ROUTE_PREFERENCES, {}) || {};
      this.cacheSaved = this.uiActions.saveValueFor(StoredValue.APP_ROUTE_PREFERENCES,
        {...cache, [this.accountKey]: {preferences: this.preferences, pending: this.pending}});
    }
  }

  private currentAccount(accountKey: string, generation: number): boolean {
    this.selectAccount();
    return accountKey === this.accountKey && generation === this.generation;
  }

  private queue(readProfile: boolean): Promise<void> {
    const accountKey = this.accountKey;
    const generation = this.generation;
    this.operations = this.operations.then(async () => {
      if (accountKey && this.currentAccount(accountKey, generation)) {
        if (nativeWalkingSite()) {
          this.syncMessage = this.cacheSaved ? null : "Map preferences could not be saved on this device.";
        } else if (navigator.onLine) {
          if (readProfile) {
            const saved = await this.members.routePreferences();
            if (this.currentAccount(accountKey, generation)) {
              this.preferences = this.pending.reduce(routePreferencesAfterChange, saved);
              this.saveMemberCache();
            }
          }
          for (const change of [...this.pending]) {
            if (this.currentAccount(accountKey, generation)) {
              const saved = await this.members.changeRoutePreference(change);
              if (this.currentAccount(accountKey, generation)) {
                this.pending = this.pending.slice(1);
                this.preferences = this.pending.reduce(routePreferencesAfterChange, saved);
                this.saveMemberCache();
              }
            }
          }
          if (this.currentAccount(accountKey, generation)) {
            this.syncMessage = null;
          }
        } else {
          this.syncMessage = "Saved on this device. Your profile will sync when you reconnect.";
        }
      }
    }).catch(error => {
      this.logger.error("Route preference sync failed", error);
      if (accountKey && this.currentAccount(accountKey, generation)) {
        this.syncMessage = this.cacheSaved ? "Saved on this device. Profile sync failed; your internet connection may still be working." : "Preferences are kept for this session. Profile sync is pending.";
      }
    });
    return this.operations;
  }
}
