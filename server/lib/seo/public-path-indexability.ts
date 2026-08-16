import { values } from "es-toolkit/compat";
import { PageSeoDescriptor } from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import { PathSegment } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { Organisation } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { WALKS_ADD_WALK_SEGMENT, WALKS_ADMIN_SEGMENT, WALKS_LEADER_SEGMENT } from "../../../projects/ngx-ramblers/src/app/models/walks-route-paths.model";
import { DEFAULT_SOCIAL_EVENTS_BASE_PATH, DEFAULT_WALKS_BASE_PATH, eventPathFor } from "../shared/event-url";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { isMongoIdString } from "../mongo/controllers/transforms";
import { lastItemFrom } from "../shared/string-utils";

export enum SeoReservedAppSegment {
  ADMIN = "admin",
  LOGIN = "login",
  LOGOUT = "logout",
  FORGOT_PASSWORD = "forgot-password",
  APP = "app",
  SEARCH = "search",
  SITE_MAP = "site-map",
  VIDEO_MEETINGS = "video-meetings",
  FRAGMENTS = "fragments",
  HOME = "home",
  API = "api",
  ASSETS = "assets"
}

export enum SeoReservedAppPrefix {
  ADMIN = SeoReservedAppSegment.ADMIN,
  APP = SeoReservedAppSegment.APP,
  VIDEO_MEETINGS = SeoReservedAppSegment.VIDEO_MEETINGS,
  FRAGMENTS = SeoReservedAppSegment.FRAGMENTS,
  API = SeoReservedAppSegment.API,
  ASSETS = SeoReservedAppSegment.ASSETS
}

export enum SeoExactAppPath {
  LOGIN = SeoReservedAppSegment.LOGIN,
  LOGOUT = SeoReservedAppSegment.LOGOUT,
  FORGOT_PASSWORD = SeoReservedAppSegment.FORGOT_PASSWORD,
  SEARCH = SeoReservedAppSegment.SEARCH,
  SITE_MAP = SeoReservedAppSegment.SITE_MAP,
  HOME = SeoReservedAppSegment.HOME
}

export enum SeoReservedWalkSegment {
  ADD = "add",
  ADMIN = WALKS_ADMIN_SEGMENT,
  MY_WALKS = WALKS_LEADER_SEGMENT,
  ADD_WALK = WALKS_ADD_WALK_SEGMENT,
  EDIT = PathSegment.EDIT,
  VIEW = PathSegment.VIEW,
  NEW = PathSegment.NEW,
  EMAIL_COMPOSER = PathSegment.EMAIL_COMPOSER
}

export enum SeoReservedTrailingSegment {
  EDIT = PathSegment.EDIT,
  VIEW = PathSegment.VIEW,
  NEW = PathSegment.NEW,
  EMAIL_COMPOSER = PathSegment.EMAIL_COMPOSER,
  SEND_NOTIFICATION = PathSegment.SEND_NOTIFICATION,
  UNSUBSCRIBE = "unsubscribe"
}

const RESERVED_APP_PREFIXES = new Set<string>(values(SeoReservedAppPrefix));
const EXACT_APP_PATHS = new Set<string>(values(SeoExactAppPath));
const RESERVED_WALK_SEGMENTS = new Set<string>(values(SeoReservedWalkSegment));
const RESERVED_TRAILING_SEGMENTS = new Set<string>(values(SeoReservedTrailingSegment));

export function missingPageSeoDescriptor(): PageSeoDescriptor {
  return {
    title: "Page not found",
    description: "",
    contentHtml: "",
    robots: "noindex",
    httpStatus: 404
  };
}

export function eventListRootsFrom(group: Organisation): string[] {
  const walks = (group?.walksBasePath || DEFAULT_WALKS_BASE_PATH).replace(/^\/+|\/+$/g, "");
  const social = (group?.socialEventsBasePath || DEFAULT_SOCIAL_EVENTS_BASE_PATH).replace(/^\/+|\/+$/g, "");
  return Array.from(new Set([walks, social, DEFAULT_WALKS_BASE_PATH, DEFAULT_SOCIAL_EVENTS_BASE_PATH].filter(root => !!root)));
}

export function isReservedSeoAppPath(path: string, eventListRoots: string[] = eventListRootsFrom(null)): boolean {
  const segments = (path || "").split("/").filter(segment => segment.length > 0);
  if (segments.length === 0) {
    return true;
  } else {
    const first = segments[0].toLowerCase();
    const last = segments[segments.length - 1].toLowerCase();
    if (RESERVED_APP_PREFIXES.has(first)) {
      return true;
    } else if (segments.length === 1 && EXACT_APP_PATHS.has(first)) {
      return true;
    } else if (eventListRoots.includes(first) && segments.length === 1) {
      return true;
    } else if (eventListRoots.includes(first) && RESERVED_WALK_SEGMENTS.has(segments[1].toLowerCase())) {
      return true;
    } else if (RESERVED_TRAILING_SEGMENTS.has(last)) {
      return true;
    } else {
      return false;
    }
  }
}

export function eventRedirectTarget(requestPath: string, event: ExtendedGroupEvent, group: Organisation): string {
  const officialPath = eventPathFor(event, group);
  const requested = `/${(requestPath || "").replace(/^\/+|\/+$/g, "")}`;
  if (!officialPath || officialPath === requested) {
    return null;
  } else {
    return officialPath;
  }
}

export function eventHasIndexablePublicSlug(event: ExtendedGroupEvent): boolean {
  const slug = lastItemFrom(event?.groupEvent?.url || "");
  return !!slug && !isMongoIdString(slug);
}

export function homeRedirectTarget(path: string): string {
  const normalised = (path || "/").replace(/\/+$/, "") || "/";
  if (normalised === "/home") {
    return "/";
  } else {
    return null;
  }
}
