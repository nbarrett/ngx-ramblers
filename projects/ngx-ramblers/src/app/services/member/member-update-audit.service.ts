import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DataQueryOptions } from "../../models/api-request.model";
import { MemberUpdateAudit, MemberUpdateAuditApiResponse } from "../../models/member.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NumberUtilsService } from "../number-utils.service";

@Injectable({
  providedIn: "root"
})
export class MemberUpdateAuditService {

  private BASE_URL = "/api/database/member-update-audit";
  private logger: Logger;

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberUpdateAuditService, NgxLoggerLevel.OFF);
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<MemberUpdateAudit[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("find-one:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.http.get<MemberUpdateAuditApiResponse>(`${this.BASE_URL}/all`, {params}).toPromise();
    this.logger.debug("find-one - received", apiResponse);
    return apiResponse.response as MemberUpdateAudit[];
  }

  async create(member: MemberUpdateAudit): Promise<MemberUpdateAudit> {
    this.logger.debug("creating", member);
    const apiResponse = await this.http.post<MemberUpdateAuditApiResponse>(this.BASE_URL, member).toPromise();
    this.logger.debug("created", member, "- received", apiResponse);
    return apiResponse.response as MemberUpdateAudit;
  }

  async delete(memberUpdateAudit: MemberUpdateAudit): Promise<MemberUpdateAudit> {
    this.logger.debug("deleting", memberUpdateAudit);
    const apiResponse = await this.http.delete<MemberUpdateAuditApiResponse>(this.BASE_URL + "/" + memberUpdateAudit.id).toPromise();
    this.logger.debug("deleted", memberUpdateAudit, "- received", apiResponse);
    return apiResponse.response as MemberUpdateAudit;
  }

}
