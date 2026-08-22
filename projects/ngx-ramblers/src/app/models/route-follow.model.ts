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

export enum RouteFollowProgressPaint {
  COLOUR_WALKED = "colour-walked",
  COLOUR_AHEAD = "colour-ahead"
}

export enum CompassCardinal {
  N = "N",
  NE = "NE",
  E = "E",
  SE = "SE",
  S = "S",
  SW = "SW",
  W = "W",
  NW = "NW"
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
  recordedPoints?: RouteFollowPoint[];
}

export function isLiveFollowMode(mode: RouteFollowMode): boolean {
  return mode === RouteFollowMode.FOLLOWING || mode === RouteFollowMode.PAUSED
    || mode === RouteFollowMode.PREVIEW || mode === RouteFollowMode.RECORDING;
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
  returnDirection: RouteFollowReturnDirection | null;
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
export const ROUTE_FOLLOW_LINE_WEIGHT_DEFAULT = 6;
export const ROUTE_FOLLOW_ENDS_JOINED_SPAN = 0.0002;
export const ROUTE_FOLLOW_WALKED_MUTED = "#8aa0c8";
export const ROUTE_FOLLOW_COMPASS_MIN_DELTA = 0.5;
export const ROUTE_FOLLOW_HEADING_UP_MIN_DELTA = 0.5;
export const FOLLOW_MAP_SCALE_TARGET_PX = 160;
export const FOLLOW_MAP_SCALE_MAX_PX = 200;
export const FOLLOW_MAP_SCALE_MIN_PX = 100;
export const COMPASS_TAPE_PX_PER_DEGREE = 2.3;
export const COMPASS_TAPE_HALF_WIDTH_PX = 200;
export const COMPASS_TAPE_TICK_DEGREES = 3;
const COMPASS_CARDINALS = [
  CompassCardinal.N,
  CompassCardinal.NE,
  CompassCardinal.E,
  CompassCardinal.SE,
  CompassCardinal.S,
  CompassCardinal.SW,
  CompassCardinal.W,
  CompassCardinal.NW
];
const METRES_PER_FOOT = 0.3048;
const METRES_PER_MILE = 1609.34;
const OS_GRID_LETTERS = [
  ["SV", "SW", "SX", "SY", "SZ", "TV", "TW"],
  ["SQ", "SR", "SS", "ST", "SU", "TQ", "TR"],
  ["SL", "SM", "SN", "SO", "SP", "TL", "TM"],
  ["SF", "SG", "SH", "SJ", "SK", "TF", "TG"],
  ["SA", "SB", "SC", "SD", "SE", "TA", "TB"],
  ["NV", "NW", "NX", "NY", "NZ", "OV", "OW"],
  ["NQ", "NR", "NS", "NT", "NU", "OQ", "OR"],
  ["NL", "NM", "NN", "NO", "NP", "OL", "OM"],
  ["NF", "NG", "NH", "NJ", "NK", "OF", "OG"],
  ["NA", "NB", "NC", "ND", "NE", "OA", "OB"]
];

export interface FollowMapScaleBar {
  label: string;
  midLabel: string;
  widthPx: number;
}

export interface CompassTapeMark {
  degree: number;
  offsetPx: number;
  major: boolean;
  medium: boolean;
  label: string;
}

const FOLLOW_MAP_SCALE_CHOICES: FollowMapScaleBarChoice[] = [
  {metres: 5 * METRES_PER_FOOT, label: "5 ft"},
  {metres: 10 * METRES_PER_FOOT, label: "10 ft"},
  {metres: 20 * METRES_PER_FOOT, label: "20 ft"},
  {metres: 50 * METRES_PER_FOOT, label: "50 ft"},
  {metres: 100 * METRES_PER_FOOT, label: "100 ft"},
  {metres: 200 * METRES_PER_FOOT, label: "200 ft"},
  {metres: 500 * METRES_PER_FOOT, label: "500 ft"},
  {metres: 1000 * METRES_PER_FOOT, label: "1000 ft"},
  {metres: 0.25 * METRES_PER_MILE, label: "0.25 mi"},
  {metres: 0.5 * METRES_PER_MILE, label: "0.5 mi"},
  {metres: 1 * METRES_PER_MILE, label: "1 mi"},
  {metres: 2 * METRES_PER_MILE, label: "2 mi"},
  {metres: 5 * METRES_PER_MILE, label: "5 mi"},
  {metres: 10 * METRES_PER_MILE, label: "10 mi"}
];

interface FollowMapScaleBarChoice {
  metres: number;
  label: string;
}

export function sheetStateAfterDrag(current: RouteFollowSheetState, deltaY: number, threshold = ROUTE_FOLLOW_SHEET_DRAG_THRESHOLD): RouteFollowSheetState {
  if (deltaY <= -threshold) {
    return RouteFollowSheetState.EXPANDED;
  } else if (deltaY >= threshold) {
    return RouteFollowSheetState.MINIMISED;
  } else {
    return current;
  }
}

export function routeFollowProgressPaintFrom(value: string | null): RouteFollowProgressPaint {
  if (value === RouteFollowProgressPaint.COLOUR_AHEAD) {
    return RouteFollowProgressPaint.COLOUR_AHEAD;
  } else {
    return RouteFollowProgressPaint.COLOUR_WALKED;
  }
}

function editPointSpan(from: RouteFollowPoint, to: RouteFollowPoint): number {
  const dLat = from.latitude - to.latitude;
  const dLng = (from.longitude - to.longitude) * Math.cos(((from.latitude + to.latitude) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

export function routeEndsJoined(vertices: RouteFollowPoint[]): boolean {
  if (vertices.length < 3) {
    return false;
  } else {
    return editPointSpan(vertices[0], vertices[vertices.length - 1]) <= ROUTE_FOLLOW_ENDS_JOINED_SPAN;
  }
}

export function editExtendAfterIndex(vertices: RouteFollowPoint[], click: RouteFollowPoint): number {
  if (vertices.length <= 1 || routeEndsJoined(vertices)) {
    return vertices.length - 1;
  } else if (editPointSpan(click, vertices[0]) < editPointSpan(click, vertices[vertices.length - 1])) {
    return -1;
  } else {
    return vertices.length - 1;
  }
}

export function followLineColours(paint: RouteFollowProgressPaint, routeColor: string, muted = ROUTE_FOLLOW_WALKED_MUTED): {walked: string; ahead: string} {
  if (paint === RouteFollowProgressPaint.COLOUR_WALKED) {
    return {walked: routeColor, ahead: muted};
  } else {
    return {walked: muted, ahead: routeColor};
  }
}

export function compassHeadingLabel(degrees: number): string {
  if (!Number.isFinite(degrees)) {
    return "";
  } else {
    const wrapped = ((Math.round(degrees) % 360) + 360) % 360;
    return `${wrapped}°`;
  }
}

export function followMapScaleBar(
  metresPerPixel: number,
  targetPx = FOLLOW_MAP_SCALE_TARGET_PX,
  maxPx = FOLLOW_MAP_SCALE_MAX_PX
): FollowMapScaleBar {
  if (!Number.isFinite(metresPerPixel) || metresPerPixel <= 0) {
    return {label: "", midLabel: "", widthPx: 0};
  } else {
    const scored = FOLLOW_MAP_SCALE_CHOICES.map(choice => {
      const widthPx = choice.metres / metresPerPixel;
      return {choice, widthPx, score: Math.abs(widthPx - targetPx)};
    });
    const inRange = scored.filter(item => item.widthPx >= FOLLOW_MAP_SCALE_MIN_PX && item.widthPx <= maxPx);
    const pool = inRange.length > 0 ? inRange : scored;
    const best = pool.reduce((winner, item) => item.score < winner.score ? item : winner);
    return {
      label: followScaleDisplayLabel(best.choice.label),
      midLabel: followScaleDisplayLabel(followScaleHalfLabel(best.choice.label)),
      widthPx: Math.round(best.widthPx)
    };
  }
}

export function followScaleDisplayLabel(label: string): string {
  return label.replace(/^(\d{4,})/, digits => Number(digits).toLocaleString("en-GB"));
}

export function followScaleHalfLabel(label: string): string {
  const match = label.match(/^([\d.]+)\s*(ft|mi)$/);
  if (!match) {
    return "";
  } else {
    const value = Number(match[1]) / 2;
    if (match[2] === "ft") {
      return `${Math.round(value)} ft`;
    } else {
      const miles = value >= 1 ? (value >= 10 ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")) : String(value);
      return `${miles} mi`;
    }
  }
}

export function compassCardinal(degrees: number): CompassCardinal {
  const wrapped = ((degrees % 360) + 360) % 360;
  const index = Math.round(wrapped / 45) % 8;
  return COMPASS_CARDINALS[index];
}

export function compassTapeMarks(
  heading: number,
  halfWidthPx = COMPASS_TAPE_HALF_WIDTH_PX,
  pxPerDegree = COMPASS_TAPE_PX_PER_DEGREE
): CompassTapeMark[] {
  if (!Number.isFinite(heading) || pxPerDegree <= 0) {
    return [];
  } else {
    const span = Math.ceil(halfWidthPx / pxPerDegree) + COMPASS_TAPE_TICK_DEGREES;
    const start = Math.floor((heading - span) / COMPASS_TAPE_TICK_DEGREES) * COMPASS_TAPE_TICK_DEGREES;
    const count = Math.floor((span * 2) / COMPASS_TAPE_TICK_DEGREES) + 2;
    return Array.from({length: count}, (_, index) => {
      const degree = start + index * COMPASS_TAPE_TICK_DEGREES;
      const wrapped = ((degree % 360) + 360) % 360;
      const major = wrapped % 45 === 0;
      const medium = !major && wrapped % 15 === 0;
      return {
        degree: wrapped,
        offsetPx: (degree - heading) * pxPerDegree,
        major,
        medium,
        label: major ? compassCardinal(wrapped) : ""
      };
    });
  }
}

export function formatOsGridReference(eastings: number, northings: number): string {
  if (!Number.isFinite(eastings) || !Number.isFinite(northings) || eastings < 0 || eastings >= 700000 || northings < 0 || northings >= 1300000) {
    return "";
  } else {
    const columnIndex = Math.floor(eastings / 100000);
    const rowIndex = Math.floor(northings / 100000);
    const letters = OS_GRID_LETTERS[rowIndex] ? OS_GRID_LETTERS[rowIndex][columnIndex] : null;
    if (!letters) {
      return "";
    } else {
      const east = Math.floor(eastings % 100000).toString().padStart(5, "0");
      const north = Math.floor(northings % 100000).toString().padStart(5, "0");
      return `${letters} ${east} ${north}`;
    }
  }
}
