import { OsMapsListedRoute, RouteWalkReference, osMapsRouteIdFromUrl } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { AppPath, followRouteIdFromQuery } from "../../../projects/ngx-ramblers/src/app/models/route-follow.model";
import { StoredValue } from "../../../projects/ngx-ramblers/src/app/models/ui-actions";
import { eventSlug } from "../../../projects/ngx-ramblers/src/app/functions/walks/event-slug";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import * as mongooseClient from "../mongo/mongoose-client";

type WalkLinkKeys = {
  fileName: string | null;
  routeIds: string[];
  numbers: string[];
};

function walkLinkKeys(walk: ExtendedGroupEvent): WalkLinkKeys {
  const routeIds: string[] = [];
  const numbers: string[] = [];
  (walk.fields?.links || []).forEach(link => {
    try {
      const url = new URL(link.href || "", "https://group.example.org.uk");
      const segments = url.pathname.split("/").filter(Boolean);
      const internalRoute = segments[0] === AppPath.ROOT
        && (segments[1] === AppPath.ROUTE || segments[1] === AppPath.LEGACY_FOLLOW);
      const osId = osMapsRouteIdFromUrl(url.href);
      if (osId) {
        routeIds.push(osId);
      }
      if (internalRoute && segments[2]) {
        numbers.push(segments[2]);
      }
      const queryId = url.searchParams.get(StoredValue.OS_MAPS_ROUTE_ID);
      if (queryId) {
        routeIds.push(queryId);
      }
      const legacyRouteId = followRouteIdFromQuery(url.searchParams.get(StoredValue.ROUTE));
      if (legacyRouteId) {
        routeIds.push(legacyRouteId);
        numbers.push(legacyRouteId);
      }
    } catch {
      return;
    }
  });
  return {fileName: walk.fields?.gpxFile?.awsFileName || null, routeIds, numbers};
}

export function walkReferencesRoute(walk: ExtendedGroupEvent, route: OsMapsListedRoute): boolean {
  const keys = walkLinkKeys(walk);
  const sameFile = !!route.gpxFile?.awsFileName && keys.fileName === route.gpxFile.awsFileName;
  const sameId = keys.routeIds.includes(route.id);
  const sameNumber = !!route.number && keys.numbers.includes(String(route.number));
  return sameFile || sameId || sameNumber;
}

function addWalk(index: Map<string, ExtendedGroupEvent[]>, key: string | null, walk: ExtendedGroupEvent): void {
  if (key) {
    const existing = index.get(key);
    if (existing) {
      if (!existing.includes(walk)) {
        existing.push(walk);
      }
    } else {
      index.set(key, [walk]);
    }
  }
}

function collectWalks(index: Map<string, ExtendedGroupEvent[]>, key: string | null, found: ExtendedGroupEvent[]): void {
  if (key) {
    (index.get(key) || []).forEach(walk => {
      if (!found.includes(walk)) {
        found.push(walk);
      }
    });
  }
}

export function withRouteWalks(routes: OsMapsListedRoute[], walks: ExtendedGroupEvent[]): OsMapsListedRoute[] {
  const byFile = new Map<string, ExtendedGroupEvent[]>();
  const byRouteId = new Map<string, ExtendedGroupEvent[]>();
  const byNumber = new Map<string, ExtendedGroupEvent[]>();
  walks.forEach(walk => {
    const keys = walkLinkKeys(walk);
    addWalk(byFile, keys.fileName, walk);
    keys.routeIds.forEach(id => addWalk(byRouteId, id, walk));
    keys.numbers.forEach(number => addWalk(byNumber, number, walk));
  });
  return routes.map(route => {
    const found: ExtendedGroupEvent[] = [];
    collectWalks(byFile, route.gpxFile?.awsFileName || null, found);
    collectWalks(byRouteId, route.id, found);
    collectWalks(byNumber, route.number ? String(route.number) : null, found);
    return {
      ...route,
      walks: found.map(walk => ({
        id: walk.id,
        slug: eventSlug(walk),
        title: walk.groupEvent?.title || "Untitled walk",
        startDateTime: walk.groupEvent?.start_date_time || ""
      } satisfies RouteWalkReference))
    };
  });
}

export async function routesWithWalkReferences(routes: OsMapsListedRoute[]): Promise<OsMapsListedRoute[]> {
  if (routes.length === 0) {
    return [];
  } else {
    const fileNames = routes.map(route => route.gpxFile?.awsFileName).filter(Boolean);
    const walks = await mongooseClient.execute(() => extendedGroupEvent.find({$or: [
      ...(fileNames.length > 0 ? [{"fields.gpxFile.awsFileName": {$in: fileNames}}] : []),
      {"fields.links.href": /explore\.osmaps\.com\/route\//},
      {"fields.links.href": /\/app\/(route|follow)/}
    ]}).select("groupEvent.id groupEvent.url groupEvent.title groupEvent.start_date_time fields.gpxFile.awsFileName fields.links.href").lean());
    return withRouteWalks(routes, walks.map(walk => ({...walk, id: String(walk._id)})));
  }
}
