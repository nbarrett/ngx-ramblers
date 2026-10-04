import { OsMapsListedRoute, RouteWalkReference, osMapsRouteIdFromUrl } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { AppPath, followRouteIdFromQuery } from "../../../projects/ngx-ramblers/src/app/models/route-follow.model";
import { StoredValue } from "../../../projects/ngx-ramblers/src/app/models/ui-actions";
import { eventSlug } from "../../../projects/ngx-ramblers/src/app/functions/walks/event-slug";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import * as mongooseClient from "../mongo/mongoose-client";

export function walkReferencesRoute(walk: ExtendedGroupEvent, route: OsMapsListedRoute): boolean {
  const sameFile = !!route.gpxFile?.awsFileName && walk.fields?.gpxFile?.awsFileName === route.gpxFile.awsFileName;
  const sameLink = (walk.fields?.links || []).some(link => {
    try {
      const url = new URL(link.href || "", "https://group.example.org.uk");
      const segments = url.pathname.split("/").filter(Boolean);
      const internalRoute = segments[0] === AppPath.ROOT
        && (segments[1] === AppPath.ROUTE || segments[1] === AppPath.LEGACY_FOLLOW);
      const legacyRouteId = followRouteIdFromQuery(url.searchParams.get(StoredValue.ROUTE));
      return osMapsRouteIdFromUrl(url.href) === route.id
        || (internalRoute && !!route.number && segments[2] === String(route.number))
        || (internalRoute && url.searchParams.get(StoredValue.OS_MAPS_ROUTE_ID) === route.id)
        || (internalRoute && (legacyRouteId === route.id || (!!route.number && legacyRouteId === String(route.number))));
    } catch {
      return false;
    }
  });
  return sameFile || sameLink;
}

export function withRouteWalks(routes: OsMapsListedRoute[], walks: ExtendedGroupEvent[]): OsMapsListedRoute[] {
  return routes.map(route => ({
    ...route,
    walks: walks.filter(walk => walkReferencesRoute(walk, route)).map(walk => ({
      id: walk.id,
      slug: eventSlug(walk),
      title: walk.groupEvent?.title || "Untitled walk",
      startDateTime: walk.groupEvent?.start_date_time || ""
    } satisfies RouteWalkReference))
  }));
}

export async function routesWithWalkReferences(routes: OsMapsListedRoute[]): Promise<OsMapsListedRoute[]> {
  if (routes.length === 0) {
    return [];
  } else {
    const fileNames = routes.map(route => route.gpxFile?.awsFileName).filter(Boolean);
    const walks = await mongooseClient.execute(() => extendedGroupEvent.find({$or: [
      {"fields.gpxFile.awsFileName": {$in: fileNames}},
      {"fields.links.href": {$exists: true}}
    ]}).select("groupEvent.id groupEvent.url groupEvent.title groupEvent.start_date_time fields.gpxFile.awsFileName fields.links.href").lean());
    return withRouteWalks(routes, walks.map(walk => ({...walk, id: String(walk._id)})));
  }
}
