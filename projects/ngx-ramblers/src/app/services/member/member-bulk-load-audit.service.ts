import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { MemberBulkLoadAudit, MemberBulkLoadAuditApiResponse } from "../../models/member.model";
import { CommonDataService } from "../common-data-service";
import { DbUtilsService } from "../db-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NumberUtilsService } from "../number-utils.service";

@Injectable({
  providedIn: "root"
})
export class MemberBulkLoadAuditService {

  private BASE_URL = "/api/database/member-bulk-load-audit";
  private logger: Logger;
  private bulkLoadNotifications = new Subject<MemberBulkLoadAuditApiResponse>();

  constructor(private http: HttpClient,
              private numberUtils: NumberUtilsService,
              private dbUtils: DbUtilsService,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberBulkLoadAuditService, NgxLoggerLevel.OFF);
  }

  notifications(): Observable<MemberBulkLoadAuditApiResponse> {
    return this.bulkLoadNotifications.asObservable();
  }

  async all(criteria?: DataQueryOptions): Promise<MemberBulkLoadAudit[]> {
    const params = this.commonDataService.toHttpParams(criteria);
    this.logger.debug("all:params", params.toString());
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberBulkLoadAuditApiResponse>(`${this.BASE_URL}/all`, {params}), this.bulkLoadNotifications);
    const responses = response.response as MemberBulkLoadAudit[];
    this.logger.debug("all:params", params.toString(), "received", responses.length, "audits");
    return responses;
  }

  async create(audit: MemberBulkLoadAudit): Promise<MemberBulkLoadAudit> {
    this.logger.debug("creating", audit);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<MemberBulkLoadAuditApiResponse>(this.BASE_URL, this.dbUtils.performAudit(audit)), this.bulkLoadNotifications);
    this.logger.debug("created", audit, "- received", apiResponse);
    return apiResponse.response as MemberBulkLoadAudit;
  }

  async delete(audit: MemberBulkLoadAudit): Promise<MemberBulkLoadAudit> {
    this.logger.debug("deleting", audit);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<MemberBulkLoadAuditApiResponse>(this.BASE_URL + "/" + audit.id), this.bulkLoadNotifications);
    this.logger.debug("deleted", audit, "- received", apiResponse);
    return apiResponse.response as MemberBulkLoadAudit;
  }

}
