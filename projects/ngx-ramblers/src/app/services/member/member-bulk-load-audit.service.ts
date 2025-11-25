import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { Member, MemberBulkLoadAudit, MemberBulkLoadAuditApiResponse, MemberBulkLoadDateMap } from "../../models/member.model";
import { CommonDataService } from "../common-data-service";
import { DbUtilsService } from "../db-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { first } from "es-toolkit/compat";
import { StringUtilsService } from "../string-utils.service";

@Injectable({
  providedIn: "root"
})
export class MemberBulkLoadAuditService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberBulkLoadAuditService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private dbUtils = inject(DbUtilsService);
  private commonDataService = inject(CommonDataService);
  private stringUtilsService = inject(StringUtilsService);
  private BASE_URL = "/api/database/member-bulk-load-audit";
  private bulkLoadNotifications = new Subject<MemberBulkLoadAuditApiResponse>();

  notifications(): Observable<MemberBulkLoadAuditApiResponse> {
    return this.bulkLoadNotifications.asObservable();
  }

  async all(criteria?: DataQueryOptions): Promise<MemberBulkLoadAudit[]> {
    const params = this.commonDataService.toHttpParams(criteria);
    this.logger.info("all:criteria:", criteria, "params:", params.toString());
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberBulkLoadAuditApiResponse>(`${this.BASE_URL}/all`, {params}), this.bulkLoadNotifications);
    const responses = response.response as MemberBulkLoadAudit[];
    this.logger.info("all:params", params.toString(), "received", responses.length, "audits");
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

  public async findLatestBulkLoadAudit() {
    const audits: MemberBulkLoadAudit[] = await this.all({limit: 1, sort: {createdDate: -1}});
    const latestMemberBulkLoadAudit = first(audits);
    this.logger.info("findLatestBulkLoadAudit:audits:", audits, "latestMemberBulkLoadAudit:", latestMemberBulkLoadAudit);
    return latestMemberBulkLoadAudit;
  }

  public receivedInBulkLoad(member: Member, received: boolean, bulkLoadAudit: MemberBulkLoadAudit) {
    return bulkLoadAudit?.members?.find(memberInAudit => memberInAudit.membershipNumber === member.membershipNumber) ? received : !received;
  }

  public async createMemberBulkLoadDateMap(): Promise<MemberBulkLoadDateMap> {
    this.logger.info("createMemberBulkLoadDateMap: fetching from server");
    const dateMapObject = await firstValueFrom(this.http.get<MemberBulkLoadDateMap>(`${this.BASE_URL}/member-bulk-load-date-map`));
    this.logger.info("createMemberBulkLoadDateMap: created map with", this.stringUtilsService.pluraliseWithCount(Object.keys(dateMapObject || {}).length, "entry", "entries"), "memberBulkLoadDateMap:", dateMapObject);
    return dateMapObject;
  }
}
