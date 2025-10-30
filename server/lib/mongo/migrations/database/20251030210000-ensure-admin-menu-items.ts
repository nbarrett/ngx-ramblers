import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButtons } from "../shared/page-content-actions";
import { ADMIN_MENU_ITEMS, MAIL_PROVIDER_MENU_ITEMS } from "../shared/admin-menu-items";
import { MailProvider, SystemConfig } from "../../../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../../../config/system-config";

const debugLog = createMigrationLogger("ensure-admin-menu-items");
const TARGET_PATH = "admin#action-buttons";

export async function up(db: Db, client: MongoClient) {
  debugLog("Ensuring all admin menu items are present in page content");

  const menuItemsToAdd = [...ADMIN_MENU_ITEMS];

  try {
    const config: SystemConfig = await systemConfig();
    const mailProvider = config?.mailDefaults?.mailProvider;
    if (mailProvider === MailProvider.BREVO && MAIL_PROVIDER_MENU_ITEMS.brevo) {
      debugLog("Adding Brevo mail settings menu item");
      menuItemsToAdd.push(MAIL_PROVIDER_MENU_ITEMS.brevo);
    } else if (mailProvider === MailProvider.MAILCHIMP && MAIL_PROVIDER_MENU_ITEMS.mailchimp) {
      debugLog("Adding Mailchimp settings menu item");
      menuItemsToAdd.push(MAIL_PROVIDER_MENU_ITEMS.mailchimp);
    }
  } catch (error) {
    debugLog("Could not determine mail provider, skipping mail settings menu item:", error.message);
  }

  const addedCount = await ensureActionButtons(db, TARGET_PATH, menuItemsToAdd, debugLog);
  debugLog(`Migration complete: ${addedCount} new admin menu items added`);
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - admin menu items are intentionally left in place");
}
