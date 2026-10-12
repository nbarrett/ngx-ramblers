import { MemberLoginService } from "../member/member-login.service";
import { inject, Injectable } from "@angular/core";
import { AppHomeListSnapshot } from "../../models/app-home-list-cache.model";
import { nativeWalkingStorageKey } from "../../functions/native-walking";
import { StoredValue } from "../../models/ui-actions";

@Injectable({
  providedIn: "root"
})
export class AppHomeListCacheService {
  private memberLogin = inject(MemberLoginService);
  private memoryStorageKey: string | null = null;
  private memoryMemberId: string | null = null;
  private memory: AppHomeListSnapshot | null = null;

  snapshot(): AppHomeListSnapshot | null {
    if (this.memory && this.memoryStorageKey === nativeWalkingStorageKey(StoredValue.APP_HOME_LIST_CACHE) && this.memoryMemberId === (this.memberLogin.loggedInMember()?.memberId || null)) {
      return this.memory;
    } else {
      return this.readStored();
    }
  }

  save(snapshot: AppHomeListSnapshot): void {
    this.memoryStorageKey = nativeWalkingStorageKey(StoredValue.APP_HOME_LIST_CACHE);
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
      window.sessionStorage.setItem(this.memoryStorageKey, JSON.stringify(stored));
    } catch {
      this.memory = snapshot;
    }
  }

  private readStored(): AppHomeListSnapshot | null {
    try {
      const raw = window.sessionStorage.getItem(nativeWalkingStorageKey(StoredValue.APP_HOME_LIST_CACHE));
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
