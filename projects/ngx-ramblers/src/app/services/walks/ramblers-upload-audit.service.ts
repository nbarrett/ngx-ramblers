import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import {
  FileUploadSummary,
  RamblersUploadAuditApiResponse,
  RamblersUploadSummaryResponse
} from "../../models/ramblers-upload-audit.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class RamblersUploadAuditService {

  private logger: Logger = inject(LoggerFactory).createLogger("RamblersUploadAuditService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/ramblers-upload-audit";
  private auditNotifications = new Subject<RamblersUploadAuditApiResponse>();

  notifications(): Observable<RamblersUploadAuditApiResponse> {
    return this.auditNotifications.asObservable();
  }

  all(dataQueryOptions?: DataQueryOptions): Promise<RamblersUploadAuditApiResponse> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    return this.commonDataService.responseFrom(this.logger, this.http.get<RamblersUploadAuditApiResponse>(`${this.BASE_URL}/all`, {params}), this.auditNotifications, true);
  }

  async uniqueUploadSessions(months: number = 6): Promise<FileUploadSummary[]> {
    const uploadSessionsResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<RamblersUploadSummaryResponse>(`${this.BASE_URL}/upload-sessions`, { params: this.commonDataService.toHttpParams({ months }) }));
    const sessions = uploadSessionsResponse.response;
    this.logger.info("uniqueUploadSessions:", sessions);
    return sessions;
  }

}
