import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { InstagramMediaPostApiResponse, InstagramRecentMediaData } from "../models/instagram.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class InstagramService {

  private logger: Logger = inject(LoggerFactory).createLogger("InstagramService", NgxLoggerLevel.ERROR);
  private commonDataService = inject(CommonDataService);
  private http = inject(HttpClient);
  private BASE_URL = "/api/instagram";
  private instagramNotifications = new Subject<InstagramMediaPostApiResponse>();

  notifications(): Observable<InstagramMediaPostApiResponse> {
    return this.instagramNotifications.asObservable();
  }

  async recentMedia(): Promise<InstagramRecentMediaData> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<InstagramMediaPostApiResponse>(`${this.BASE_URL}/recent-media`), this.instagramNotifications);
    return response.response as InstagramRecentMediaData;
  }
}
