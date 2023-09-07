import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { Walk, WalkApiResponse, WalkLeaderIdsApiResponse } from "../../models/walk.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";

@Injectable({
  providedIn: "root"
})
export class WalksLocalService {

  private BASE_URL = "/api/database/walks";
  private readonly logger: Logger;
  private walkNotifications = new Subject<WalkApiResponse>();
  private walkLeaderIdNotifications = new Subject<WalkLeaderIdsApiResponse>();

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalksLocalService", NgxLoggerLevel.OFF);
  }

  notifications(): Observable<WalkApiResponse> {
    return this.walkNotifications.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<Walk[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<WalkApiResponse>(`${this.BASE_URL}/all`, {params}), this.walkNotifications);
    return apiResponse.response as Walk[];
  }

  async createOrUpdate(walk: Walk): Promise<Walk> {
    if (walk.id) {
      return this.update(walk);
    } else {
      return this.create(walk);
    }
  }

  async getById(walkId: string): Promise<Walk> {
    this.logger.debug("getById:", walkId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<WalkApiResponse>(`${this.BASE_URL}/${walkId}`), this.walkNotifications);
    return apiResponse.response as Walk;
  }

  async queryPreviousWalkLeaderIds(): Promise<string[]> {
    this.logger.debug("queryPreviousWalkLeaderIds:");
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<WalkLeaderIdsApiResponse>(`${this.BASE_URL}/walk-leader-ids`), this.walkLeaderIdNotifications);
    return apiResponse.response;
  }

  async getByIdIfPossible(walkId: string): Promise<Walk | null> {
    if (this.urlService.isMongoId(walkId)) {
      this.logger.debug("getByIdIfPossible:walkId", walkId, "is valid MongoId");
      return this.getById(walkId);
    } else {
      this.logger.debug("getByIdIfPossible:walkId", walkId, "is not valid MongoId - returning null");
      return Promise.resolve(null);
    }
  }

  async update(walk: Walk): Promise<Walk> {
    this.logger.debug("updating", walk);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<WalkApiResponse>(this.BASE_URL + "/" + walk.id, walk), this.walkNotifications);
    this.logger.debug("updated", walk, "- received", apiResponse);
    return apiResponse.response as Walk;
  }

  async create(walk: Walk): Promise<Walk> {
    this.logger.debug("creating", walk);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<WalkApiResponse>(this.BASE_URL, walk), this.walkNotifications);
    this.logger.debug("created", walk, "- received", apiResponse);
    return apiResponse.response as Walk;
  }

  async delete(walk: Walk): Promise<Walk> {
    this.logger.debug("deleting", walk);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<WalkApiResponse>(this.BASE_URL + "/" + walk.id), this.walkNotifications);
    this.logger.debug("deleted", walk, "- received", apiResponse);
    return apiResponse.response as Walk;
  }

}
