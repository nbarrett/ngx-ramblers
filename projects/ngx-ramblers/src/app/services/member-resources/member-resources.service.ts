import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { MemberResource, MemberResourceApiResponse } from "../../models/member-resource.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class MemberResourcesService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberResourcesService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/member-resource";
  private memberResourceNotifications = new Subject<MemberResourceApiResponse>();

  notifications(): Observable<MemberResourceApiResponse> {
    return this.memberResourceNotifications.asObservable();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<MemberResource[]> {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberResourceApiResponse>(`${this.BASE_URL}/all`, {params}), this.memberResourceNotifications);
    return apiResponse.response as MemberResource[];
  }

  async createOrUpdate(memberResource: MemberResource): Promise<MemberResource> {
    if (memberResource.id) {
      return this.update(memberResource);
    } else {
      return this.create(memberResource);
    }
  }

  async getById(memberResourceId: string): Promise<MemberResource> {
    this.logger.debug("getById:", memberResourceId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<MemberResourceApiResponse>(`${this.BASE_URL}/${memberResourceId}`), this.memberResourceNotifications);
    return apiResponse.response as MemberResource;
  }

  async update(memberResource: MemberResource): Promise<MemberResource> {
    this.logger.debug("updating", memberResource);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<MemberResourceApiResponse>(this.BASE_URL + "/" + memberResource.id, memberResource), this.memberResourceNotifications);
    this.logger.debug("updated", memberResource, "- received", apiResponse);
    return apiResponse.response as MemberResource;
  }

  async create(memberResource: MemberResource): Promise<MemberResource> {
    this.logger.debug("creating", memberResource);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<MemberResourceApiResponse>(this.BASE_URL, memberResource), this.memberResourceNotifications);
    this.logger.debug("created", memberResource, "- received", apiResponse);
    return apiResponse.response as MemberResource;
  }

  async delete(memberResource: MemberResource): Promise<MemberResource> {
    this.logger.debug("deleting", memberResource);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<MemberResourceApiResponse>(this.BASE_URL + "/" + memberResource.id), this.memberResourceNotifications);
    this.logger.debug("deleted", memberResource, "- received", apiResponse);
    return apiResponse.response as MemberResource;
  }

}
