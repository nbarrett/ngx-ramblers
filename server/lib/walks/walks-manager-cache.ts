import debug from "debug";
import mongoose from "mongoose";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  EventSource,
  ExtendedGroupEvent,
  GroupEvent,
  InputSource
} from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { EventField, GroupEventField, LinkSource } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { isMeetupUrl, mapRamblersEventToExtendedGroupEvent, mergeFieldsOnSync } from "../../../projects/ngx-ramblers/src/app/functions/walks/ramblers-event.mapper";
import { leaderMatchResult, priorMatchesFromWalks, shouldAutoLinkLeaderMatch } from "../../../projects/ngx-ramblers/src/app/functions/walks/walk-leader-member-match";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { PriorContactMemberMatch } from "../../../projects/ngx-ramblers/src/app/models/walk-leader-match.model";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { member } from "../mongo/models/member";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow, dateTimeFromJsDate } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("walks-manager-cache"));
debugLog.enabled = false;

interface CacheAction {
  document: mongoose.Document | null;
  action: "added" | "updated" | "none";
}

function groupNameFrom(config: SystemConfig, event: GroupEvent): string {
  return event?.group_name || config?.group?.longName || "Unknown Group";
}

function sourceFromInputSource(inputSource: InputSource): EventSource {
  switch (inputSource) {
    case InputSource.MANUALLY_CREATED:
    case InputSource.FILE_IMPORT:
      return EventSource.LOCAL;
    default:
      return EventSource.WALKS_MANAGER;
  }
}

export function toExtendedGroupEvent(config: SystemConfig, event: GroupEvent, inputSource: InputSource = InputSource.WALKS_MANAGER_CACHE): ExtendedGroupEvent {
  const groupEvent: GroupEvent = {
    ...event,
    item_type: event.item_type || RamblersEventType.GROUP_WALK,
    group_code: event.group_code || config?.group?.groupCode,
    group_name: groupNameFrom(config, event),
    area_code: event.area_code || config?.area?.groupCode
  };

  return mapRamblersEventToExtendedGroupEvent(groupEvent, {
    inputSource,
    additionalLinksBuilder: event => isMeetupUrl(event.external_url) ? [{source: LinkSource.MEETUP, href: event.external_url, title: event.title}] : []
  });
}

async function upsertEvent(config: SystemConfig, event: GroupEvent, inputSource: InputSource): Promise<CacheAction> {
  const members = await membersForLeaderMatching();
  const priorMatches = await priorMatchesForLeaderMatching();
  return upsertEventWithMembers(config, event, inputSource, members, priorMatches);
}

export async function cacheEventIfNotFound(config: SystemConfig, event: GroupEvent, inputSource: InputSource = InputSource.WALKS_MANAGER_CACHE): Promise<mongoose.Document | null> {
  const result = await upsertEvent(config, event, inputSource);
  return result.document;
}

export interface CacheStats {
  added: number;
  updated: number;
}

export interface DuplicateDetail {
  groupEventId: string;
  keptDocId: string;
  deletedDocIds: string[];
}

export interface CleanupStats {
  duplicatesRemoved: number;
  ramblersIdsProcessed: number;
  details: DuplicateDetail[];
}

