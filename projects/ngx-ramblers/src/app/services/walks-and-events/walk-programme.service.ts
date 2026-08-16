import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom } from "rxjs";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalkProgrammeSummaryRequest, WalkProgrammeSummaryResponse } from "../../models/walk-programme.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { EventField, EventStartDateAscending, GroupEventField } from "../../models/walk.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { DataQueryOptions } from "../../models/api-request.model";
import { LocalWalksAndEventsService } from "./local-walks-and-events.service";
import { DateUtilsService } from "../date-utils.service";
import { DateTime } from "luxon";
import { DateRangeBounds } from "../../models/walk-programme.model";

export interface EventsInRangeParameters {
  dateFrom: number;
  dateTo: number;
  walksOnly: boolean;
}

@Injectable({
  providedIn: "root"
})
export class WalkProgrammeService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkProgrammeService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private localWalksAndEventsService = inject(LocalWalksAndEventsService);
  private dateUtils = inject(DateUtilsService);
  private BASE_URL = "/api/database/group-event";
  private CALENDAR_MAX_EVENTS = 500;

  async dateBounds(): Promise<DateRangeBounds> {
    const startOfToday: DateTime = this.dateUtils.dateTimeNowNoTime();
    try {
      const range = await this.localWalksAndEventsService.dateRange();
      return {
        minDate: range?.minDate ? this.dateUtils.asDateTime(range.minDate) : startOfToday,
        maxDate: range?.maxDate ? this.dateUtils.asDateTime(range.maxDate) : startOfToday.plus({years: 1})
      };
    } catch (error) {
      this.logger.error("dateBounds:error", error);
      return {minDate: startOfToday, maxDate: startOfToday.plus({years: 1})};
    }
  }

  private CALENDAR_SELECT = {
    events: 1,
    [GroupEventField.TITLE]: 1,
    [GroupEventField.ITEM_TYPE]: 1,
    [GroupEventField.START_DATE]: 1,
    [GroupEventField.END_DATE_TIME]: 1,
    [GroupEventField.URL]: 1,
    [GroupEventField.STATUS]: 1,
    [GroupEventField.SHAPE]: 1,
    [GroupEventField.DIFFICULTY]: 1,
    [GroupEventField.DISTANCE_MILES]: 1,
    [GroupEventField.WALK_LEADER_NAME]: 1,
    [GroupEventField.WALK_LEADER_ID]: 1,
    [GroupEventField.LOCATION]: 1,
    [GroupEventField.START_LOCATION]: 1,
    [GroupEventField.END_LOCATION]: 1,
    [EventField.CONTACT_DETAILS_DISPLAY_NAME]: 1,
    [EventField.CONTACT_DETAILS_MEMBER_ID]: 1,
    [EventField.INPUT_SOURCE]: 1,
    [EventField.GPX_FILE_AWS_FILE_NAME]: 1
  };

  async programmeSummary(request: WalkProgrammeSummaryRequest): Promise<WalkProgrammeSummaryResponse> {
    const params = this.toParams(request);
    this.logger.info("programmeSummary:request", request, "params", params.toString());
    return firstValueFrom(this.http.get<WalkProgrammeSummaryResponse>(`${this.BASE_URL}/programme-summary`, {params}));
  }

  async eventsInRange(parameters: EventsInRangeParameters): Promise<ExtendedGroupEvent[]> {
    const criteria: object = {
      [GroupEventField.START_DATE]: {
        $gte: this.dateUtils.isoDateTime(parameters.dateFrom),
        $lte: this.dateUtils.isoDateTime(parameters.dateTo)
      },
      ...(parameters.walksOnly ? {[GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK} : {})
    };
    const dataQueryOptions: DataQueryOptions = {
      criteria,
      select: this.CALENDAR_SELECT,
      sort: EventStartDateAscending,
      limit: this.CALENDAR_MAX_EVENTS
    };
    const apiResponse = await this.localWalksAndEventsService.allWithPagination(dataQueryOptions);
    const events = (apiResponse?.response || []) as ExtendedGroupEvent[];
    this.logger.info("eventsInRange:parameters", parameters, "returned", events.length, "events");
    return events;
  }

  async walksLedBy(identifiers: string[], dateFrom: number, dateTo: number): Promise<ExtendedGroupEvent[]> {
    const leaderIds = identifiers.filter(identifier => identifier);
    const criteria: object = {
      $and: [
        {[GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK},
        {
          [GroupEventField.START_DATE]: {
            $gte: this.dateUtils.isoDateTime(dateFrom),
            $lte: this.dateUtils.isoDateTime(dateTo)
          }
        },
        {
          $or: [
            {[EventField.CONTACT_DETAILS_MEMBER_ID]: {$in: leaderIds}},
            {[GroupEventField.WALK_LEADER_ID]: {$in: leaderIds}}
          ]
        }
      ]
    };
    const dataQueryOptions: DataQueryOptions = {
      criteria,
      select: this.CALENDAR_SELECT,
      sort: EventStartDateAscending,
      limit: this.CALENDAR_MAX_EVENTS
    };
    const apiResponse = await this.localWalksAndEventsService.allWithPagination(dataQueryOptions);
    return (apiResponse?.response || []) as ExtendedGroupEvent[];
  }

  private toParams(request: WalkProgrammeSummaryRequest): HttpParams {
    const record: Record<string, string> = {
      dateFrom: String(request.dateFrom),
      dateTo: String(request.dateTo),
      page: String(request.page || 1),
      limit: String(request.limit || 12),
      sortDirection: request.sortDirection || "asc"
    };
    if (request.status) {
      record.status = request.status;
    }
    return new HttpParams({fromObject: record});
  }
}
