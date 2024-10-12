import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { SocialEvent, SocialEventApiResponse } from "../../models/social-events.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class SocialEventsLocalService {

  private BASE_URL = "/api/database/social-event";
  private logger: Logger;
  private socialEventNotifications = new Subject<SocialEventApiResponse>();

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("SocialEventsLocalService", NgxLoggerLevel.ERROR);
  }

  publicFieldsDataQueryOptions: DataQueryOptions = {
    select: {
      briefDescription: 1,
      eventDate: 1,
      location: 1,
      longerDescription: 1,
      attachment: 1,
      thumbnail: 1
    }
  };

  notifications(): Observable<SocialEventApiResponse> {
    return this.socialEventNotifications.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<SocialEvent[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<SocialEventApiResponse>(`${this.BASE_URL}/all`, {params}), this.socialEventNotifications);
    return apiResponse.response as SocialEvent[];
  }

  async allPublic(dataQueryOptions?: DataQueryOptions): Promise<SocialEvent[]> {
    const publicDataQueryOptions: DataQueryOptions = {...dataQueryOptions, select: this.publicFieldsDataQueryOptions.select};
    const params = this.commonDataService.toHttpParams(publicDataQueryOptions);
    this.logger.debug("allPublic:dataQueryOptions", publicDataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<SocialEventApiResponse>(`${this.BASE_URL}/all-public`, {params}), this.socialEventNotifications);
    return apiResponse.response as SocialEvent[];
  }

  async createOrUpdate(socialEvent: SocialEvent): Promise<SocialEvent> {
    if (socialEvent.id) {
      return this.update(socialEvent);
    } else {
      return this.create(socialEvent);
    }
  }

  async queryForId(socialEventId: string): Promise<SocialEvent> {
    this.logger.debug("getById:", socialEventId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<SocialEventApiResponse>(`${this.BASE_URL}/${socialEventId}`), this.socialEventNotifications);
    return apiResponse.response as SocialEvent;
  }

  async update(socialEvent: SocialEvent): Promise<SocialEvent> {
    this.logger.debug("updating", socialEvent);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<SocialEventApiResponse>(this.BASE_URL + "/" + socialEvent.id, socialEvent), this.socialEventNotifications);
    this.logger.debug("updated", socialEvent, "- received", apiResponse);
    return apiResponse.response as SocialEvent;
  }

  async create(socialEvent: SocialEvent): Promise<SocialEvent> {
    this.logger.debug("creating", socialEvent);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<SocialEventApiResponse>(this.BASE_URL, socialEvent), this.socialEventNotifications);
    this.logger.debug("created", socialEvent, "- received", apiResponse);
    return apiResponse.response as SocialEvent;
  }

  async delete(socialEvent: SocialEvent): Promise<SocialEvent> {
    this.logger.debug("deleting", socialEvent);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<SocialEventApiResponse>(this.BASE_URL + "/" + socialEvent.id), this.socialEventNotifications);
    this.logger.debug("deleted", socialEvent, "- received", apiResponse);
    return apiResponse.response as SocialEvent;
  }

}