export async function cleanupDuplicatesByRamblersId(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    duplicatesRemoved: 0,
    ramblersIdsProcessed: 0,
    details: []
  };

  const duplicates = await extendedGroupEvent.aggregate([
    {
      $match: {
        [GroupEventField.ID]: { $ne: null, $exists: true }
      }
    },
    {
      $group: {
        _id: `$${GroupEventField.ID}`,
        count: { $sum: 1 },
        docs: {
          $push: {
            docId: "$_id",
            syncedVersion: "$syncedVersion",
            lastSyncedAt: "$lastSyncedAt"
          }
        }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]).exec();

  debugLog(`Found ${duplicates.length} groupEvent.id values with duplicates`);

  const deletePromises = duplicates.map(async (group: { _id: string; count: number; docs: { docId: string; syncedVersion: number; lastSyncedAt: Date }[] }) => {
    stats.ramblersIdsProcessed++;
    const sortedDocs = group.docs.sort((a, b) => {
      const versionDiff = (b.syncedVersion || 0) - (a.syncedVersion || 0);
      if (versionDiff !== 0) {
        return versionDiff;
      }
      const aTime = a.lastSyncedAt ? dateTimeFromJsDate(a.lastSyncedAt).toMillis() : 0;
      const bTime = b.lastSyncedAt ? dateTimeFromJsDate(b.lastSyncedAt).toMillis() : 0;
      return bTime - aTime;
    });

    const idsToDelete = sortedDocs.slice(1).map(doc => doc.docId.toString());
    debugLog(`groupEvent.id ${group._id}: keeping doc ${sortedDocs[0].docId}, deleting ${idsToDelete.length} duplicates`);

    if (idsToDelete.length > 0) {
      stats.details.push({
        groupEventId: group._id,
        keptDocId: sortedDocs[0].docId.toString(),
        deletedDocIds: idsToDelete
      });
      const deleteResult = await extendedGroupEvent.deleteMany({
        _id: { $in: idsToDelete }
      }).exec();
      stats.duplicatesRemoved += deleteResult.deletedCount || 0;
    }
  });

  await Promise.all(deletePromises);

  debugLog(`Cleanup complete: removed ${stats.duplicatesRemoved} duplicates across ${stats.ramblersIdsProcessed} groupEvent.id values`);
  return stats;
}

export async function cacheEventsWithStats(config: SystemConfig, events: GroupEvent[], inputSource: InputSource): Promise<CacheStats> {
  const members = await membersForLeaderMatching();
  const priorMatches = await priorMatchesForLeaderMatching();
  const results = await Promise.all(events.map(event => upsertEventWithMembers(config, event, inputSource, members, priorMatches)));
  return {
    added: results.filter(result => result.action === "added").length,
    updated: results.filter(result => result.action === "updated").length
  };
}

async function upsertEventWithMembers(config: SystemConfig, event: GroupEvent, inputSource: InputSource, members: Member[], priorMatches: PriorContactMemberMatch[]): Promise<CacheAction> {
  try {
    let existingEvent = null;
    if (event.id) {
      existingEvent = await extendedGroupEvent.findOne({
        [GroupEventField.ID]: event.id
      }).exec();
      debugLog("Searching by groupEvent.id:", event.id, "found:", !!existingEvent);
    }
    if (!existingEvent) {
      existingEvent = await extendedGroupEvent.findOne({
        [GroupEventField.START_DATE]: event.start_date_time,
        [GroupEventField.TITLE]: event.title,
        [GroupEventField.ITEM_TYPE]: event.item_type || RamblersEventType.GROUP_WALK,
        [GroupEventField.GROUP_CODE]: event.group_code || config?.group?.groupCode,
      }).exec();
      debugLog("Fallback search by date/title/group found:", !!existingEvent);
    }

    const mappedEvent = toExtendedGroupEvent(config, event, inputSource);
    const groupEvent = {
      ...mappedEvent.groupEvent,
      url: event.url,
      id: event.id,
      start_date_time: event.start_date_time,
      title: event.title
    };
    const freshFields = {
      ...mappedEvent.fields,
      inputSource
    };
    const contactDetailsForMatch = {
      ...freshFields.contactDetails,
      displayName: freshFields?.contactDetails?.displayName || freshFields?.publishing?.ramblers?.contactName || null
    };
    const match = leaderMatchResult(members, contactDetailsForMatch, priorMatches);
    if (shouldAutoLinkLeaderMatch(match)) {
      freshFields.contactDetails.memberId = match.member.id;
    }
    const syncMetadata = {
      source: sourceFromInputSource(inputSource),
      ramblersId: event.id,
      lastSyncedAt: dateTimeNow().toJSDate()
    };

    if (existingEvent) {
      const existingFields = (existingEvent.toObject() as ExtendedGroupEvent).fields || {} as ExtendedGroupEvent["fields"];
      const fields = mergeFieldsOnSync(existingFields, freshFields);
      await extendedGroupEvent.updateOne(
        {_id: existingEvent._id},
        {
          $set: {groupEvent, fields, ...syncMetadata},
          $inc: {syncedVersion: 1}
        }
      ).exec();
      debugLog("Updated existing event:", event.url);
      return {document: existingEvent, action: "updated"};
    } else {
      const document = {
        ...mappedEvent,
        groupEvent,
        fields: freshFields,
        ...syncMetadata
      };
      const created = await extendedGroupEvent.create(document);
      debugLog("Cached new event:", event.url, "event id:", event.id, "group code:", document.groupEvent.group_code);
      return {document: created, action: "added"};
    }
  } catch (error) {
    debugLog("upsertEventWithMembers:error:", error);
    throw error;
  }
}

async function membersForLeaderMatching(): Promise<Member[]> {
  const members = await member.find({}, {
    displayName: 1,
    email: 1,
    mobileNumber: 1,
    contactId: 1,
    firstName: 1,
    lastName: 1
  }).lean().exec() as any[];
  return members.map(existingMember => ({
    id: existingMember.id || existingMember._id?.toString(),
    displayName: existingMember.displayName,
    email: existingMember.email,
    mobileNumber: existingMember.mobileNumber,
    contactId: existingMember.contactId,
    firstName: existingMember.firstName || "",
    lastName: existingMember.lastName || ""
  }));
}

async function priorMatchesForLeaderMatching(): Promise<PriorContactMemberMatch[]> {
  const matchedWalks = await extendedGroupEvent.find({
    [EventField.CONTACT_DETAILS_CONTACT_ID]: {$ne: null},
    [EventField.CONTACT_DETAILS_MEMBER_ID]: {$ne: null}
  }, {
    [EventField.CONTACT_DETAILS]: 1
  }).lean().exec() as ExtendedGroupEvent[];
  return priorMatchesFromWalks(matchedWalks);
}
