import { inject, Injectable } from "@angular/core";
import clone from "lodash-es/clone";
import compact from "lodash-es/compact";
import get from "lodash-es/get";
import isArray from "lodash-es/isArray";
import last from "lodash-es/last";
import pick from "lodash-es/pick";
import takeRight from "lodash-es/takeRight";
import { NgxLoggerLevel } from "ngx-logger";
import { ChangedItem } from "../../models/changed-item.model";
import { WalkDataAudit } from "../../models/walk-data-audit.model";
import { WalkEvent } from "../../models/walk-event.model";
import { CurrentPreviousData } from "../../models/walk-notification.model";
import { EventType, Walk } from "../../models/walk.model";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { StringUtilsService } from "../string-utils.service";
import { WalksReferenceService } from "./walks-reference-data.service";

const auditedFields: string[] = [
  "ascent",
  "briefDescriptionAndStartPoint",
  "config",
  "contactEmail",
  "contactId",
  "contactName",
  "contactPhone",
  "displayName",
  "distance",
  "end_location",
  "features",
  "finishTime",
  "grade",
  "group",
  "longerDescription",
  "media",
  "meetupEventDescription",
  "meetupEventTitle",
  "meetupEventUrl",
  "meetupPublish",
  "milesPerHour",
  "osMapsRoute",
  "osMapsTitle",
  "ramblersPublish",
  "ramblersWalkId",
  "ramblersWalkUrl",
  "riskAssessment",
  "startLocation",
  "startLocationW3w",
  "startTime",
  "start_location",
  "venue",
  "walkDate",
  "walkLeaderMemberId",
  "walkType",
];


@Injectable({
  providedIn: "root"
})
export class WalkEventService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkEventService", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private dateUtils = inject(DateUtilsService);
  private walksReferenceService = inject(WalksReferenceService);
  private stringUtils = inject(StringUtilsService);
  private auditDeltaChangedItems = inject(AuditDeltaChangedItemsPipePipe);

  public latestEventWithStatusChange(walk: Walk): WalkEvent {
    const eventType = this.eventsLatestFirst(walk).find((event) => {
      const walkEventType = this.walksReferenceService.toWalkEventType(event.eventType);
      return walkEventType && walkEventType.statusChange;
    });
    this.logger.debug("latestEventWithStatusChange:walk", walk.id, "eventType =>", eventType);
    return eventType;
  }

  public walkDataAuditFor(walk: Walk, status: EventType, basedOnUnsavedData: boolean): WalkDataAudit {
    if (walk) {
      const {currentData, previousData} = this.currentPreviousData(walk, basedOnUnsavedData);
      const changedItems = this.calculateChangedItems(currentData, previousData);
      const eventExists = this.latestEventWithStatusChangeIs(walk, status);
      const dataChanged = changedItems.length > 0;
      return {
        currentData,
        previousData,
        changedItems,
        eventExists,
        dataChanged,
        notificationRequired: dataChanged || !eventExists || this.latestEvent(walk).eventType === EventType.WALK_DETAILS_COPIED,
        eventType: dataChanged && eventExists ? this.walksReferenceService.walkEventTypeMappings.walkDetailsUpdated.eventType : status
      };
    }
  }

  public latestEventWithStatusChangeIs(walk: Walk, eventType: EventType) {
    if (!walk) {
      return false;
    }
    const walkEvent = this.latestEventWithStatusChange(walk);
    return walkEvent ? walkEvent.eventType === this.walksReferenceService.toEventType(eventType) : false;
  }

  public createEventIfRequired(walk: Walk, status: EventType, reason: string): WalkEvent {
    const walkDataAudit = this.walkDataAuditFor(walk, status, true);
    this.logger.debug("createEventIfRequired given status:", status, "walkDataAudit:", walkDataAudit);
    if (walkDataAudit.notificationRequired) {
      const event = {
        date: this.dateUtils.nowAsValue(),
        memberId: this.memberLoginService.loggedInMember().memberId,
        data: walkDataAudit.currentData,
        eventType: walkDataAudit.eventType
      } as WalkEvent;
      if (reason) {
        event.reason = reason;
      }
      if (walkDataAudit.dataChanged) {
        event.description = "Changed: " + this.auditDeltaChangedItems.transform(walkDataAudit.changedItems);
      }
      this.logger.debug("createEventIfRequired: event created:", event);
      return event;
    } else {
      this.logger.debug("createEventIfRequired: event creation not necessary");
    }
  }

  public writeEventIfRequired(walk: Walk, event: WalkEvent): void {
    if (event) {
      if (!isArray(walk.events)) {
        walk.events = [];
      }
      if (walk.events.includes(event)) {
        this.logger.warn("walk already contains event", event);
      } else {
        this.logger.debug("writing event", event);
        walk.events.push(event);
      }
    } else {
      this.logger.debug("no event to write");
    }
  }

  public latestEvent(walk): WalkEvent {
    return last(walk?.events);
  }

  private currentPreviousData(walk: Walk, basedOnUnsavedData: boolean): CurrentPreviousData {
    if (basedOnUnsavedData) {
      return {currentData: pick(walk, auditedFields), previousData: this.latestEvent(walk)?.data};
    } else {
      const latest2Events: WalkEvent[] = takeRight(walk.events, 2);
      const currentData = latest2Events.length === 2 ? latest2Events[1]?.data : latest2Events[0]?.data;
      const previousData = latest2Events.length === 2 ? latest2Events[0]?.data : undefined;
      return {currentData, previousData};
    }
  }

  private eventsLatestFirst(walk: Walk) {
    return walk.events && clone(walk.events).reverse() || [];
  }

  private calculateChangedItems(currentData: object, previousData: object): ChangedItem[] {
    return compact(auditedFields.map((key) => {
      const currentValue = get(currentData, [key]);
      const previousValue = get(previousData, [key]);
      if (this.stringUtils.stringifyObject(previousValue) !== this.stringUtils.stringifyObject(currentValue)) {
        return {
          fieldName: key,
          previousValue,
          currentValue
        };
      }
    }));
  }

}
