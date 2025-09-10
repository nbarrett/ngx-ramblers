import { cloneDeep } from "es-toolkit/compat";
import { compact } from "es-toolkit/compat";
import { get } from "es-toolkit/compat";
import { isArray } from "es-toolkit/compat";
import { pick } from "es-toolkit/compat";
import { take } from "es-toolkit/compat";
import { AUDITED_FIELDS, WalkEvent } from "../../models/walk-event.model";
import { AuditDeltaChangedItemsPipePipe } from "../../pipes/audit-delta-changed-items.pipe";
import { ChangedItem } from "../../models/changed-item.model";
import { CurrentPreviousData } from "../../models/walk-notification.model";
import { DateUtilsService } from "../date-utils.service";
import { EventType } from "../../models/walk.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MemberLoginService } from "../member/member-login.service";
import { NgxLoggerLevel } from "ngx-logger";
import { StringUtilsService } from "../string-utils.service";
import { WalkDataAudit } from "../../models/walk-data-audit.model";
import { WalksReferenceService } from "../walks/walks-reference-data.service";
import { inject, Injectable } from "@angular/core";
import { sortBy } from "../../functions/arrays";

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

  public latestEventWithStatusChange(extendedGroupEvent: ExtendedGroupEvent): WalkEvent {
    const eventType = this.eventsLatestFirst(extendedGroupEvent).find((event) => {
      const walkEventType = this.walksReferenceService.toWalkEventType(event.eventType);
      return walkEventType && walkEventType.statusChange;
    });
    this.logger.debug("latestEventWithStatusChange:extendedGroupEvent", extendedGroupEvent?.id, "eventType =>", eventType);
    return eventType;
  }

  public walkDataAuditFor(extendedGroupEvent: ExtendedGroupEvent, status: EventType, basedOnUnsavedData: boolean): WalkDataAudit {
    if (extendedGroupEvent) {
      if (!isArray(extendedGroupEvent?.events)) {
        this.logger.warn("events array is not initialised", extendedGroupEvent);
        extendedGroupEvent.events = [];
      }
      const eventsLatestFirst: WalkEvent[] = this.eventsLatestFirst(extendedGroupEvent);
      const {
        currentData,
        previousData
      } = this.currentPreviousData(eventsLatestFirst, extendedGroupEvent, basedOnUnsavedData);
      const changedItems = this.calculateChangedItems(currentData, previousData);
      const eventExists = this.latestEventWithStatusChangeIs(extendedGroupEvent, status);
      const dataChanged = changedItems.length > 0;
      return {
        currentData,
        previousData,
        changedItems,
        eventExists,
        dataChanged,
        notificationRequired: dataChanged || !eventExists || this.latestEvent(extendedGroupEvent)?.eventType === EventType.WALK_DETAILS_COPIED,
        eventType: dataChanged && eventExists ? this.walksReferenceService.walkEventTypeMappings.walkDetailsUpdated.eventType : status
      };
    }
  }

  public latestEventWithStatusChangeIs(extendedGroupEvent: ExtendedGroupEvent, eventType: EventType) {
    if (!extendedGroupEvent) {
      return false;
    }
    const walkEvent = this.latestEventWithStatusChange(extendedGroupEvent);
    return walkEvent ? walkEvent.eventType === this.walksReferenceService.toEventType(eventType) : false;
  }

  public createEventIfRequired(extendedGroupEvent: ExtendedGroupEvent, status: EventType, reason: string): WalkEvent {
    const walkDataAudit = this.walkDataAuditFor(extendedGroupEvent, status, true);
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

  public writeEventIfRequired(extendedGroupEvent: ExtendedGroupEvent, event: WalkEvent): void {
    if (event) {
      if (!isArray(extendedGroupEvent?.events)) {
        extendedGroupEvent.events = [];
      }
      if (extendedGroupEvent?.events.includes(event)) {
        this.logger.warn("extendedGroupEvent already contains event", event);
      } else {
        this.logger.debug("writing event", event);
        extendedGroupEvent.events.push(event);
      }
    } else {
      this.logger.debug("no event to write");
    }
  }

  public latestEvent(extendedGroupEvent: ExtendedGroupEvent): WalkEvent {
    return this.eventsLatestFirst(extendedGroupEvent)?.[0];
  }

  private currentPreviousData(eventsLatestFirst: WalkEvent[], extendedGroupEvent: ExtendedGroupEvent, basedOnUnsavedData: boolean): CurrentPreviousData {
    if (basedOnUnsavedData) {
      const currentData = pick(extendedGroupEvent, AUDITED_FIELDS);
      const latestEvent = eventsLatestFirst?.[0];
      const previousData = latestEvent?.data;
      this.logger.info("currentPreviousData: basedOnUnsavedData:", basedOnUnsavedData, "currentData:", currentData, "previousData:", previousData, "latestEvent:", latestEvent);
      return {currentData, previousData};
    } else {
      const latest2Events: WalkEvent[] = take(eventsLatestFirst, 2);
      const currentData = latest2Events.length === 2 ? latest2Events[0]?.data || null : latest2Events[1]?.data || null;
      const previousData = latest2Events.length === 2 ? latest2Events[1]?.data : null;
      this.logger.info("currentPreviousData: basedOnUnsavedData:", basedOnUnsavedData, "currentData:", currentData, "previousData:", previousData);
      return {currentData, previousData};
    }
  }

  private eventsLatestFirst(extendedGroupEvent: ExtendedGroupEvent): WalkEvent[] {
    const events = cloneDeep(extendedGroupEvent?.events)?.sort(sortBy("-date")) || [];
    this.logger.off("eventsLatestFirst:", events);
    return events;
  }

  private calculateChangedItems(currentData: object, previousData: object): ChangedItem[] {
    return compact(AUDITED_FIELDS.map((key) => {
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
