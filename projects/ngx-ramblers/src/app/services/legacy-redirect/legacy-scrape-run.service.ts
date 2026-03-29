import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { LegacyScrapeRunApiResponse } from "../../models/legacy-url-redirect.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class LegacyScrapeRunService {
  private logger: Logger = inject(LoggerFactory).createLogger("LegacyScrapeRunService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/legacy-scrape-run";
  private scrapeNotifications = new Subject<LegacyScrapeRunApiResponse>();

  notifications(): Observable<LegacyScrapeRunApiResponse> {
    return this.scrapeNotifications.asObservable();
  }

  all(dataQueryOptions?: DataQueryOptions): void {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    this.commonDataService.responseFrom(this.logger, this.http.get<LegacyScrapeRunApiResponse>(`${this.BASE_URL}/all`, {params}), this.scrapeNotifications);
  }
}
