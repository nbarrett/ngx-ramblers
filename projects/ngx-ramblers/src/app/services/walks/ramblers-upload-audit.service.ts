import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { RamblersUploadAuditApiResponse } from "../../models/ramblers-upload-audit.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class RamblersUploadAuditService {

  private BASE_URL = "/api/database/ramblers-upload-audit";
  private logger: Logger;
  private auditNotifications = new Subject<RamblersUploadAuditApiResponse>();

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(RamblersUploadAuditService, NgxLoggerLevel.OFF);
  }

  notifications(): Observable<RamblersUploadAuditApiResponse> {
    return this.auditNotifications.asObservable();
  }

  all(dataQueryOptions?: DataQueryOptions): Promise<RamblersUploadAuditApiResponse> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    return this.commonDataService.responseFrom(this.logger, this.http.get<RamblersUploadAuditApiResponse>(`${this.BASE_URL}/all`, {params}), this.auditNotifications);
  }

}
