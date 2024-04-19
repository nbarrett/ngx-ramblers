import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailListAudit, MailListAuditApiResponse } from "../../models/mail.model";

@Injectable({
  providedIn: "root"
})
export class MailListAuditService {

  private BASE_URL = "api/database/mail-list-audit";
  private logger: Logger;
  private notificationEvents = new Subject<MailListAuditApiResponse>();

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailListAuditService", NgxLoggerLevel.OFF);
  }

  notifications(): Observable<MailListAuditApiResponse> {
    return this.notificationEvents.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<MailListAudit[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("find-one:criteria", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MailListAuditApiResponse>(`${this.BASE_URL}/all`, {params}), this.notificationEvents);
    this.logger.debug("find-one - received", apiResponse);
    return apiResponse.response as MailListAudit[];
  }

  async getByMemberId(memberId: string): Promise<MailListAudit[]> {
    this.logger.debug("getById:", memberId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MailListAuditApiResponse>(`${this.BASE_URL}/member/${memberId}`), this.notificationEvents);
    this.logger.debug("getById - received", apiResponse);
    return apiResponse.response as MailListAudit[];
  }

  async create(audit: MailListAudit): Promise<MailListAudit> {
    this.logger.debug("creating", audit);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<MailListAuditApiResponse>(this.BASE_URL, audit), this.notificationEvents);
    this.logger.debug("created", audit, "received", apiResponse);
    return apiResponse.response as MailListAudit;
  }

  async delete(memberUpdateAudit: MailListAudit): Promise<MailListAudit> {
    this.logger.debug("deleting", memberUpdateAudit);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<MailListAuditApiResponse>(this.BASE_URL + "/" + memberUpdateAudit.id), this.notificationEvents);
    this.logger.debug("deleted", memberUpdateAudit, "received", apiResponse);
    return apiResponse.response as MailListAudit;
  }

}
