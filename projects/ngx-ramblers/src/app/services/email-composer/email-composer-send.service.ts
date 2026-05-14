import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { CommonDataService } from "../common-data-service";
import { ApiResponse } from "../../models/api-response.model";
import { BatchSendProgress, BatchSendStartResponse, BatchTransactionalSendRequest } from "../../models/email-composer.model";

@Injectable({ providedIn: "root" })
export class EmailComposerSendService {

  private logger: Logger = inject(LoggerFactory).createLogger("EmailComposerSendService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/mail/transactional/batch";

  async startBatch(request: BatchTransactionalSendRequest): Promise<BatchSendStartResponse> {
    this.logger.info("startBatch:", request);
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/start`, request));
    return response.response as BatchSendStartResponse;
  }

  async batchStatus(jobId: string): Promise<BatchSendProgress> {
    const response = await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/${encodeURIComponent(jobId)}`));
    return response.response as BatchSendProgress;
  }

  async cancelBatch(jobId: string): Promise<BatchSendProgress> {
    this.logger.info("cancelBatch:", jobId);
    const response = await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/${encodeURIComponent(jobId)}/cancel`, {}));
    return response.response as BatchSendProgress;
  }

  async resolveTrackingUrl(url: string): Promise<{ originalUrl: string; resolvedUrl: string | null; error?: string; lastUrl?: string; hops?: number }> {
    const response = await this.http.post<{ originalUrl: string; resolvedUrl: string | null; error?: string; lastUrl?: string; hops?: number }>(`api/mail/transactional/resolve-tracking-url`, { url }).toPromise();
    return response!;
  }
}
