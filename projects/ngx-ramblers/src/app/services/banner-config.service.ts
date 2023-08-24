import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { BannerConfig, BannerConfigApiResponse } from "../models/banner-configuration.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class BannerConfigService {
  private logger: Logger;
  private BASE_URL = "/api/database/banners";
  private notificationsInternal = new Subject<BannerConfigApiResponse>();

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BannerConfigService, NgxLoggerLevel.OFF);
  }

  notifications(): Observable<BannerConfigApiResponse> {
    return this.notificationsInternal.asObservable();
  }

  async all(): Promise<BannerConfig[]> {
    const apiResponse = await this.http.get<{ response: BannerConfig[] }>(this.BASE_URL + "/all").toPromise();
    this.logger.debug("all - received", apiResponse);
    return apiResponse.response;
  }

  async getById(bannerConfigId: string): Promise<BannerConfig> {
    this.logger.debug("getById:", bannerConfigId);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<BannerConfigApiResponse>(`${this.BASE_URL}/${bannerConfigId}`), this.notificationsInternal);
    return apiResponse.response as BannerConfig;
  }

  async findByNameAndCategory(name: string, category: string): Promise<BannerConfig> {
    const params = this.commonDataService.toHttpParams(category ? {criteria: {name: {$eq: name}, category: {$eq: category}}} : {criteria: {name: {$eq: name}}});
    const apiResponse = await this.http.get<{ response: BannerConfig }>(this.BASE_URL, {params}).toPromise();
    this.logger.debug("forName", name, "- received", apiResponse);
    return apiResponse.response;
  }

  async filterByCategory(category): Promise<BannerConfig[]> {
    const params = this.commonDataService.toHttpParams({criteria: {category: {$eq: category}}});
    const apiResponse = await this.http.get<{ response: BannerConfig[] }>(`${this.BASE_URL}/all`, {params}).toPromise();
    this.logger.debug("forName", category, "- received", apiResponse);
    return apiResponse.response;
  }

  async create(bannerConfig: BannerConfig): Promise<BannerConfig> {
    this.logger.debug("creating", bannerConfig);
    const apiResponse = await this.http.post<{ response: BannerConfig }>(this.BASE_URL, bannerConfig).toPromise();
    this.logger.debug("created", bannerConfig, "- received", apiResponse);
    return apiResponse.response;
  }

  async update(bannerConfig: BannerConfig): Promise<BannerConfig> {
    this.logger.debug("updating", bannerConfig);
    const apiResponse = await this.http.put<{ response: BannerConfig }>(this.BASE_URL + "/" + bannerConfig.id, bannerConfig).toPromise();
    this.logger.debug("updated", bannerConfig, "- received", apiResponse);
    return apiResponse.response;
  }

  async createOrUpdate(bannerConfig: BannerConfig): Promise<BannerConfig> {
    if (bannerConfig.id) {
      return this.update(bannerConfig);
    } else {
      return this.create(bannerConfig);
    }
  }

  async delete(bannerConfig: BannerConfig): Promise<BannerConfig> {
    const apiResponse = await this.http.delete<{ response: BannerConfig }>(this.BASE_URL + "/" + bannerConfig.id).toPromise();
    this.logger.debug("delete", bannerConfig, "- received", apiResponse);
    return apiResponse.response;
  }

}
