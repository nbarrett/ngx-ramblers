import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import {
  AutoMapRequest,
  AutoMapResult,
  BulkDeleteRequest,
  BulkStatusUpdateRequest,
  LegacyRedirectSummary,
  LegacyUrlMapping,
  LegacyUrlMappingApiResponse
} from "../../models/legacy-url-redirect.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class LegacyUrlMappingService {
  private logger: Logger = inject(LoggerFactory).createLogger("LegacyUrlMappingService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/legacy-url-mapping";
  private mappingNotifications = new Subject<LegacyUrlMappingApiResponse>();

  notifications(): Observable<LegacyUrlMappingApiResponse> {
    return this.mappingNotifications.asObservable();
  }

  all(dataQueryOptions?: DataQueryOptions): void {
    const params = this.commonDataService.toHttpParams(dataQueryOptions);
    this.logger.debug("all:dataQueryOptions", dataQueryOptions, "params", params.toString());
    this.commonDataService.responseFrom(this.logger, this.http.get<LegacyUrlMappingApiResponse>(`${this.BASE_URL}/all`, {params}), this.mappingNotifications);
  }

  async createOrUpdate(mapping: LegacyUrlMapping): Promise<LegacyUrlMapping> {
    if (mapping.id) {
      return this.update(mapping);
    } else {
      return this.create(mapping);
    }
  }

  async update(mapping: LegacyUrlMapping): Promise<LegacyUrlMapping> {
    this.logger.debug("updating", mapping);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.put<LegacyUrlMappingApiResponse>(`${this.BASE_URL}/${mapping.id}`, mapping), this.mappingNotifications);
    this.logger.debug("updated", mapping, "- received", apiResponse);
    return apiResponse.response as LegacyUrlMapping;
  }

  async create(mapping: LegacyUrlMapping): Promise<LegacyUrlMapping> {
    this.logger.debug("creating", mapping);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<LegacyUrlMappingApiResponse>(this.BASE_URL, mapping), this.mappingNotifications);
    this.logger.debug("created", mapping, "- received", apiResponse);
    return apiResponse.response as LegacyUrlMapping;
  }

  async delete(mapping: LegacyUrlMapping): Promise<LegacyUrlMapping> {
    this.logger.debug("deleting", mapping);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.delete<LegacyUrlMappingApiResponse>(`${this.BASE_URL}/${mapping.id}`), this.mappingNotifications);
    this.logger.debug("deleted", mapping, "- received", apiResponse);
    return apiResponse.response as LegacyUrlMapping;
  }

  async bulkUpdateStatus(request: BulkStatusUpdateRequest): Promise<any> {
    this.logger.debug("bulkUpdateStatus", request);
    return this.http.post(`${this.BASE_URL}/bulk-update-status`, request).toPromise();
  }

  async bulkDelete(request: BulkDeleteRequest): Promise<any> {
    this.logger.debug("bulkDelete", request);
    return this.http.post(`${this.BASE_URL}/bulk-delete`, request).toPromise();
  }

  async autoMap(request: AutoMapRequest): Promise<AutoMapResult> {
    this.logger.debug("autoMap", request);
    const result = await this.http.post<AutoMapResult>(`${this.BASE_URL}/auto-map`, request).toPromise();
    return result;
  }

  async summary(legacyDomain?: string): Promise<LegacyRedirectSummary> {
    const params = legacyDomain ? { legacyDomain } : {};
    return this.http.get<LegacyRedirectSummary>(`${this.BASE_URL}/summary`, { params }).toPromise();
  }

  async targetUrls(): Promise<{ path: string; source: string }[]> {
    return this.http.get<{ path: string; source: string }[]>(`${this.BASE_URL}/target-urls`).toPromise();
  }
}
