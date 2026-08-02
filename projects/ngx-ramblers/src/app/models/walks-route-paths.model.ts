export enum WalksAdminSegment {
  ADD_WALK_SLOTS = "add-walk-slots",
  PROGRAMME = "programme",
  CALENDAR = "calendar",
  MAP = "map",
  EXPORT = "export",
  IMPORT = "import",
  CONFIG = "config",
  EVENT_DATA_MANAGEMENT = "event-data-management",
}

export const DEFAULT_WALKS_AREA = "walks";
export const WALKS_ADMIN_SEGMENT = "admin";
export const WALKS_LEADER_SEGMENT = "my-walks";
export const WALKS_ADD_WALK_SEGMENT = "add-walk";
export const WALKS_HOW_TO_DOCUMENTATION_URL = "https://www.ngx-ramblers.org.uk/how-to/committee/walks";

export function walksAreaOrDefault(area: string): string {
  return area?.trim() || DEFAULT_WALKS_AREA;
}

export function walksAdminPath(area: string, segment?: WalksAdminSegment): string {
  return [walksAreaOrDefault(area), WALKS_ADMIN_SEGMENT, segment].filter(item => item).join("/");
}

export function walksLeaderPath(area: string): string {
  return [walksAreaOrDefault(area), WALKS_LEADER_SEGMENT].join("/");
}
