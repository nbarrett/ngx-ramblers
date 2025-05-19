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
import { EventType } from "../../models/walk.model";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { StringUtilsService } from "../string-utils.service";
import { WalksReferenceService } from "./walks-reference-data.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";

const auditedFields: string[] = [
  "fields.attachment",
  "fields.attendees",
  "fields.contactDetails",
  "fields.imageConfig",
  "fields.links",
  "fields.meetup",
  "fields.meetup",
  "fields.milesPerHour",
  "fields.publishing",
  "fields.riskAssessment",
  "fields.venue",
  "groupEvent.accessibility",
  "groupEvent.additional_details",
  "groupEvent.area_code",
  "groupEvent.ascent_feet",
  "groupEvent.ascent_metres",
  "groupEvent.cancellation_reason",
  "groupEvent.date_created",
  "groupEvent.date_updated",
  "groupEvent.description",
  "groupEvent.difficulty",
  "groupEvent.distance_km",
  "groupEvent.distance_miles",
  "groupEvent.duration",
  "groupEvent.end_date_time",
  "groupEvent.end_location",
  "groupEvent.event_organiser",
  "groupEvent.external_url",
  "groupEvent.facilities",
  "groupEvent.group_code",
  "groupEvent.group_name",
  "groupEvent.item_type",
  "groupEvent.linked_event",
  "groupEvent.location",
  "groupEvent.media",
  "groupEvent.meeting_date_time",
  "groupEvent.meeting_location",
  "groupEvent.shape",
  "groupEvent.start_date_time",
  "groupEvent.start_location",
  "groupEvent.status",
  "groupEvent.title",
  "groupEvent.transport",
  "groupEvent.url",
  "groupEvent.walk_leader",
];

@Injectable({
  providedIn: "root"
})
export class GroupEventService {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventService", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private dateUtils = inject(DateUtilsService);
  private walksReferenceService = inject(WalksReferenceService);
  private stringUtils = inject(StringUtilsService);
  private auditDeltaChangedItems = inject(AuditDeltaChangedItemsPipePipe);

  public latestEventWithStatusChange(walk: ExtendedGroupEvent): WalkEvent {
    const eventType = this.eventsLatestFirst(walk).find((event) => {
      const walkEventType = this.walksReferenceService.toWalkEventType(event.eventType);
      return walkEventType && walkEventType.statusChange;
    });
    this.logger.debug("latestEventWithStatusChange:walk", walk.id, "eventType =>", eventType);
    return eventType;
  }

  public walkDataAuditFor(walk: ExtendedGroupEvent, status: EventType, basedOnUnsavedData: boolean): WalkDataAudit {
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
        notificationRequired: dataChanged || !eventExists || this.latestEvent(walk)?.eventType === EventType.WALK_DETAILS_COPIED,
        eventType: dataChanged && eventExists ? this.walksReferenceService.walkEventTypeMappings.walkDetailsUpdated.eventType : status
      };
    }
  }

  public latestEventWithStatusChangeIs(walk: ExtendedGroupEvent, eventType: EventType) {
    if (!walk) {
      return false;
    }
    const walkEvent = this.latestEventWithStatusChange(walk);
    return walkEvent ? walkEvent.eventType === this.walksReferenceService.toEventType(eventType) : false;
  }

  public createEventIfRequired(walk: ExtendedGroupEvent, status: EventType, reason: string): WalkEvent {
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

  public writeEventIfRequired(walk: ExtendedGroupEvent, event: WalkEvent): void {
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

  public latestEvent(walk: ExtendedGroupEvent): WalkEvent {
    return last(walk?.events);
  }

  private currentPreviousData(walk: ExtendedGroupEvent, basedOnUnsavedData: boolean): CurrentPreviousData {
    if (basedOnUnsavedData) {
      return {currentData: pick(walk, auditedFields), previousData: this.latestEvent(walk)?.data};
    } else {
      const latest2Events: WalkEvent[] = takeRight(walk.events, 2);
      const currentData = latest2Events.length === 2 ? latest2Events[1]?.data : latest2Events[0]?.data;
      const previousData = latest2Events.length === 2 ? latest2Events[0]?.data : null;
      return {currentData, previousData};
    }
  }

  private eventsLatestFirst(walk: ExtendedGroupEvent) {
    return walk.events && clone(walk.events).reverse() || [];
  }

  private calculateChangedItems(currentData: object, previousData: object): ChangedItem[] {
    return compact(auditedFields.map((key) => {
      const currentValue = get(currentData, key.split("."));
      const previousValue = get(previousData, key.split("."));
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
