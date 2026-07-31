import { Db } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { PAGE_CONTENT_COLLECTION } from "../shared/collection-names";
import {
  deduplicateActionButtonsByHref,
  deduplicatePageContentDocuments,
  ensureActionButtons,
  removeActionButtonByHref,
  syncActionButtonDetailsByHref
} from "../shared/page-content-actions";
import { walkAdminLegacyHelpNames, walkAdminMenuItems } from "../shared/admin-menu-items";
import {
  ActionButtonColumn,
  BuiltInAnchor,
  PageContentType
} from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { RamblersEventType } from "../../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import {
  DEFAULT_WALKS_AREA,
  walksAdminPath,
  walksAreaOrDefault
} from "../../../../../projects/ngx-ramblers/src/app/models/walks-route-paths.model";

const debugLog = createMigrationLogger("seed-walk-admin-action-buttons");

const LEGACY_HELP_COLLECTIONS = ["contentText", "contentTexts"];
const LEGACY_LEADER_SEGMENT = "leader";
const SUPERSEDED_HELP_PHRASES = [
  "change your website usage from the read-only view of Ramblers walks",
  "push them in bulk to Ramblers"
];

function supersededHelpText(text: string): boolean {
  return SUPERSEDED_HELP_PHRASES.some(phrase => (text || "").includes(phrase));
}

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
    const walksArea = areas[0];
    debugLog("Resolved walks area as %s from %d candidate page(s)", walksArea, areas.length);
    return walksArea;
  }
}

async function legacyHelpTextFor(db: Db, name: string): Promise<string> {
  const documentsPerCollection = await Promise.all(LEGACY_HELP_COLLECTIONS.map(collectionName =>
    db.collection(collectionName).find({ name }).sort({ _id: 1 }).toArray()));
  const withText = documentsPerCollection.flat().find(document => document?.text?.trim());
  return withText?.text;
}

async function resolvedMenuItems(db: Db, walksArea: string): Promise<ActionButtonColumn[]> {
  const legacyHelpNames = walkAdminLegacyHelpNames(walksArea);
  return Promise.all(walkAdminMenuItems(walksArea).map(async item => {
    const legacyName = legacyHelpNames[item.href];
    const legacyText = legacyName ? await legacyHelpTextFor(db, legacyName) : null;
    if (legacyText && supersededHelpText(legacyText)) {
      debugLog("Ignoring superseded help text held under %s for the %s action button", legacyName, item.title);
      return item;
    } else if (legacyText) {
      debugLog("Carrying existing help text from %s across to the %s action button", legacyName, item.title);
      return { ...item, contentText: legacyText };
    } else {
      return item;
    }
  }));
}

async function ensurePageContentDocumentExists(db: Db, path: string): Promise<void> {
  const collection = db.collection(PAGE_CONTENT_COLLECTION);
  await deduplicatePageContentDocuments(db, path, debugLog);
  const existing = await collection.findOne({ path }, { sort: { _id: 1 } });
  if (existing) {
    debugLog("Page content document already exists for %s", path);
  } else {
    await collection.insertOne({
      path,
      rows: [{
        maxColumns: 3,
        showSwiper: false,
        type: PageContentType.ACTION_BUTTONS,
        columns: []
      }]
    });
    debugLog("Created page content document for %s", path);
  }
}

async function removeSupersededHelpText(db: Db): Promise<void> {
  const removals = await Promise.all(LEGACY_HELP_COLLECTIONS.map(async collectionName => {
    const documents = await db.collection(collectionName).find({}).toArray();
    const superseded = documents.filter(document => supersededHelpText(document?.text));
    await Promise.all(superseded.map(document =>
      db.collection(collectionName).deleteOne({ _id: document._id })));
    return superseded.length;
  }));
  const total = removals.reduce((count, removed) => count + removed, 0);
  if (total > 0) {
    debugLog("Removed %d help text record(s) describing the superseded bulk import route", total);
  }
}

export async function up(db: Db) {
  const walksArea = await resolveWalksArea(db);
  const path = `${walksAdminPath(walksArea)}#${BuiltInAnchor.ACTION_BUTTONS}`;
  debugLog("Seeding walk admin action buttons at %s", path);
  await ensurePageContentDocumentExists(db, path);
  await removeActionButtonByHref(db, path, `${walksAreaOrDefault(walksArea)}/${LEGACY_LEADER_SEGMENT}`, debugLog);
  const menuItems = await resolvedMenuItems(db, walksArea);
  await removeSupersededHelpText(db);
  const addedCount = await ensureActionButtons(db, path, menuItems, debugLog);
  await deduplicateActionButtonsByHref(db, path, debugLog);
  const updatedCount = await syncActionButtonDetailsByHref(db, path, menuItems, debugLog);
  debugLog("Migration complete: added %d and updated %d walk admin action button(s)", addedCount, updatedCount);
}

export async function down(_db: Db) {
  debugLog("No down migration - walk admin action buttons are intentionally left in place");
}
