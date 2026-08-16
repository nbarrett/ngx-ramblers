export enum AppPath {
  ROOT = "app",
  FOLLOW = "follow"
}

export enum RouteFollowQueryParam {
  PATH = "path",
  ROUTE_ID = "routeId",
  WALK_ID = "walkId",
  RAMBLERS_SLUG = "ramblersSlug",
  OS_MAPS_ROUTE_ID = "osMapsRouteId"
}

export enum RouteWaypointKind {
  START = "start",
  WAYPOINT = "waypoint",
  TURN = "turn",
  LANDMARK = "landmark",
  END = "end"
}

export enum RouteDifficulty {
  EASY = "easy",
  LEISURELY = "leisurely",
  MODERATE = "moderate",
  STRENUOUS = "strenuous"
}

export enum RouteFollowMode {
  IDLE = "idle",
  FOLLOWING = "following",
  PAUSED = "paused",
  PREVIEW = "preview",
  EDITING = "editing",
  RECORDING = "recording"
}

export enum RouteFollowEditTool {
  PENCIL = "pencil",
  ERASER = "eraser"
}

export enum RouteFollowSheetState {
  EXPANDED = "expanded",
  MINIMISED = "minimised"
}

export enum RouteFollowReturnDirection {
  FORWARD = "forward",
  RIGHT = "right",
  BACK = "back",
  LEFT = "left"
}

export interface RouteFollowSession {
  walkId: string | null;
  path: string | null;
  routeId: string | null;
  ramblersSlug: string | null;
  osMapsRouteId: string | null;
  mode: RouteFollowMode;
  headingUp: boolean;
  sheetState: RouteFollowSheetState;
  previewSpeed: number;
  previewMetres: number;
  visitedWaypointIds: string[];
}

export function isLiveFollowMode(mode: RouteFollowMode): boolean {
  return mode === RouteFollowMode.FOLLOWING || mode === RouteFollowMode.PAUSED || mode === RouteFollowMode.PREVIEW;
}

export enum RouteFollowLocationError {
  NONE = "none",
  UNSUPPORTED = "unsupported",
  DENIED = "denied",
  UNAVAILABLE = "unavailable",
  TIMEOUT = "timeout"
}

export enum AppInstallPlatform {
  IOS = "ios",
  ANDROID = "android",
  OTHER = "other"
}

export enum AppAppearance {
  SYSTEM = "system",
  LIGHT = "light",
  DARK = "dark"
}

export function appAppearanceFromStored(value: string | null): AppAppearance {
  if (value === AppAppearance.LIGHT) {
    return AppAppearance.LIGHT;
  } else if (value === AppAppearance.DARK) {
    return AppAppearance.DARK;
  } else {
    return AppAppearance.SYSTEM;
  }
}

export function nextAppAppearance(current: AppAppearance, systemIsDark: boolean): AppAppearance {
  if (current === AppAppearance.SYSTEM) {
    return systemIsDark ? AppAppearance.LIGHT : AppAppearance.DARK;
  } else if (current === AppAppearance.LIGHT) {
    return AppAppearance.DARK;
  } else {
    return AppAppearance.LIGHT;
  }
}

export enum RouteFollowOfflineStatus {
  NEEDS_NETWORK = "needs-network",
  SAVING = "saving",
  AVAILABLE = "available"
}

export enum RouteFollowSource {
  PAGE = "page",
  WALK = "walk",
  RAMBLERS_LIBRARY = "ramblers-library",
  OS_MAPS = "os-maps"
}

export interface MapGestureAnchor {
  distance: number;
  angle: number;
  zoom: number;
  bearing: number;
  midX: number;
  midY: number;
}

export type FollowMapGestureAnchor = MapGestureAnchor;

export interface RouteGuideData {
  title?: string;
  summary?: string;
  distanceMiles?: number;
  durationMinutes?: number;
  difficulty?: RouteDifficulty;
  startDescription?: string;
}

export interface RouteFollowWaypoint {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
  instruction?: string | null;
  kind?: RouteWaypointKind;
}

export interface RouteFollowPoint {
  latitude: number;
  longitude: number;
  elevation?: number | null;
}

export interface RouteFollowSnap {
  point: RouteFollowPoint;
  index: number;
  distanceMetres: number;
  progressMetres: number;
}

export interface RouteFollowProgress {
  mode: RouteFollowMode;
  position: RouteFollowPoint | null;
  heading: number | null;
  accuracyMetres: number | null;
  snap: RouteFollowSnap | null;
  remainingMetres: number;
  remainingMinutes: number;
  nextWaypoint: RouteFollowWaypoint | null;
  nextWaypointMetres: number | null;
  approachedWaypoint: RouteFollowWaypoint | null;
  offRoute: boolean;
  completedMetres: number;
  totalMetres: number;
  locationError: RouteFollowLocationError;
  routeHeading: number | null;
  currentElevationMetres: number | null;
}

