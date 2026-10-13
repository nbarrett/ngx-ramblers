import { isNumber } from "es-toolkit/compat";
import { OsMapsListedRoute, OsMapsRouteListFilter, OS_MAPS_ROUTE_PAGE_SIZE, osMapsRouteUserNames, osMapsRouteVisible } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { followCacheKey } from "../../../projects/ngx-ramblers/src/app/models/route-follow.model";
import { SortDirection } from "../../../projects/ngx-ramblers/src/app/models/sort.model";

const METRES_PER_MILE = 1609.344;
const EARTH_RADIUS_METRES = 6371000;

export interface OsMapsListingPageQuery {
  search: string;
  filter: OsMapsRouteListFilter;
  user: string;
  sortKey: string;
  sortDirection: string;
  nearbyOnly: boolean;
  nearbyMiles: number;
  latitude: number | null;
  longitude: number | null;
  favouriteKeys: string[];
  hiddenKeys: string[];
  favouritesOnly: boolean;
  limit: number;
}

function routeKey(route: OsMapsListedRoute): string | null {
  return followCacheKey({osMapsRouteId: route.id});
}

function startPoint(route: OsMapsListedRoute): {latitude: number; longitude: number} | null {
  const latitude = route.gpxFile?.startLat;
  const longitude = route.gpxFile?.startLng;
  if (isNumber(latitude) && isNumber(longitude) && (latitude !== 0 || longitude !== 0)) {
    return {latitude, longitude};
  } else {
    return null;
  }
}

function milesBetween(from: {latitude: number; longitude: number}, to: {latitude: number; longitude: number}): number {
  const fromLat = from.latitude * Math.PI / 180;
  const toLat = to.latitude * Math.PI / 180;
  const deltaLat = (to.latitude - from.latitude) * Math.PI / 180;
  const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;
  const haversine = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return (EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))) / METRES_PER_MILE;
}

function compareBySortKey(first: OsMapsListedRoute, second: OsMapsListedRoute, sortKey: string): number {
  if (sortKey === "title") {
    return (first.title || "").localeCompare(second.title || "");
  } else if (sortKey === "distanceMetres") {
    return (first.distanceMetres || 0) - (second.distanceMetres || 0);
  } else if (sortKey === "importedAt") {
    return (first.importedAt || 0) - (second.importedAt || 0);
  } else {
    return (first.createdAtValue || 0) - (second.createdAtValue || 0);
  }
}

export function pageOsMapsListedRoutes(routes: OsMapsListedRoute[], query: OsMapsListingPageQuery): {
  users: string[];
  matchedCount: number;
  totalCount: number;
  page: OsMapsListedRoute[];
} {
  const users = routes
    .reduce((names: string[], route) => [...names, ...osMapsRouteUserNames(route)], [])
    .filter((name, index, names) => names.indexOf(name) === index)
    .sort((first, second) => first.localeCompare(second));
  const here = query.nearbyOnly && query.latitude !== null && query.longitude !== null
    ? {latitude: query.latitude, longitude: query.longitude}
    : null;
  const matched = routes.filter(route => {
    const key = routeKey(route);
    const origin = startPoint(route);
    const miles = here && origin ? milesBetween(here, origin) : null;
    return osMapsRouteVisible(route, query.search, query.filter, query.user)
      && !query.hiddenKeys.includes(key || "")
      && (!query.favouritesOnly || query.favouriteKeys.includes(key || ""))
      && (!query.nearbyOnly || (miles !== null && miles <= query.nearbyMiles));
  });
  const direction = query.sortDirection === SortDirection.ASC ? 1 : -1;
  const sorted = query.nearbyOnly && here
    ? [...matched].sort((first, second) => {
      const firstOrigin = startPoint(first);
      const secondOrigin = startPoint(second);
      const firstMiles = firstOrigin ? milesBetween(here, firstOrigin) : Number.POSITIVE_INFINITY;
      const secondMiles = secondOrigin ? milesBetween(here, secondOrigin) : Number.POSITIVE_INFINITY;
      return firstMiles - secondMiles;
    })
    : [...matched].sort((first, second) => compareBySortKey(first, second, query.sortKey) * direction);
  const limit = query.limit > 0 ? query.limit : OS_MAPS_ROUTE_PAGE_SIZE;
  return {users, matchedCount: matched.length, totalCount: routes.length, page: sorted.slice(0, limit)};
}
