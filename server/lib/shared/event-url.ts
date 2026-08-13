import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { Organisation } from "../../../projects/ngx-ramblers/src/app/models/system.model";

export const DEFAULT_WALKS_BASE_PATH = "walks";
export const DEFAULT_SOCIAL_EVENTS_BASE_PATH = "social";

function slugFromUrl(url: string): string {
  return (url || "").split("?")[0].split("#")[0].replace(/\/+$/, "").split("/").filter(Boolean).pop() || "";
}

export function eventSlugFrom(event: ExtendedGroupEvent): string {
  return slugFromUrl(event?.groupEvent?.url) || event?.id || "";
}

export function eventBasePathFor(event: ExtendedGroupEvent, group: Organisation): string {
  const socialEvent = event?.groupEvent?.item_type === RamblersEventType.GROUP_EVENT;
  const configured = socialEvent ? group?.socialEventsBasePath : group?.walksBasePath;
  const fallback = socialEvent ? DEFAULT_SOCIAL_EVENTS_BASE_PATH : DEFAULT_WALKS_BASE_PATH;
  return (configured || fallback).replace(/^\/+|\/+$/g, "");
}

export function eventPathFor(event: ExtendedGroupEvent, group: Organisation): string {
  const slug = eventSlugFrom(event);
  return slug ? `/${eventBasePathFor(event, group)}/${slug}` : null;
}

export function eventUrlFor(event: ExtendedGroupEvent, group: Organisation, baseUrl: string): string {
  const path = eventPathFor(event, group);
  const trimmedBase = (baseUrl || "").replace(/\/+$/, "");
  return path && trimmedBase ? `${trimmedBase}${path}` : null;
}
