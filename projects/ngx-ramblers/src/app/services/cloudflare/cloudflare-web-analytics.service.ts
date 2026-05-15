import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../../models/api-response.model";
import {
  CloudflareWebAnalyticsRequest,
  CloudflareWebAnalyticsSummary
} from "../../models/cloudflare-web-analytics.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class CloudflareWebAnalyticsService {

  private logger: Logger = inject(LoggerFactory).createLogger("CloudflareWebAnalyticsService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/cloudflare/web-analytics";

  async queryAnalytics(request: CloudflareWebAnalyticsRequest): Promise<CloudflareWebAnalyticsSummary> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/analytics`, request))).response;
  }
}
