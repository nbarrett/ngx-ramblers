import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("add-image-migration-menu-item");
const TARGET_PATH = "admin#action-buttons";

export async function up(db: Db, client: MongoClient) {
  debugLog("Adding Image Migration menu item to admin page");

  const imageMigrationMenuItem = {
    accessLevel: "committee",
    title: "Image Migration",
    icon: "faCloudUploadAlt",
    href: "admin/image-migration",
    contentText: "Scan site content for images hosted on external domains and migrate them to S3 storage"
  };

  const added = await ensureActionButton(db, TARGET_PATH, imageMigrationMenuItem, debugLog);

  if (added) {
    debugLog("Image Migration menu item added successfully");
  } else {
    debugLog("Image Migration menu item already exists or could not be added");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - Image Migration menu item is intentionally left in place");
}
