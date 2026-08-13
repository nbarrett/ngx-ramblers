import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { ensureActionButton } from "../shared/page-content-actions";
import { CONFIG_COLLECTION } from "../shared/collection-names";
import { defaultCommitteeMeetingTypes } from "../../../../../projects/ngx-ramblers/src/app/models/committee.model";

const debugLog = createMigrationLogger("add-video-meetings-menu-item");
const TARGET_PATH = "admin#action-buttons";
const COMMITTEE_CONFIG_KEY = "committee";

export async function up(db: Db, _client: MongoClient) {
  debugLog("Adding Video Meetings menu item to admin page");

  const videoMeetingsMenuItem = {
    accessLevel: "loggedInMember",
    title: "Video Meetings",
    icon: "faVideo",
    href: "admin/video-meetings",
    contentText: "Start or join a video meeting, invite guests by email, and plan meetings from the calendar"
  };

  const added = await ensureActionButton(db, TARGET_PATH, videoMeetingsMenuItem, debugLog);

  if (added) {
    debugLog("Video Meetings menu item added successfully");
  } else {
    debugLog("Video Meetings menu item already exists or could not be added");
  }

  await seedCommitteeMeetingTypes(db);
}

async function seedCommitteeMeetingTypes(db: Db): Promise<void> {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: COMMITTEE_CONFIG_KEY});
  if (!committeeConfig?.value) {
    debugLog("No committee config found - skipping meeting types seed");
  } else if (committeeConfig.value.meetingTypes) {
    debugLog("Committee meeting types already present - leaving them alone");
  } else {
    const meetingTypes = defaultCommitteeMeetingTypes(committeeConfig.value.fileTypes || []);
    await configCollection.updateOne(
      {key: COMMITTEE_CONFIG_KEY},
      {$set: {"value.meetingTypes": meetingTypes}}
    );
    debugLog("Seeded committee meeting types: %j", meetingTypes);
  }
}

export async function down(db: Db, _client: MongoClient) {
  debugLog("No down migration - Video Meetings menu item is intentionally left in place");
}
