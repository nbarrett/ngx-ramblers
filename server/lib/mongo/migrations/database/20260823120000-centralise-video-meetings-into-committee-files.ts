import { Db, MongoClient, ObjectId } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { CONFIG_COLLECTION } from "../shared/collection-names";
import { ConfigKey } from "../../../../../projects/ngx-ramblers/src/app/models/config.model";

const debugLog = createMigrationLogger("centralise-video-meetings-into-committee-files");
debugLog.enabled = true;

const COMMITTEE_CONFIG_KEY = ConfigKey.COMMITTEE;

function meetingFrom(videoMeeting: any) {
  return {
    format: "online",
    room: videoMeeting.room,
    title: videoMeeting.title,
    durationMinutes: videoMeeting.durationMinutes,
    invited: videoMeeting.invited,
    invitedMemberIds: videoMeeting.invitedMemberIds,
    invitedRecipients: videoMeeting.invitedRecipients,
    invitedListId: videoMeeting.invitedListId,
    createdBy: videoMeeting.createdBy,
    createdByName: videoMeeting.createdByName
  };
}

function committeeFileIdOf(videoMeeting: any): ObjectId | null {
  try {
    return videoMeeting.committeeFileId ? new ObjectId(String(videoMeeting.committeeFileId)) : null;
  } catch (error) {
    debugLog("could not parse committeeFileId %s: %s", videoMeeting.committeeFileId, String(error));
    return null;
  }
}

function classifyFileType(description: string): { meetingRole?: string; meetingCategory?: string } {
  const isAgenda = /agenda/i.test(description || "");
  const isMinutes = /minutes/i.test(description || "");
  if (!isAgenda && !isMinutes) {
    return {};
  } else {
    const category = (description || "").replace(/agenda|minutes/ig, "").replace(/\s+/g, " ").trim();
    return {
      meetingRole: isAgenda ? "agenda" : "minutes",
      meetingCategory: category || description
    };
  }
}

async function foldVideoMeetingsOntoCommitteeFiles(db: Db): Promise<void> {
  const videoMeetings = db.collection("videoMeetings");
  const committeeFiles = db.collection("committeeFiles");
  const all = await videoMeetings.find({}).toArray();
  const counters = {linked: 0, created: 0, skipped: 0};
  for (const videoMeeting of all) {
    const committeeFileId = committeeFileIdOf(videoMeeting);
    if (committeeFileId) {
      const result = await committeeFiles.updateOne(
        {_id: committeeFileId, meeting: {$exists: false}},
        {$set: {meeting: meetingFrom(videoMeeting)}}
      );
      counters.linked += result.modifiedCount;
      if (!result.modifiedCount) {
        counters.skipped += 1;
      }
    } else {
      const existing = await committeeFiles.findOne({"meeting.room": videoMeeting.room});
      if (existing) {
        counters.skipped += 1;
      } else {
        await committeeFiles.insertOne({
          fileType: "",
          eventDate: videoMeeting.startTime,
          createdDate: videoMeeting.createdAt,
          meeting: meetingFrom(videoMeeting)
        });
        counters.created += 1;
      }
    }
  }
  debugLog("Folded video meetings onto committee files: %j (videoMeetings collection left in place as a backup)", counters);
}

async function classifyCommitteeFileTypes(db: Db): Promise<void> {
  const configCollection = db.collection(CONFIG_COLLECTION);
  const committeeConfig = await configCollection.findOne({key: COMMITTEE_CONFIG_KEY});
  if (!committeeConfig?.value?.fileTypes) {
    debugLog("No committee config file types to classify");
  } else {
    const fileTypes = committeeConfig.value.fileTypes.map((fileType: any) =>
      fileType.meetingRole ? fileType : {...fileType, ...classifyFileType(fileType.description)});
    await configCollection.updateOne(
      {key: COMMITTEE_CONFIG_KEY},
      {$set: {"value.fileTypes": fileTypes}, $unset: {"value.meetingTypes": ""}}
    );
    debugLog("Classified committee file types by meeting role and removed derived meetingTypes: %j", fileTypes);
  }
}

async function renameMeetingsMenuItem(db: Db): Promise<void> {
  const pageContent = db.collection("pageContent");
  const target = await pageContent.findOne({path: "admin#action-buttons"});
  if (!target?.rows) {
    debugLog("No admin action buttons page content to rename");
  } else {
    const rows = target.rows.map((row: any) => ({
      ...row,
      columns: (row.columns || []).map((column: any) =>
        column?.href === "admin/video-meetings"
          ? {...column, title: "Meetings", href: "admin/meetings", contentText: "Plan committee meetings from the calendar, or start and join video calls"}
          : column)
    }));
    await pageContent.updateOne({_id: target._id}, {$set: {rows}});
    debugLog("Renamed and re-pathed the Video Meetings admin menu item to Meetings (admin/meetings)");
  }
}

async function backfillMeetingFormat(db: Db): Promise<void> {
  const committeeFiles = db.collection("committeeFiles");
  const result = await committeeFiles.updateMany(
    {meeting: {$exists: true}, "meeting.format": {$exists: false}},
    {$set: {"meeting.format": "online"}}
  );
  debugLog(`Backfilled online format on ${result.modifiedCount} already-folded meeting(s)`);
}

export async function up(db: Db, _client: MongoClient) {
  await foldVideoMeetingsOntoCommitteeFiles(db);
  await backfillMeetingFormat(db);
  await classifyCommitteeFileTypes(db);
  await renameMeetingsMenuItem(db);
}

export async function down(_db: Db, _client: MongoClient) {
  debugLog("No down migration; committee files keep their folded meeting details and file-type classification");
}
