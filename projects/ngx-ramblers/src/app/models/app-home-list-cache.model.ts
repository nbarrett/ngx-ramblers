import { ExtendedGroupEvent } from "./group-event.model";
import { OsMapsListedRoute } from "./os-maps-export.model";
import { RouteFollowOfflineStatus, RouteFollowPoint, RouteFollowSummary } from "./route-follow.model";

export interface AppHomeListSnapshot {
  routes: RouteFollowSummary[];
  walks: ExtendedGroupEvent[];
  websiteMapKeys: string[];
  importedOsMapsByKey: Record<string, OsMapsListedRoute>;
  previewPoints: Record<string, RouteFollowPoint[]>;
  offlineByKey: Record<string, RouteFollowOfflineStatus>;
}

