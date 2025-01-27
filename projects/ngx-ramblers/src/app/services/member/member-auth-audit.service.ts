import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { MemberAuthAudit, MemberAuthAuditApiResponse } from "../../models/member.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class MemberAuthAuditService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberAuthAuditService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/member-auth-audit";
  private authNotifications = new Subject<MemberAuthAuditApiResponse>();

  notifications(): Observable<MemberAuthAuditApiResponse> {
    return this.authNotifications.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<MemberAuthAudit[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("find-all:criteria", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberAuthAuditApiResponse>(`${this.BASE_URL}/all`, {params}), this.authNotifications);
    this.logger.debug("find-all:received", apiResponse);
    return apiResponse.response as MemberAuthAudit[];
  }

  async getByMemberId(memberId: string): Promise<MemberAuthAudit[]> {
    this.logger.debug("getById:", memberId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberAuthAuditApiResponse>(`${this.BASE_URL}/member/${memberId}`), this.authNotifications);
    this.logger.debug("getById - received", apiResponse);
    return apiResponse.response as MemberAuthAudit[];
  }

  async create(member: MemberAuthAudit): Promise<MemberAuthAudit> {
    this.logger.debug("creating", member);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<MemberAuthAuditApiResponse>(this.BASE_URL, member), this.authNotifications);
    this.logger.debug("created", member, "received", apiResponse);
    return apiResponse.response as MemberAuthAudit;
  }

  async delete(memberUpdateAudit: MemberAuthAudit): Promise<MemberAuthAudit> {
    this.logger.debug("deleting", memberUpdateAudit);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<MemberAuthAuditApiResponse>(this.BASE_URL + "/" + memberUpdateAudit.id), this.authNotifications);
    this.logger.debug("deleted", memberUpdateAudit, "received", apiResponse);
    return apiResponse.response as MemberAuthAudit;
  }

}
