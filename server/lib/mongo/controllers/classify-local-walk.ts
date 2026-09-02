import { isArray } from "es-toolkit/compat";
import { EventSource, InputSource } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventField, EventType } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { sortBy } from "../../../../projects/ngx-ramblers/src/app/functions/arrays";
import { dateTimeFromIso } from "../../shared/dates";
import { EventPopulation } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { LocalWalkStatus } from "../models/walk-admin.model";

const STATUS_CHANGE_EVENT_TYPES = [
  EventType.APPROVED,
  EventType.DELETED,
  EventType.AWAITING_LEADER,
  EventType.AWAITING_WALK_DETAILS,
  EventType.AWAITING_APPROVAL
];

function latestStatusEventType(events: any[]): EventType | null {
  const statusEvents = (isArray(events) ? events : [])
    .filter(event => STATUS_CHANGE_EVENT_TYPES.includes(event?.eventType))
    .sort(sortBy("-date"));
  return statusEvents[0]?.eventType || null;
}

export function walksManagerCachedWalk(walk: any): boolean {
  return walk?.source === EventSource.WALKS_MANAGER
    || walk?.fields?.inputSource === InputSource.WALKS_MANAGER_CACHE;
}

export function walksManagerSourceQuery(): Record<string, unknown> {
  return {
    $or: [
      {source: EventSource.WALKS_MANAGER},
      {[EventField.INPUT_SOURCE]: InputSource.WALKS_MANAGER_CACHE}
    ]
  };
}

export interface WalkStatBuckets {
  morning: any[];
  evening: any[];
  cancelled: any[];
  unfilled: any[];
}

export function classifyWalksManagerWalk(walk: any): LocalWalkStatus {
  const title = ((walk?.groupEvent?.title || "") as string).trim();
  const status = walk?.groupEvent?.status as string | undefined;
  const start = walk?.groupEvent?.start_date_time as string | undefined;
  if (status === "deleted") {
    return LocalWalkStatus.DELETED;
  } else if (status === "cancelled" || /cancelled/i.test(title)) {
    return LocalWalkStatus.CANCELLED;
  } else if (!start) {
    return LocalWalkStatus.MORNING;
  } else if (dateTimeFromIso(start).hour >= 15) {
    return LocalWalkStatus.EVENING;
  } else {
    return LocalWalkStatus.MORNING;
  }
}

export function bucketWalksForStats(walks: any[], nowMillis: number, population: EventPopulation): WalkStatBuckets {
  return (walks || []).reduce((buckets, walk) => {
    const status = population === EventPopulation.WALKS_MANAGER
      ? classifyWalksManagerWalk(walk)
      : classifyLocalWalk(walk, nowMillis);
    if (status === LocalWalkStatus.EVENING) {
      buckets.evening.push(walk);
    } else if (status === LocalWalkStatus.CANCELLED) {
      buckets.cancelled.push(walk);
    } else if (status === LocalWalkStatus.UNFILLED) {
      buckets.unfilled.push(walk);
    } else if (status === LocalWalkStatus.MORNING) {
      buckets.morning.push(walk);
    }
    return buckets;
  }, {morning: [], evening: [], cancelled: [], unfilled: []} as WalkStatBuckets);
}

export function walkStatsIdentity(walk: any): string {
  const groupEventId = (walk?.groupEvent?.id || "").toString().trim();
  const documentId = walk?._id?.toString?.() || "";
  if (groupEventId) {
    return groupEventId;
  } else if (documentId) {
    return documentId;
  } else {
    return `${(walk?.groupEvent?.title || "").trim()}|${walk?.groupEvent?.start_date_time || ""}`;
  }
}

export function mergeWalksByIdentity(cached: any[], remote: any[]): any[] {
  const byId = new Map<string, any>();
  (cached || []).forEach(walk => {
    const identity = walkStatsIdentity(walk);
    if (identity) {
      byId.set(identity, walk);
    }
  });
  (remote || []).forEach(walk => {
    const identity = walkStatsIdentity(walk);
    if (identity) {
      byId.set(identity, walk);
    }
  });
  return [...byId.values()];
}

export function classifyLocalWalk(walk: any, nowMillis: number): LocalWalkStatus {
  const events: any[] = isArray(walk.events) ? walk.events : [];
  const hasDeletedEvent = events.some(event => event?.eventType === EventType.DELETED);
  if (hasDeletedEvent) {
    return LocalWalkStatus.DELETED;
  } else {
    const title = ((walk.groupEvent?.title || "") as string).trim();
    const status = walk.groupEvent?.status as string | undefined;
    const start = walk.groupEvent?.start_date_time as string | undefined;
    const cancelledByStatus = status === "cancelled";
    const cancelledByTitle = /cancelled/i.test(title);
    const cancelled = cancelledByStatus || cancelledByTitle;
    if (cancelled) {
      return LocalWalkStatus.CANCELLED;
    } else if (!start) {
      return LocalWalkStatus.UNFILLED;
    } else {
      const dt = dateTimeFromIso(start);
      const pastOrToday = dt.toMillis() <= nowMillis;
      const awaitingLeader = latestStatusEventType(events) === EventType.AWAITING_LEADER;
      const emptyLocalSlot = !title || awaitingLeader;
      const treatAsUnfilled = pastOrToday && emptyLocalSlot && !walksManagerCachedWalk(walk);
      if (treatAsUnfilled) {
        return LocalWalkStatus.UNFILLED;
      } else if (dt.hour >= 15) {
        return LocalWalkStatus.EVENING;
      } else {
        return LocalWalkStatus.MORNING;
      }
    }
  }
}
