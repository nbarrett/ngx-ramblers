import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { WalkLeaderIdsApiResponse } from "../../models/walk.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";
import { StringUtilsService } from "../string-utils.service";
import { DateUtilsService } from "../date-utils.service";
import { ExtendedGroupEvent, ExtendedGroupEventApiResponse } from "../../models/group-event.model";
import { DeleteDocumentsRequest, Member } from "../../models/member.model";
import { DeletionResponse, DeletionResponseApiResponse } from "../../models/mongo-models";

@Injectable({
  providedIn: "root"
})
export class WalksAndEventsLocalService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksAndEventsLocalService", NgxLoggerLevel.INFO);
  private http = inject(HttpClient);
  private stringUtilsService = inject(StringUtilsService);
  private dateUtils = inject(DateUtilsService);
  private commonDataService = inject(CommonDataService);
  private urlService = inject(UrlService);
  private BASE_URL = "/api/database/group-event";
  private walkNotifications = new Subject<ExtendedGroupEventApiResponse>();
  private walkLeaderIdNotifications = new Subject<WalkLeaderIdsApiResponse>();

  notifications(): Observable<ExtendedGroupEventApiResponse> {
    return this.walkNotifications.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.info("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all`, {params}), this.walkNotifications);
    return apiResponse.response as ExtendedGroupEvent[];
  }

  async createOrUpdate(walk: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    if (walk.id) {
      return this.update(walk);
    } else {
      return this.create(walk);
    }
  }

  async getById(walkId: string): Promise<ExtendedGroupEvent> {
    this.logger.info("getById:", walkId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/${walkId}`), this.walkNotifications);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async queryWalkLeaders(): Promise<string[]> {
    this.logger.info("queryWalkLeaders:");
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<WalkLeaderIdsApiResponse>(`${this.BASE_URL}/walk-leaders`), this.walkLeaderIdNotifications);
    return apiResponse.response;
  }

  async getByIdIfPossible(walkId: string): Promise<ExtendedGroupEvent | null> {
    if (this.urlService.isMongoId(walkId)) {
      this.logger.info("getByIdIfPossible:walkId", walkId, "is valid MongoId");
      return this.getById(walkId);
    } else {
      this.logger.info("getByIdIfPossible:walkId", walkId, "is not valid MongoId - returning null");
      return Promise.resolve(null);
    }
  }

  async update(walk: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.info("updating", walk);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<ExtendedGroupEventApiResponse>(this.BASE_URL + "/" + walk.id, walk), this.walkNotifications);
    this.logger.info("updated", walk, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async create(walk: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.info("creating", walk);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ExtendedGroupEventApiResponse>(this.BASE_URL, walk), this.walkNotifications);
    this.logger.info("created", walk, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async createOrUpdateAll(extendedGroupEvents: ExtendedGroupEvent[]): Promise<ExtendedGroupEvent[]> {
    this.logger.info("createOrUpdateAll:requested", extendedGroupEvents);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all`, extendedGroupEvents));
    this.logger.info("createOrUpdateAll:received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent[];
  }

  async delete(walk: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.info("deleting", walk);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<ExtendedGroupEventApiResponse>(this.BASE_URL + "/" + walk.id), this.walkNotifications);
    this.logger.info("deleted", walk, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async deleteAll(members: ExtendedGroupEvent[]): Promise<DeletionResponse[]> {
    this.logger.debug("deleteAll:requested:", members);
    const deleteExtendedGroupEventsRequest: DeleteDocumentsRequest = {ids: members.map((member: ExtendedGroupEvent) => member.id)};
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<DeletionResponseApiResponse>(this.BASE_URL + "/delete-all", deleteExtendedGroupEventsRequest));
    this.logger.debug("deleteAll:received:", apiResponse);
    return apiResponse.response as DeletionResponse[];
  }

  async fixIncorrectWalkDates(): Promise<ExtendedGroupEvent[]> {
    this.logger.info("fixIncorrectWalkDates:beginning");
    const walks = await this.all();
    const walksWithIncorrectDate: ExtendedGroupEvent[] = walks.filter(walk => walk.groupEvent.start_date_time !== walk.groupEvent.start_date_time);
    this.logger.info("given", this.stringUtilsService.pluraliseWithCount(walks.length, "queried walk"), "there are", this.stringUtilsService.pluraliseWithCount(walksWithIncorrectDate.length, "incorrectly dated walk"), walksWithIncorrectDate.map(walk => "current:" + this.dateUtils.displayDateAndTime(walk.groupEvent.start_date_time) + ", fixed:" + this.dateUtils.displayDateAndTime(this.dateUtils.asValueNoTime(walk.groupEvent.start_date_time))).join("\n"));
    const walksWithFixedDate: ExtendedGroupEvent[] = walksWithIncorrectDate.map(walk => ({
      ...walk,
      walkDate: this.dateUtils.asValueNoTime(walk.groupEvent.start_date_time)
    }));
    const filteredFixedDates = walksWithFixedDate.filter(walk => walk.groupEvent.start_date_time !== walk.groupEvent.start_date_time);
    this.logger.info("given", this.stringUtilsService.pluraliseWithCount(walks.length, "queried walk"), "there are", this.stringUtilsService.pluraliseWithCount(filteredFixedDates.length, "remaining incorrectly dated walk"), filteredFixedDates.map(walk => this.dateUtils.displayDateAndTime(walk.groupEvent.start_date_time)).join("\n"));
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
        this.walkNotifications
      );
      this.logger.info("updateMany: updated documents:", apiResponse);
      return apiResponse.response as ExtendedGroupEvent[];
    } catch (error) {
      this.logger.error("updateMany: error:", error);
      throw error;
    }
  }
}
