import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { FacebookRecentPostsApiResponse, FacebookRecentPostsData } from "../models/facebook.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class FacebookService {

  private logger: Logger = inject(LoggerFactory).createLogger("FacebookService", NgxLoggerLevel.ERROR);
  private commonDataService = inject(CommonDataService);
  private http = inject(HttpClient);
  private BASE_URL = "/api/social";
  private facebookNotifications = new Subject<FacebookRecentPostsApiResponse>();

  notifications(): Observable<FacebookRecentPostsApiResponse> {
    return this.facebookNotifications.asObservable();
  }

  async recentPosts(): Promise<FacebookRecentPostsData> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<FacebookRecentPostsApiResponse>(`${this.BASE_URL}/facebook/recent-posts`), this.facebookNotifications);
    return response.response as FacebookRecentPostsData;
  }
}
