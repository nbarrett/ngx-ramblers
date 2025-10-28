import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton, removeActionButtonByHref } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("remove-duplicate-content-admin-link");
const TARGET_PATH = "admin#action-buttons";
const DEPRECATED_HREF = "admin/duplicate-content-text-navigator";

export async function up(db: Db, client: MongoClient) {
  await removeActionButtonByHref(db, TARGET_PATH, DEPRECATED_HREF, debugLog);
}

export async function down(db: Db, client: MongoClient) {
  const replacementColumn = {
    accessLevel: "committee",
    title: "Duplicate Content Text",
    icon: "faPencil",
    href: DEPRECATED_HREF,
    contentText: "Allows the user to navigate to the content text items that are duplicated in the system"
  };

  await ensureActionButton(db, TARGET_PATH, replacementColumn, debugLog);
}
