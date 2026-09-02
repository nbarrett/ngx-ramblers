import { isArray, kebabCase } from "es-toolkit/compat";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";
import {
  LeaderStats,
  WalkAGMStats,
  WalkListItem
} from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { EventPopulation, SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import {
  historicalLeaderTokens,
  isUnknownWalkLeader,
  leaderStatsFromWalks,
  newLeadersFromPeriod
} from "../../../../projects/ngx-ramblers/src/app/functions/agm-leader-stats";
import { trimmedNamePart } from "../../../../projects/ngx-ramblers/src/app/functions/member-names";
import { walksManagerWalkLeaderNameFromGroupEvent } from "../../../../projects/ngx-ramblers/src/app/functions/walks/walk-leader-fields";
import { dateTimeFromIso, dateTimeFromMillis, dateTimeNowAsValue } from "../../shared/dates";
import { systemConfig } from "../../config/system-config";
import { fetchMappedEvents } from "../../ramblers/list-events";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { extendedGroupEvent } from "../models/extended-group-event";
import {
  WalkStatBuckets,
  bucketWalksForStats,
  mergeWalksByIdentity,
  walksManagerSourceQuery
} from "./classify-local-walk";

const debugLog = debug(envConfig.logNamespace("walk-stats-agm"));
debugLog.enabled = false;

const emptyLeader: LeaderStats = {
  id: "",
  name: "None",
  email: "",
  walkCount: 0,
  totalMiles: 0
};

export function totalMilesFromWalks(walks: {groupEvent?: {distance_miles?: number}}[]): number {
  const miles = (walks || []).reduce((sum, walk) => sum + (walk?.groupEvent?.distance_miles || 0), 0);
  return Math.round(miles * 10) / 10;
}

export function attendeeCountFromWalks(walks: any[]): number {
  return (walks || []).reduce((sum, walk) => {
    const attendees = walk?.fields?.attendees;
    return sum + (isArray(attendees) ? attendees.length : 0);
  }, 0);
}

export function walkAgmStatsFromBuckets(
  buckets: WalkStatBuckets,
  leaders: LeaderStats[],
  newLeaders: LeaderStats[],
  preferWalksManagerNames: boolean
): WalkAGMStats {
  const ledWalks = [...buckets.morning, ...buckets.evening];
  const namedLeaders = leaders.filter(leader => !isUnknownWalkLeader(leader));
  return {
    totalWalks: buckets.morning.length + buckets.evening.length + buckets.cancelled.length + buckets.unfilled.length,
    confirmedWalks: ledWalks.length,
    morningWalks: buckets.morning.length,
    cancelledWalks: buckets.cancelled.length,
    cancelledWalksList: buckets.cancelled.map(walk => formatWalkListItem(walk, preferWalksManagerNames)),
    eveningWalks: buckets.evening.length,
    eveningWalksList: buckets.evening.map(walk => formatWalkListItem(walk, preferWalksManagerNames)),
    totalMiles: totalMilesFromWalks(ledWalks),
    totalAttendees: attendeeCountFromWalks(ledWalks),
    activeLeaders: namedLeaders.length,
    newLeaders: newLeaders.length,
    newLeadersList: newLeaders,
    topLeader: namedLeaders[0] || emptyLeader,
    allLeaders: leaders,
    unfilledSlots: buckets.unfilled.length,
    unfilledSlotsList: buckets.unfilled.map(walk => formatWalkListItem(walk, preferWalksManagerNames)),
    morningWalksList: buckets.morning.map(walk => formatWalkListItem(walk, preferWalksManagerNames))
  };
}

function formatWalkListItem(walk: any, preferWalksManagerNames: boolean): WalkListItem {
  const walkId = walk._id?.toString() || walk.groupEvent?.id || "";
  const title = walk.groupEvent?.title || "";
  const startDate = walk.groupEvent?.start_date_time;
  const dateStr = startDate ? dateTimeFromIso(startDate).toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES) : "";
  const urlSlug = walk.groupEvent?.url
    || kebabCase([title, dateStr].filter(Boolean).join("-"))
    || walk.groupEvent?.id
    || walkId;
  const lastSegment = (urlSlug || "").split("/").pop() || urlSlug;
  const walkLeaderFromManager = walksManagerWalkLeaderNameFromGroupEvent(walk.groupEvent);
  const walkLeaderFromFields = trimmedNamePart(walk.fields?.contactDetails?.displayName);
  const walkLeader = preferWalksManagerNames
    ? walkLeaderFromManager || walkLeaderFromFields || ""
    : walkLeaderFromFields || walkLeaderFromManager || "";
  const startMillis = startDate ? dateTimeFromIso(startDate).toMillis() : 0;
  return {
    id: walkId,
    title,
    startDate: startMillis,
    walkDate: startDate || "",
    walkLeader,
    distance: walk.groupEvent?.distance_miles || 0,
    url: `/walks/${lastSegment}`
  };
}

