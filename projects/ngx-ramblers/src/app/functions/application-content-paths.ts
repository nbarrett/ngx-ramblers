import { values } from "es-toolkit/compat";
import { AdminContentPath, AdminMembersPath, AdminPath, AdminProfilePath, AdminSettingsPath } from "../models/admin-route-paths.model";
import { AppPath } from "../models/route-follow.model";
import { DEFAULT_WALKS_AREA, WALKS_ADD_WALK_SEGMENT, WalksAdminSegment, walksAdminPath, walksLeaderPath } from "../models/walks-route-paths.model";

export function applicationContentPaths(): string[] {
  return [
    ...values(AdminPath),
    ...values(AdminContentPath),
    ...values(AdminMembersPath),
    ...values(AdminProfilePath),
    ...values(AdminSettingsPath),
    DEFAULT_WALKS_AREA,
    walksLeaderPath(DEFAULT_WALKS_AREA),
    walksAdminPath(DEFAULT_WALKS_AREA),
    `${DEFAULT_WALKS_AREA}/${WALKS_ADD_WALK_SEGMENT}`,
    ...values(WalksAdminSegment).map(segment => walksAdminPath(DEFAULT_WALKS_AREA, segment)),
    AppPath.ROOT,
    `${AppPath.ROOT}/${AppPath.ROUTE}`,
    `${AppPath.ROOT}/${AppPath.LEGACY_FOLLOW}`
  ];
}

export function isDocumentationContentPath(pathname: string): boolean {
  const clean = (pathname || "").replace(/^\//, "");
  return clean === "how-to" || clean.startsWith("how-to/");
}

export function isApplicationContentPath(pathname: string): boolean {
  const clean = (pathname || "").replace(/^\//, "").split(/[?#]/)[0];
  const blocked = clean.startsWith("admin/platform") || clean.startsWith("admin/api") || clean.startsWith("admin/page-content") || clean.startsWith("admin/MIGRATIONS");
  return !!clean && !isDocumentationContentPath(pathname) && !blocked
    && applicationContentPaths().some(path => clean === path || clean.startsWith(`${path}/`));
}
