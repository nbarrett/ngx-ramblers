import { inject, Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { NgxLoggerLevel } from "ngx-logger";
import { DateTime, Duration } from "luxon";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";
import { DateUtilsService } from "../date-utils.service";
import {
  DownloadConflictResponse,
  OperationResult,
  ServerDownloadStatus,
  ServerDownloadStatusType
} from "../../models/walk.model";
import { ApiResponseWrapper } from "../../models/api-response.model";

@Injectable({
  providedIn: "root"
})
export class ServerDownloadStatusService {
  private logger: Logger = inject(LoggerFactory).createLogger("ServerDownloadStatusService", NgxLoggerLevel.ERROR);
  private http: HttpClient = inject(HttpClient);
  private urlService: UrlService = inject(UrlService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);

  private currentDownloadSubject = new BehaviorSubject<ServerDownloadStatus | null>(null);
  private downloadHistorySubject = new BehaviorSubject<ServerDownloadStatus[]>([]);

  currentDownload$: Observable<ServerDownloadStatus | null> = this.currentDownloadSubject.asObservable();
  downloadHistory$: Observable<ServerDownloadStatus[]> = this.downloadHistorySubject.asObservable();

  async getCurrentServerDownloadStatus(): Promise<ServerDownloadStatus | null> {
    try {
      const response = await this.http.get<ApiResponseWrapper<ServerDownloadStatus | null>>(
        "/api/download-status/current"
      ).toPromise();
      const status = response?.response || null;
      this.currentDownloadSubject.next(status);
      this.logger.info("Current download status:", status);
      return status;
    } catch (error) {
      this.logger.error("Failed to get current download status:", error);
      return null;
    }
  }

  async getDownloadHistory(): Promise<ServerDownloadStatus[]> {
    try {
      const response = await this.http.get<ApiResponseWrapper<ServerDownloadStatus[]>>(
        "/api/download-status/history"
      ).toPromise();
      const history = response?.response || [];
      this.downloadHistorySubject.next(history);
      this.logger.info("Download history:", history);
      return history;
    } catch (error) {
      this.logger.error("Failed to get download history:", error);
      return [];
    }
  }

  async canStartNewDownload(): Promise<DownloadConflictResponse> {
    const currentStatus = await this.getCurrentServerDownloadStatus();

    if (!currentStatus) {
      return { allowed: true };
    }

    if (currentStatus.status === ServerDownloadStatusType.ACTIVE) {
      const startTime = DateTime.fromMillis(currentStatus.startTime);
      const lastActivity = currentStatus.lastActivity
        ? DateTime.fromMillis(currentStatus.lastActivity)
        : startTime;

      const timeSinceActivity = this.dateUtils.dateTimeNow().diff(lastActivity);
      const hangThreshold = Duration.fromObject({minutes: 10});
      const isHung = timeSinceActivity > hangThreshold;

      if (isHung) {
        return {
          allowed: false,
          reason: "Previous download appears to be hung. Use override option to terminate it.",
          activeDownload: {...currentStatus, status: ServerDownloadStatusType.HUNG, canOverride: true}
        };
      }

      return {
        allowed: false,
        reason: "Another download is currently in progress.",
        activeDownload: currentStatus
      };
    }

    return { allowed: true };
  }

  async overrideDownload(fileName: string): Promise<OperationResult> {
    try {
      this.logger.info("Attempting to override download:", fileName);
      const response = await this.http.post<OperationResult>(
        "/api/download-status/override",
        { fileName }
      ).toPromise();

      if (response?.success) {
        this.currentDownloadSubject.next(null);
        await this.getDownloadHistory(); // Refresh history
      }

      return response || { success: false, message: "No response received" };
    } catch (error) {
      this.logger.error("Failed to override download:", error);
      return { success: false, message: `Failed to override download: ${error}` };
    }
  }

  updateServerDownloadStatus(status: ServerDownloadStatus): void {
    this.currentDownloadSubject.next(status);
    this.logger.info("Updated download status:", status);
  }
}
