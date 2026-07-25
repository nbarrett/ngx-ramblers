import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AdminAlertEmailsConfig } from "../models/admin-alerts.model";
import { ApiResponse } from "../models/api-response.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({providedIn: "root"})
export class AdminAlertsService {
  private logger: Logger = inject(LoggerFactory).createLogger("AdminAlertsService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private baseUrl = "api/admin-alerts";

  async alertEmails(): Promise<string[]> {
    const config = (await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.baseUrl}/emails`)
    )).response as AdminAlertEmailsConfig;
    return config?.alertEmails || [];
  }

  async setAlertEmails(alertEmails: string[]): Promise<string[]> {
    const config = (await this.commonDataService.responseFrom(
      this.logger,
      this.http.put<ApiResponse>(`${this.baseUrl}/emails`, {alertEmails})
    )).response as AdminAlertEmailsConfig;
    return config?.alertEmails || [];
  }
}
