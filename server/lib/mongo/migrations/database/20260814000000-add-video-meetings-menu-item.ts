import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";

const debugLog = createMigrationLogger("add-video-meetings-menu-item");
const TARGET_PATH = "admin#action-buttons";

export async function up(db: Db, _client: MongoClient) {
  debugLog("Adding Video Meetings menu item to admin page");

  const videoMeetingsMenuItem = {
    accessLevel: "loggedInMember",
    title: "Meetings",
    icon: "faVideo",
    href: "admin/meetings",
    contentText: "Plan committee meetings from the calendar, or start and join video calls"
  };

  const added = await ensureActionButton(db, TARGET_PATH, videoMeetingsMenuItem, debugLog);

  if (added) {
    debugLog("Video Meetings menu item added successfully");
  } else {
    debugLog("Video Meetings menu item already exists or could not be added");
  }
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration - Video Meetings menu item is intentionally left in place");
}
