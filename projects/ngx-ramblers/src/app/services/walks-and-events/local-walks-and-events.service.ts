import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { EventField, GroupEventField, WalkLeaderIdsApiResponse, WalkLeaderLabelRecord } from "../../models/walk.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { StringUtilsService } from "../string-utils.service";
import { SearchDateRange } from "../../models/search.model";
import { DateUtilsService } from "../date-utils.service";
import { ExtendedGroupEvent, ExtendedGroupEventApiResponse } from "../../models/group-event.model";
import { DeleteDocumentsRequest } from "../../models/member.model";
import { DeletionResponse, DeletionResponseApiResponse } from "../../models/mongo-models";
import { EventQueryParameters } from "../../models/ramblers-walks-manager";
import { ExtendedGroupEventQueryService } from "./extended-group-event-query.service";

@Injectable({
  providedIn: "root"
})
export class LocalWalksAndEventsService {

  private logger: Logger = inject(LoggerFactory).createLogger("LocalWalksAndEventsService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private commonDataService: CommonDataService = inject(CommonDataService);
  private extendedGroupEventQueryService: ExtendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private BASE_URL = "/api/database/group-event";
  private extendedGroupEventApiResponseSubject = new Subject<ExtendedGroupEventApiResponse>();
  private walkLeaderIdNotifications = new Subject<WalkLeaderIdsApiResponse>();
  private leaderLabelLookup = new Map<string, string>();
  private leaderRecords: WalkLeaderLabelRecord[] = [];
  publicFieldsDataQueryOptions: DataQueryOptions = {
    select: {
      [GroupEventField.ID]: 1,
      [GroupEventField.TITLE]: 1,
      [GroupEventField.ITEM_TYPE]: 1,
      [GroupEventField.START_DATE]: 1,
      [GroupEventField.LOCATION_DESCRIPTION]: 1,
      [GroupEventField.DESCRIPTION]: 1,
      [GroupEventField.MEDIA]: 1,
      [GroupEventField.URL]: 1,
      [GroupEventField.GROUP_CODE]: 1,
      [EventField.ATTACHMENT]: 1,
    }
  };

  notifications(): Observable<ExtendedGroupEventApiResponse> {
    return this.extendedGroupEventApiResponseSubject.asObservable();
  }

  async dateRange(): Promise<{ minDate: number | null; maxDate: number | null }> {
    const response = await firstValueFrom(this.http.get<{ minDate: number | null; maxDate: number | null }>(`${this.BASE_URL}/date-range`));
    return response;
  }

  urlFromTitle(title: string, id: string): Promise<string> {
    return this.http.post<{ url: string }>(this.BASE_URL + "/url-from-title", {title, id})
      .toPromise()
      .then(response => response.url);
  }

  async all(eventQueryParameters?: EventQueryParameters): Promise<ExtendedGroupEvent[]> {
    const dataQueryOptions: DataQueryOptions = this.extendedGroupEventQueryService.dataQueryOptionsFrom(eventQueryParameters);
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.info("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all`, {params}), this.extendedGroupEventApiResponseSubject);
    return apiResponse.response as ExtendedGroupEvent[];
  }

  async allWithPagination(dataQueryOptions: DataQueryOptions): Promise<ExtendedGroupEventApiResponse> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.info("allWithPagination:dataQueryOptions", dataQueryOptions, "params", params.toString());
    return await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all`, {params}), this.extendedGroupEventApiResponseSubject);
  }

  async allPublic(eventQueryParameters?: EventQueryParameters): Promise<ExtendedGroupEvent[]> {
    const dataQueryOptions: DataQueryOptions = {
      ...this.extendedGroupEventQueryService.dataQueryOptionsFrom(eventQueryParameters),
      select: this.publicFieldsDataQueryOptions.select
    };
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("allPublic:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all`, {params}), this.extendedGroupEventApiResponseSubject);
    return apiResponse.response as ExtendedGroupEvent[];
  }

  async createOrUpdate(walk: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    if (walk.id) {
      return this.update(walk);
    } else {
      return this.create(walk);
    }
  }

  async queryById(eventId: string): Promise<ExtendedGroupEvent> {
    const criteria = this.extendedGroupEventQueryService.eventIdCriteriaFor(eventId);
    const dataQueryOptions: DataQueryOptions = {criteria};
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.info("queryById:eventId", eventId, "dataQueryOptions:", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all`, {params}), this.extendedGroupEventApiResponseSubject);
    const results = apiResponse.response as ExtendedGroupEvent[];
    const extendedGroupEvent = results?.[0];
    this.logger.info("queryById:results:", results, "returning first:", extendedGroupEvent);
    return extendedGroupEvent;
  }

  async queryWalkLeaders(range?: SearchDateRange | null): Promise<string[]> {
    this.logger.info("queryWalkLeaders:");
    const params = this.commonDataService.toHttpParams(range ? {
      dateFrom: this.dateUtils.isoDateTime(range.from),
      dateTo: this.dateUtils.isoDateTime(range.to)
    } : {});
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<WalkLeaderIdsApiResponse>(`${this.BASE_URL}/walk-leaders`, {params}), this.walkLeaderIdNotifications);
    const labels = (apiResponse.labels || [])
      .filter(record => record?.id && record?.label)
      .reduce((acc, record) => {
        acc.set(record.id, record.label);
        return acc;
      }, new Map<string, string>());
    this.leaderLabelLookup = labels;
    this.leaderRecords = apiResponse.labels || [];
    return apiResponse.response || [];
  }

  async update(walk: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.info("updating", walk);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<ExtendedGroupEventApiResponse>(this.BASE_URL + "/" + walk.id, walk), this.extendedGroupEventApiResponseSubject);
    this.logger.info("updated", walk, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async create(walk: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.info("creating", walk);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ExtendedGroupEventApiResponse>(this.BASE_URL, walk), this.extendedGroupEventApiResponseSubject);
    this.logger.info("created", walk, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async createOrUpdateAll(extendedGroupEvents: ExtendedGroupEvent[]): Promise<ExtendedGroupEvent[]> {
    this.logger.info("createOrUpdateAll:requested", extendedGroupEvents);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all`, extendedGroupEvents));
    this.logger.info("createOrUpdateAll:received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent[];
  }

  async delete(extendedGroupEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.info("deleting", extendedGroupEvent);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<ExtendedGroupEventApiResponse>(this.BASE_URL + "/" + extendedGroupEvent.id), this.extendedGroupEventApiResponseSubject);
    this.logger.info("deleted", extendedGroupEvent, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async deleteAll(extendedGroupEvents: ExtendedGroupEvent[]): Promise<DeletionResponse[]> {
    this.logger.debug("deleteAll:requested:", extendedGroupEvents);
    const deleteExtendedGroupEventsRequest: DeleteDocumentsRequest = {ids: extendedGroupEvents.map((member: ExtendedGroupEvent) => member.id)};
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<DeletionResponseApiResponse>(this.BASE_URL + "/delete-all", deleteExtendedGroupEventsRequest));
    this.logger.debug("deleteAll:received:", apiResponse);
    return apiResponse.response as DeletionResponse[];
  }

  async fixIncorrectStartDates(): Promise<ExtendedGroupEvent[]> {
    this.logger.info("fixIncorrectStartDates:beginning");
    const walks = await this.all();
    const walksWithIncorrectDate: ExtendedGroupEvent[] = walks.filter(walk => walk?.groupEvent?.start_date_time !== walk?.groupEvent?.start_date_time);
    this.logger.info("given", this.stringUtilsService.pluraliseWithCount(walks.length, "queried walk"), "there are", this.stringUtilsService.pluraliseWithCount(walksWithIncorrectDate.length, "incorrectly dated walk"), walksWithIncorrectDate.map(walk => "current:" + this.dateUtils.displayDateAndTime(walk?.groupEvent?.start_date_time) + ", fixed:" + this.dateUtils.displayDateAndTime(this.dateUtils.asValueNoTime(walk?.groupEvent?.start_date_time))).join("\n"));
    const walksWithFixedDate: ExtendedGroupEvent[] = walksWithIncorrectDate.map(walk => ({
      ...walk,
      walkDate: this.dateUtils.asValueNoTime(walk.groupEvent.start_date_time)
    }));
    const filteredFixedDates = walksWithFixedDate.filter(walk => walk.groupEvent.start_date_time !== walk.groupEvent.start_date_time);
    this.logger.info("given", this.stringUtilsService.pluraliseWithCount(walks.length, "queried event"), "there are", this.stringUtilsService.pluraliseWithCount(filteredFixedDates.length, "remaining incorrectly dated event"), filteredFixedDates.map(walk => this.dateUtils.displayDateAndTime(walk.groupEvent.start_date_time)).join("\n"));
    this.logger.info("walksWithFixedDate raw:", walksWithFixedDate);
    Promise.all(walksWithFixedDate.map(walk => this.update(walk))).then((updated) => this.logger.info("update complete with", this.stringUtilsService.pluraliseWithCount(updated.length, "updated walk"), updated));
    return walksWithFixedDate;
  }

  async updateMany(dataQueryOptions: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    this.logger.info("updateMany called with dataQueryOptions:", dataQueryOptions);
    try {
      const apiResponse = await this.commonDataService.responseFrom(
        this.logger,
        this.http.post<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/update-many`, dataQueryOptions),
        this.extendedGroupEventApiResponseSubject
      );
      this.logger.info("updateMany: updated documents:", apiResponse);
      return apiResponse.response as ExtendedGroupEvent[];
    } catch (error) {
      this.logger.error("updateMany: error:", error);
      throw error;
    }
  }

  public async count({criteria}: { criteria: any }): Promise<number> {
    this.logger.info("count called with criteria:", criteria);
    const params = this.commonDataService.toHttpParams({criteria});
    const response = await this.http.get<{ count: number }>(`${this.BASE_URL}/count`, {params}).toPromise();
    return response.count;
  }

  leaderLabelMap(): Map<string, string> {
    return new Map(this.leaderLabelLookup);
  }

  leaderLabelRecords(): WalkLeaderLabelRecord[] {
    return [...this.leaderRecords];
  }
}
