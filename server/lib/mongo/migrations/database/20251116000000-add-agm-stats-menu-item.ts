import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("add-agm-stats-menu-item");
const TARGET_PATH = "admin#action-buttons";

export async function up(db: Db, client: MongoClient) {
  debugLog("Adding AGM Statistics Report menu item to admin page");

  const agmStatsMenuItem = {
    accessLevel: "committee",
    title: "AGM Statistics Report",
    icon: "faChartBar",
    href: "admin/agm-stats",
    contentText: "View comprehensive statistics for walks and social events:\n\n- Walk metrics including miles walked, leaders, and attendance\n- Social event statistics and organisers\n- Year-over-year comparisons\n- Ideal for preparing AGM reports"
  };

  const added = await ensureActionButton(db, TARGET_PATH, agmStatsMenuItem, debugLog);

  if (added) {
    debugLog("AGM Statistics Report menu item added successfully");
  } else {
    debugLog("AGM Statistics Report menu item already exists or could not be added");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - AGM Statistics Report menu item is intentionally left in place");
}
