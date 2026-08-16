import { isArray } from "es-toolkit/compat";
import { EventSource, InputSource } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventType } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { sortBy } from "../../../../projects/ngx-ramblers/src/app/functions/arrays";
import { dateTimeFromIso } from "../../shared/dates";
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