export interface RouteFollowPayload {
  source: RouteFollowSource;
  title: string;
  path: string | null;
  walkId: string | null;
  routeId: string | null;
  ramblersSlug: string | null;
  osMapsRouteId: string | null;
  provider: string;
  osStyle: string;
  color: string;
  weight: number;
  opacity: number;
  points: RouteFollowPoint[];
  waypoints: RouteFollowWaypoint[];
  totalMetres: number;
  guide: RouteGuideData | null;
}

export interface RouteFollowSummary {
  source: RouteFollowSource;
  title: string;
  path: string | null;
  walkId: string | null;
  routeId: string | null;
  ramblersSlug: string | null;
  distanceMiles: number | null;
  startDescription: string | null;
}

export interface RamblersLibraryRoute {
  slug: string;
  title: string;
  description: string;
  startDescription: string;
  startLatitude: number;
  startLongitude: number;
  distanceMiles: number | null;
  durationMinutes: number | null;
  difficulty: string | null;
  shape: string | null;
  sourceUrl: string;
  points: RouteFollowPoint[];
  waypoints: RouteFollowWaypoint[];
  hasLine: boolean;
}

export function followCacheKey(parts: {
  path?: string | null;
  routeId?: string | null;
  walkId?: string | null;
  ramblersSlug?: string | null;
  osMapsRouteId?: string | null;
}): string | null {
  if (parts.osMapsRouteId) {
    return `os-maps:${parts.osMapsRouteId}`;
  } else if (parts.ramblersSlug) {
    return `ramblers:${parts.ramblersSlug}`;
  } else if (parts.walkId) {
    return `walk:${parts.walkId}`;
  } else if (parts.path) {
    return `page:${parts.path}:${parts.routeId || ""}`;
  } else {
    return null;
  }
}

export const ROUTE_FOLLOW_NETWORK_TIMEOUT_MS = 3000;

export function formatDataSize(bytes: number): string {
  if (bytes < 1024) {
    return `${Math.max(0, Math.round(bytes))} bytes`;
  } else if (bytes < 1024 * 1024) {
    const kilobytes = bytes / 1024;
    return kilobytes < 10 ? `${kilobytes.toFixed(1)} KB` : `${Math.round(kilobytes)} KB`;
  } else {
    const megabytes = bytes / (1024 * 1024);
    return megabytes < 10 ? `${megabytes.toFixed(1)} MB` : `${Math.round(megabytes)} MB`;
  }
}

export function formatMapSaveProgress(done: number, total: number, bytes: number): string {
  if (total <= 0) {
    return "Saving the map for offline use…";
  } else {
    const percent = Math.min(100, Math.round((done / total) * 100));
    if (bytes > 0) {
      return `Saving the map for offline use… ${percent}% (${formatDataSize(bytes)})`;
    } else {
      return `Saving the map for offline use… ${percent}%`;
    }
  }
}

export function firstCompleted<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    })
  ]);
}

export const ROUTE_FOLLOW_APPROACH_METRES = 40;
export const ROUTE_FOLLOW_OFF_ROUTE_METRES = 50;
export const ROUTE_FOLLOW_WALKING_METRES_PER_MINUTE = 75;
export const ROUTE_FOLLOW_ARROW_SPACING_METRES = 220;
export const ROUTE_FOLLOW_RECORD_MIN_POINT_METRES = 8;
export const ROUTE_FOLLOW_EDIT_SPACING_METRES = 80;
export const ROUTE_FOLLOW_EDIT_MAX_POINTS = 80;
export const ROUTE_FOLLOW_EDIT_THIN_FROM = 150;
export const ROUTE_FOLLOW_EDIT_TARGET_POINTS = 120;
export const ROUTE_FOLLOW_EDIT_DETAIL_MIN = 1;
export const ROUTE_FOLLOW_EDIT_DETAIL_MAX = 20;
export const ROUTE_FOLLOW_PREVIEW_STEP_METRES = 25;
export const ROUTE_FOLLOW_PREVIEW_INTERVAL_MS = 80;
export const ROUTE_FOLLOW_PREVIEW_SPEED_MIN = 1;
export const ROUTE_FOLLOW_PREVIEW_SPEED_MAX = 10;
export const ROUTE_FOLLOW_PREVIEW_SPEED_DEFAULT = 1;
export const ROUTE_FOLLOW_PREVIEW_SPEED_SPAN = 2;
export const ROUTE_FOLLOW_SHEET_DRAG_THRESHOLD = 36;

export function sheetStateAfterDrag(current: RouteFollowSheetState, deltaY: number, threshold = ROUTE_FOLLOW_SHEET_DRAG_THRESHOLD): RouteFollowSheetState {
  if (deltaY <= -threshold) {
    return RouteFollowSheetState.EXPANDED;
  } else if (deltaY >= threshold) {
    return RouteFollowSheetState.MINIMISED;
  } else {
    return current;
  }
}
