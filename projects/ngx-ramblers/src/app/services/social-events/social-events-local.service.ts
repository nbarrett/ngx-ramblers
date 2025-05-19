import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { ExtendedGroupEvent, ExtendedGroupEventApiResponse } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class SocialEventsLocalService {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialEventsLocalService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/social-event";
  private socialEventNotifications = new Subject<ExtendedGroupEventApiResponse>();

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

  notifications(): Observable<ExtendedGroupEventApiResponse> {
    return this.socialEventNotifications.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all`, {params}), this.socialEventNotifications);
    return apiResponse.response as ExtendedGroupEvent[];
  }

  async allPublic(dataQueryOptions?: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    const publicDataQueryOptions: DataQueryOptions = {...dataQueryOptions, select: this.publicFieldsDataQueryOptions.select};
    const params = this.commonDataService.toHttpParams(publicDataQueryOptions);
    this.logger.debug("allPublic:dataQueryOptions", publicDataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/all-public`, {params}), this.socialEventNotifications);
    return apiResponse.response as ExtendedGroupEvent[];
  }

  async createOrUpdate(socialEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    if (socialEvent.id) {
      return this.update(socialEvent);
    } else {
      return this.create(socialEvent);
    }
  }

  async queryForId(socialEventId: string): Promise<ExtendedGroupEvent> {
    this.logger.debug("getById:", socialEventId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ExtendedGroupEventApiResponse>(`${this.BASE_URL}/${socialEventId}`), this.socialEventNotifications);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async update(socialEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.debug("updating", socialEvent);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<ExtendedGroupEventApiResponse>(this.BASE_URL + "/" + socialEvent.id, socialEvent), this.socialEventNotifications);
    this.logger.debug("updated", socialEvent, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async create(socialEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.debug("creating", socialEvent);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ExtendedGroupEventApiResponse>(this.BASE_URL, socialEvent), this.socialEventNotifications);
    this.logger.debug("created", socialEvent, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

  async delete(socialEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    this.logger.debug("deleting", socialEvent);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<ExtendedGroupEventApiResponse>(this.BASE_URL + "/" + socialEvent.id), this.socialEventNotifications);
    this.logger.debug("deleted", socialEvent, "- received", apiResponse);
    return apiResponse.response as ExtendedGroupEvent;
  }

}
