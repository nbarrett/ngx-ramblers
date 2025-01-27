import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NotificationConfig, NotificationConfigurationApiResponse } from "../models/mail.model";

@Injectable({
  providedIn: "root"
})
export class NotificationConfigService {

  private logger: Logger = inject(LoggerFactory).createLogger("NotificationConfigService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "/api/database/notification-config";
  private notificationsInternal = new Subject<NotificationConfigurationApiResponse>();

  notifications(): Observable<NotificationConfigurationApiResponse> {
    return this.notificationsInternal.asObservable();
  }

  async all(): Promise<NotificationConfig[]> {
    const apiResponse = await this.http.get<{
      response: NotificationConfig[]
    }>(this.BASE_URL + "/all").toPromise();
    this.logger.debug("all - received", apiResponse);
    return apiResponse.response;
  }

  async getById(id: string): Promise<NotificationConfig> {
    this.logger.debug("getById:", id);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<NotificationConfigurationApiResponse>(`${this.BASE_URL}/${id}`), this.notificationsInternal);
    return apiResponse.response as NotificationConfig;
  }

  async create(bannerConfig: NotificationConfig): Promise<NotificationConfig> {
    this.logger.debug("creating", bannerConfig);
    const apiResponse = await this.http.post<{
      response: NotificationConfig
    }>(this.BASE_URL, bannerConfig).toPromise();
    this.logger.debug("created", bannerConfig, "- received", apiResponse);
    return apiResponse.response;
  }

  async update(bannerConfig: NotificationConfig): Promise<NotificationConfig> {
    this.logger.debug("updating", bannerConfig);
    const apiResponse = await this.http.put<{
      response: NotificationConfig
    }>(this.BASE_URL + "/" + bannerConfig.id, bannerConfig).toPromise();
    this.logger.debug("updated", bannerConfig, "- received", apiResponse);
    return apiResponse.response;
  }

  async createOrUpdate(bannerConfig: NotificationConfig): Promise<NotificationConfig> {
    if (bannerConfig.id) {
      return this.update(bannerConfig);
    } else {
      return this.create(bannerConfig);
    }
  }

  async delete(id: string): Promise<NotificationConfig> {
    const apiResponse = await this.http.delete<{
      response: NotificationConfig
    }>(this.BASE_URL + "/" + id).toPromise();
    this.logger.debug("delete", id, "- received", apiResponse);
    return apiResponse.response;
  }

  saveAndDelete(notificationConfigs: NotificationConfig[], deletedConfigIds: string[]): Promise<any> {
    this.logger.debug("saveAll", notificationConfigs, deletedConfigIds);
    const savedPromises = notificationConfigs.map(notificationConfig => this.createOrUpdate(notificationConfig));
    const deletedPromises = deletedConfigIds.map(id => this.delete(id));
    return Promise.all(savedPromises.concat(deletedPromises));
  }
}
