import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../models/api-response.model";
import { ScheduledTaskSummary } from "../models/scheduled-task.model";
import { CommonDataService } from "./common-data-service";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({providedIn: "root"})
export class ScheduledTaskService {
  private logger: Logger = inject(LoggerFactory).createLogger("ScheduledTaskService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private baseUrl = "api/scheduled-tasks";

  async tasks(): Promise<ScheduledTaskSummary[]> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(this.baseUrl))).response;
  }

  async trigger(id: string): Promise<ScheduledTaskSummary> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.baseUrl}/${id}/trigger`, {}))).response;
  }

  async setEnabled(id: string, enabled: boolean): Promise<ScheduledTaskSummary> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.put<ApiResponse>(`${this.baseUrl}/${id}/enabled`, {enabled}))).response;
  }

  async setSchedule(id: string, cronExpression: string): Promise<ScheduledTaskSummary> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.put<ApiResponse>(`${this.baseUrl}/${id}/schedule`, {cronExpression}))).response;
  }
}
