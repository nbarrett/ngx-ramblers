import { DirectionsApp, DirectionsLink, LOCATE_PAGE_PATH, LocateLinkParams, OS_MAPS_EXPLORE_URL } from "../models/locate.model";
import { AppInstallPlatform } from "../models/route-follow.model";
import { parseGridReference } from "./grid-reference";
import { LocateSuggestion, UK_POSTCODE_PATTERN } from "../models/locate.model";
import { StoredValue } from "../models/ui-actions";

export function locateParentPath(path: string): string {
  const trimmed = (path || "").replace(/\/+$/, "");
  return trimmed.endsWith(`/${LOCATE_PAGE_PATH}`) ? trimmed.slice(0, -(LOCATE_PAGE_PATH.length + 1)) : trimmed;
}

export function locatePagePath(params: LocateLinkParams, basePath = ""): string {
  const query = [
    params.gridRef ? `${StoredValue.GRID_REF}=${encodeURIComponent(params.gridRef.replace(/\s+/g, ""))}` : "",
    params.postcode ? `${StoredValue.POSTCODE}=${encodeURIComponent(params.postcode)}` : "",
    params.zoom ? `${StoredValue.MAP_ZOOM}=${params.zoom}` : "",
    params.provider ? `${StoredValue.MAP_PROVIDER}=${encodeURIComponent(params.provider)}` : ""
  ].filter(item => item).join("&");
  return `${locateParentPath(basePath)}/${LOCATE_PAGE_PATH}${query ? `?${query}` : ""}`;
}

export function wazeEmbedUrl(latitude: number, longitude: number, zoom = 16): string {
  return `https://embed.waze.com/iframe?zoom=${zoom}&lat=${latitude.toFixed(6)}&lon=${longitude.toFixed(6)}&pin=1`;
}

export function locateSuggestionFor(query: string): LocateSuggestion | null {
  const trimmed = (query || "").trim();
  const compact = trimmed.replace(/\s+/g, "").toUpperCase();
  if (parseGridReference(compact)) {
    return {label: `Show grid reference ${compact} on the map`, queryParams: {[StoredValue.GRID_REF]: compact}};
  } else if (UK_POSTCODE_PATTERN.test(trimmed)) {
    return {label: `Show postcode ${trimmed.toUpperCase()} on the map`, queryParams: {[StoredValue.POSTCODE]: trimmed.toUpperCase()}};
  } else if (/^(locate|map|maps|grid ref(erence)?|where is)\b/i.test(trimmed)) {
    return {label: "Locate a place on the map", queryParams: {}};
  } else {
    return null;
  }
}

export function locationLabel(postcode: string | null | undefined, description: string | null | undefined, fallback = ""): string {
  const trimmedPostcode = (postcode || "").trim();
  const trimmedDescription = (description || "").trim();
  const compact = (value: string) => value.replace(/\s+/g, "").toUpperCase();
  const descriptionHasPostcode = !!trimmedPostcode && compact(trimmedDescription).includes(compact(trimmedPostcode));
  return [descriptionHasPostcode ? "" : trimmedPostcode, trimmedDescription].filter(value => !!value).join(", ") || fallback;
}

export function osMapsUrl(latitude: number, longitude: number, zoom = 16): string {
  return `${OS_MAPS_EXPLORE_URL}?lat=${latitude.toFixed(5)}&lon=${longitude.toFixed(5)}&zoom=${zoom}&style=Leisure`;
}

export function directionsLinks(latitude: number, longitude: number, platform: AppInstallPlatform = AppInstallPlatform.OTHER): DirectionsLink[] {
  const destination = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const onPhone = platform !== AppInstallPlatform.OTHER;
  return [
    {app: DirectionsApp.GOOGLE_MAPS, url: `https://www.google.com/maps/dir/?api=1&destination=${destination}`},
    ...(platform === AppInstallPlatform.IOS ? [{app: DirectionsApp.APPLE_MAPS, url: `https://maps.apple.com/?daddr=${destination}`}] : []),
    {app: DirectionsApp.WAZE, url: onPhone ? `https://waze.com/ul?ll=${destination}&navigate=yes` : `https://www.waze.com/live-map/directions?navigate=yes&to=ll.${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`}
  ];
}
