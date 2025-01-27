import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { MailchimpListAudit, MailchimpListAuditApiResponse } from "../../models/mailchimp.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class MailchimpListAuditService {
  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpListAuditService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/database/mailchimp-list-audit";
  private authNotifications = new Subject<MailchimpListAuditApiResponse>();

  notifications(): Observable<MailchimpListAuditApiResponse> {
    return this.authNotifications.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<MailchimpListAudit[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("find-one:criteria", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MailchimpListAuditApiResponse>(`${this.BASE_URL}/all`, {params}), this.authNotifications);
    this.logger.debug("find-one - received", apiResponse);
    return apiResponse.response as MailchimpListAudit[];
  }

  async getByMemberId(memberId: string): Promise<MailchimpListAudit[]> {
    this.logger.debug("getById:", memberId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MailchimpListAuditApiResponse>(`${this.BASE_URL}/member/${memberId}`), this.authNotifications);
    this.logger.debug("getById - received", apiResponse);
    return apiResponse.response as MailchimpListAudit[];
  }

  async create(audit: MailchimpListAudit): Promise<MailchimpListAudit> {
    this.logger.debug("creating", audit);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<MailchimpListAuditApiResponse>(this.BASE_URL, audit), this.authNotifications);
    this.logger.debug("created", audit, "received", apiResponse);
    return apiResponse.response as MailchimpListAudit;
  }

  async delete(memberUpdateAudit: MailchimpListAudit): Promise<MailchimpListAudit> {
    this.logger.debug("deleting", memberUpdateAudit);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<MailchimpListAuditApiResponse>(this.BASE_URL + "/" + memberUpdateAudit.id), this.authNotifications);
    this.logger.debug("deleted", memberUpdateAudit, "received", apiResponse);
    return apiResponse.response as MailchimpListAudit;
  }

}
