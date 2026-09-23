import { Injectable } from "@angular/core";
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
  private memory: AppHomeListSnapshot | null = null;

  snapshot(): AppHomeListSnapshot | null {
    if (this.memory) {
      return this.memory;
    } else {
      return this.readStored();
    }
  }

  save(snapshot: AppHomeListSnapshot): void {
    this.memory = snapshot;
    try {
      const stored = {
        routes: snapshot.routes,
        walks: snapshot.walks,
        websiteMapKeys: snapshot.websiteMapKeys,
        importedOsMapsByKey: snapshot.importedOsMapsByKey
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
        return {
          routes: parsed?.routes || [],
          walks: parsed?.walks || [],
          websiteMapKeys: parsed?.websiteMapKeys || [],
          importedOsMapsByKey: parsed?.importedOsMapsByKey || {},
          previewPoints: {},
          offlineByKey: {}
        };
      }
    } catch {
      return null;
    }
  }
}
