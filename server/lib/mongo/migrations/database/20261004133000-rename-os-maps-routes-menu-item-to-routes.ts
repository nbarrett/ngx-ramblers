import { Db, MongoClient } from "mongodb";
import { BuiltInAnchor, PageContentType } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  DEFAULT_WALKS_AREA,
  walksAdminPath,
  walksAreaOrDefault
} from "../../../../../projects/ngx-ramblers/src/app/models/walks-route-paths.model";
import createMigrationLogger from "../migrations-logger";
import { routesMenuItem } from "../shared/admin-menu-items";
import { PAGE_CONTENT_COLLECTION } from "../shared/collection-names";
import { ensureActionButton, replaceActionButtonByHref } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("rename-os-maps-routes-menu-item-to-routes");
const OLD_SEGMENT = "os-maps-export";

async function resolveWalksArea(db: Db): Promise<string> {
  const walksPages = await db.collection(PAGE_CONTENT_COLLECTION)
    .find({"rows.events.eventTypes": RamblersEventType.GROUP_WALK})
    .toArray();
  const areas = walksPages
    .map(document => (document?.path || "").split("#")[0].split("/").filter((segment: string) => segment))
    .filter((segments: string[]) => segments.length === 1)
    .map((segments: string[]) => segments[0]);
  if (areas.length === 0) {
    debugLog("No walks page found, defaulting the walks area to %s", DEFAULT_WALKS_AREA);
    return DEFAULT_WALKS_AREA;
  } else {
    const walksArea = walksAreaOrDefault(areas[0]);
    debugLog("Resolved walks area as %s from %d candidate page(s)", walksArea, areas.length);
    return walksArea;
  }
}

function oldRoutesHref(walksArea: string): string {
  return `${walksAreaOrDefault(walksArea)}/admin/${OLD_SEGMENT}`;
}

export async function up(db: Db, _client: MongoClient) {
  debugLog("Renaming OS Maps Routes admin button to Routes");
  const walksArea = await resolveWalksArea(db);
  const targetPath = `${walksAdminPath(walksArea)}#${BuiltInAnchor.ACTION_BUTTONS}`;
  const menuItem = routesMenuItem(walksArea);
  const oldHref = oldRoutesHref(walksArea);
  const replaced = await replaceActionButtonByHref(db, targetPath, oldHref, menuItem, debugLog);
  if (replaced) {
    debugLog("Walk admin Routes button updated on %s", targetPath);
  } else {
    const added = await ensureActionButton(db, targetPath, menuItem, debugLog);
    if (added) {
      debugLog("Routes button added on %s because the old OS Maps Routes button was missing", targetPath);
    } else {
      debugLog("Routes button already present on %s", targetPath);
    }
  }
  const documents = await db.collection(PAGE_CONTENT_COLLECTION).find({
    "rows.type": PageContentType.ACTION_BUTTONS,
    "rows.columns.href": { $regex: `(^|/)${OLD_SEGMENT}$` }
  }).toArray();
  await documents.reduce(async (previous, document) => {
    await previous;
    if (document.path !== targetPath) {
      const stale = ((document.rows || []) as any[])
        .flatMap(row => row?.type === PageContentType.ACTION_BUTTONS ? (row.columns || []) : [])
        .find((column: any) => typeof column?.href === "string" && column.href.endsWith(OLD_SEGMENT));
      if (stale?.href) {
        await replaceActionButtonByHref(db, document.path, stale.href, menuItem, debugLog);
      }
    }
  }, Promise.resolve());
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - Routes menu item is intentionally left in place");
}
