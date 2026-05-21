import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../../models/api-response.model";
import {
  BrevoContactCampaignStats,
  BrevoContactDetails,
  BrevoEmailEventReport,
  BrevoTransactionalEmailContent,
  BrevoTransactionalEmailListResponse
} from "../../models/mail.model";
import { SortDirection } from "../../models/sort.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

export interface BrevoEventsQuery {
  days?: number;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  event?: string;
  sort?: SortDirection;
}

export interface BrevoTransactionalEmailsQuery {
  limit?: number;
  offset?: number;
  templateId?: number;
  messageId?: string;
  startDate?: string;
  endDate?: string;
  sort?: SortDirection;
}

@Injectable({ providedIn: "root" })
export class BrevoContactService {

  private readonly logger: Logger = inject(LoggerFactory).createLogger("BrevoContactService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private readonly BASE_URL = "api/mail";

  async getContactInfo(identifier: number | string): Promise<BrevoContactDetails> {
    const encoded = encodeURIComponent(String(identifier));
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/contacts/${encoded}/info`))).response;
  }

  async getContactCampaignStats(identifier: number | string, startDate?: string, endDate?: string): Promise<BrevoContactCampaignStats> {
    const encoded = encodeURIComponent(String(identifier));
    let params = new HttpParams();
    if (startDate) params = params.set("startDate", startDate);
    if (endDate) params = params.set("endDate", endDate);
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/contacts/${encoded}/campaign-stats`, { params }))).response;
  }

  async getEmailEventReport(identifier: number | string, options?: BrevoEventsQuery): Promise<BrevoEmailEventReport> {
    const encoded = encodeURIComponent(String(identifier));
    let params = new HttpParams();
    if (options?.days !== undefined) params = params.set("days", String(options.days));
    if (options?.limit !== undefined) params = params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params = params.set("offset", String(options.offset));
    if (options?.startDate) params = params.set("startDate", options.startDate);
    if (options?.endDate) params = params.set("endDate", options.endDate);
    if (options?.event) params = params.set("event", options.event);
    if (options?.sort) params = params.set("sort", options.sort);
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/contacts/${encoded}/events`, { params }))).response;
  }

  async getTransactionalEmails(email: string, options?: BrevoTransactionalEmailsQuery): Promise<BrevoTransactionalEmailListResponse> {
    let params = new HttpParams().set("email", email);
    if (options?.limit !== undefined) params = params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params = params.set("offset", String(options.offset));
    if (options?.templateId !== undefined) params = params.set("templateId", String(options.templateId));
    if (options?.messageId) params = params.set("messageId", options.messageId);
    if (options?.startDate) params = params.set("startDate", options.startDate);
    if (options?.endDate) params = params.set("endDate", options.endDate);
    if (options?.sort) params = params.set("sort", options.sort);
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/transactional/emails`, { params }))).response;
  }

  async getTransactionalEmailContent(uuid: string): Promise<BrevoTransactionalEmailContent> {
    const encoded = encodeURIComponent(uuid);
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/transactional/emails/${encoded}/content`))).response;
  }
}