function walksInRangeQuery(fromDate: number, toDate: number): Record<string, unknown> {
  return {
    [`${GroupEventField.ITEM_TYPE}`]: RamblersEventType.GROUP_WALK,
    [`${GroupEventField.START_DATE}`]: {
      $gte: dateTimeFromMillis(fromDate).toISO(),
      $lte: dateTimeFromMillis(toDate).toISO()
    },
    [`${GroupEventField.STATUS}`]: {$ne: "deleted"}
  };
}

async function allHistoricalLeaders(beforeDate: number, population: EventPopulation): Promise<Set<string>> {
  const query = {
    [`${GroupEventField.ITEM_TYPE}`]: RamblersEventType.GROUP_WALK,
    [`${GroupEventField.START_DATE}`]: {
      $lt: dateTimeFromMillis(beforeDate).toISO()
    },
    [`${GroupEventField.STATUS}`]: {$nin: ["cancelled", "deleted"]},
    ...(population === EventPopulation.WALKS_MANAGER ? walksManagerSourceQuery() : {})
  };
  const walks = await extendedGroupEvent.find(query).select({
    "fields.contactDetails": 1,
    "fields.inputSource": 1,
    "groupEvent.walk_leader": 1,
    "groupEvent.title": 1,
    "groupEvent.status": 1,
    "groupEvent.start_date_time": 1,
    source: 1,
    events: 1
  }).lean();
  const buckets = bucketWalksForStats(walks, beforeDate, population);
  return historicalLeaderTokens([...buckets.morning, ...buckets.evening]);
}

async function statsFromWalks(
  walks: any[],
  fromDate: number,
  population: EventPopulation
): Promise<WalkAGMStats> {
  const buckets = bucketWalksForStats(walks, dateTimeNowAsValue(), population);
  const leaders = leaderStatsFromWalks([...buckets.morning, ...buckets.evening]);
  const historicalLeaders = await allHistoricalLeaders(fromDate, population);
  const newLeaders = newLeadersFromPeriod(
    leaders.filter(leader => !isUnknownWalkLeader(leader)),
    historicalLeaders
  );
  return walkAgmStatsFromBuckets(buckets, leaders, newLeaders, population === EventPopulation.WALKS_MANAGER);
}

async function localWalkStats(fromDate: number, toDate: number): Promise<WalkAGMStats> {
  const walks = await extendedGroupEvent.find(walksInRangeQuery(fromDate, toDate))
    .sort({[`${GroupEventField.START_DATE}`]: 1})
    .lean();
  return statsFromWalks(walks, fromDate, EventPopulation.LOCAL);
}

async function walksManagerWalkStats(config: SystemConfig, fromDate: number, toDate: number): Promise<WalkAGMStats> {
  const cached = await extendedGroupEvent.find({
    ...walksInRangeQuery(fromDate, toDate),
    ...walksManagerSourceQuery()
  }).sort({[`${GroupEventField.START_DATE}`]: 1}).lean();
  const remoteWalks = await fetchMappedEvents(config, fromDate, toDate)
    .then(events => (events || []).filter(event => event?.groupEvent?.item_type === RamblersEventType.GROUP_WALK))
    .catch(error => {
      debugLog("Walks Manager events could not be fetched for stats; using the cached copy", error);
      return [];
    });
  const walks = remoteWalks.length
    ? mergeWalksByIdentity(cached, remoteWalks)
    : cached;
  return statsFromWalks(walks, fromDate, EventPopulation.WALKS_MANAGER);
}

export async function calculateWalkStats(fromDate: number, toDate: number): Promise<WalkAGMStats> {
  const config = await systemConfig();
  if (config.group.walkPopulation === EventPopulation.WALKS_MANAGER) {
    return walksManagerWalkStats(config, fromDate, toDate);
  } else {
    return localWalkStats(fromDate, toDate);
  }
}
