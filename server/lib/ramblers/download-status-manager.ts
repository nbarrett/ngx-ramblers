import * as fs from "fs";
import * as path from "path";
import debug from "debug";
import { DateTime, Duration } from "luxon";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { ServerDownloadStatus, ServerDownloadStatusType, OperationResult, DownloadConflictResponse } from "../../../projects/ngx-ramblers/src/app/models/walk.model";

const debugLog = debug(envConfig.logNamespace("download-status-manager"));

class DownloadStatusManager {

  private statusFilePath = "/tmp/ramblers/download-status.json";
  private currentStatus: ServerDownloadStatus | null = null;

  constructor() {
    this.ensureStatusFileExists();
    this.loadStatus();
  }

  private ensureStatusFileExists(): void {
    const dir = path.dirname(this.statusFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.statusFilePath)) {
      fs.writeFileSync(this.statusFilePath, JSON.stringify(null));
    }
  }

  private loadStatus(): void {
    try {
      const data = fs.readFileSync(this.statusFilePath, "utf8");
      this.currentStatus = JSON.parse(data);
      debugLog("Loaded download status:", this.currentStatus);
    } catch (error) {
      debugLog("Failed to load download status:", error);
      this.currentStatus = null;
    }
  }

  private saveStatus(): void {
    try {
      fs.writeFileSync(this.statusFilePath, JSON.stringify(this.currentStatus, null, 2));
      debugLog("Saved download status:", this.currentStatus);
    } catch (error) {
      debugLog("Failed to save download status:", error);
    }
  }

  getCurrentStatus(): ServerDownloadStatus | null {
    this.loadStatus();

    if (this.currentStatus && this.currentStatus.status === ServerDownloadStatusType.ACTIVE) {
      const startTime = DateTime.fromMillis(this.currentStatus.startTime);
      const lastActivity = this.currentStatus.lastActivity
        ? DateTime.fromMillis(this.currentStatus.lastActivity)
        : startTime;

      const timeSinceActivity = dateTimeNow().diff(lastActivity);
      const hangThreshold = Duration.fromObject({ minutes: 10 });

      if (timeSinceActivity > hangThreshold) {
        this.currentStatus.status = ServerDownloadStatusType.HUNG;
        this.currentStatus.canOverride = true;
        this.saveStatus();
      }
    }

    return this.currentStatus;
  }

  canStartNewDownload(): DownloadConflictResponse {
    const currentStatus = this.getCurrentStatus();

    if (!currentStatus) {
      return { allowed: true };
    }

    if (currentStatus.status === ServerDownloadStatusType.ACTIVE) {
      return {
        allowed: false,
        reason: "Another download is currently in progress.",
        activeDownload: currentStatus
      };
    }

    if (currentStatus.status === ServerDownloadStatusType.HUNG) {
      return {
        allowed: false,
        reason: "Previous download appears to be hung. Use override option to terminate it.",
        activeDownload: currentStatus
      };
    }

    return { allowed: true };
  }

  startDownload(fileName: string, processId?: number): void {
    const now = dateTimeNowAsValue();
    this.currentStatus = {
      fileName,
      status: ServerDownloadStatusType.ACTIVE,
      startTime: now,
      processId,
      canOverride: false,
      lastActivity: now
    };
    this.saveStatus();
    debugLog("Started download:", this.currentStatus);
  }

  updateActivity(): void {
    if (this.currentStatus && this.currentStatus.status === ServerDownloadStatusType.ACTIVE) {
      this.currentStatus.lastActivity = dateTimeNowAsValue();
      this.saveStatus();
    }
  }

  completeDownload(status: ServerDownloadStatusType.COMPLETED | ServerDownloadStatusType.ERROR = ServerDownloadStatusType.COMPLETED): void {
    if (this.currentStatus) {
      this.currentStatus.status = status;
      this.currentStatus.lastActivity = dateTimeNowAsValue();
      this.saveStatus();
      debugLog("Completed download with status:", status);

      const cleanupDelay = Duration.fromObject({ seconds: 5 });
      setTimeout(() => {
        this.currentStatus = null;
        this.saveStatus();
        debugLog("Cleared download status after completion");
      }, cleanupDelay.toMillis());
    }
  }

  overrideDownload(fileName: string): OperationResult {
    const currentStatus = this.getCurrentStatus();

    if (!currentStatus || currentStatus.fileName !== fileName) {
      return { success: false, message: "No matching download found to override" };
    }

    if (!currentStatus.canOverride && currentStatus.status === ServerDownloadStatusType.ACTIVE) {
      const lastActivity = currentStatus.lastActivity
        ? DateTime.fromMillis(currentStatus.lastActivity)
        : DateTime.fromMillis(currentStatus.startTime);

      const timeSinceActivity = dateTimeNow().diff(lastActivity);
      const safeOverrideThreshold = Duration.fromObject({ minutes: 5 });

      if (timeSinceActivity < safeOverrideThreshold) {
        return { success: false, message: "Download appears to be active. Wait or try again in a few minutes." };
      }
    }

    if (currentStatus.processId) {
      try {
        process.kill(currentStatus.processId, "SIGTERM");
        debugLog("Terminated process:", currentStatus.processId);
      } catch (error) {
        debugLog("Failed to terminate process:", error);
      }
    }

    this.currentStatus = null;
    this.saveStatus();

    return { success: true, message: `Successfully overrode download: ${fileName}` };
  }
}

export const downloadStatusManager = new DownloadStatusManager();
