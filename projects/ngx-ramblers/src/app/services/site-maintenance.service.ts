import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { HealthResponse, HealthStatus } from "../models/health.model";
import { DateUtilsService } from "./date-utils.service";
import { MigrationRetryResult } from "../models/mongo-migration-model";

@Injectable({
  providedIn: "root"
})
export class SiteMaintenanceService {
  private logger: Logger = inject(LoggerFactory).createLogger("SiteMaintenanceService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private dateUtils = inject(DateUtilsService);

  async getMigrationStatus(): Promise<HealthResponse> {
    try {
      const response = await this.http.get<HealthResponse>("/api/system-status").toPromise();
      this.logger.debug("Migration status:", response);
      return response;
    } catch (error: any) {
      if (error.status === 503 && error.error) {
        this.logger.debug("System status endpoint returned 503 (DEGRADED):", error.error);
        return error.error;
      }
      this.logger.error("Failed to get migration status:", error);
      return {
        status: HealthStatus.DEGRADED,
        environment: { env: "unknown" },
        aws: {},
        group: {},
        timestamp: this.dateUtils.isoDateTimeNow(),
        migrations: {
          pending: 0,
          applied: 0,
          failed: true,
          files: []
        }
      };
    }
  }

  async retryMigrations(): Promise<MigrationRetryResult> {
    try {
      const response = await this.http.post<MigrationRetryResult>("/api/database/migrations/retry", {}).toPromise();
      this.logger.info("Migration retry result:", response);
      return response;
    } catch (error: any) {
      this.logger.error("Failed to retry migrations:", error);
      throw error;
    }
  }

  async simulateFailure(pending = 1, failed = true): Promise<{ success: boolean }> {
    try {
      const response = await this.http.post<{ success: boolean }>("/api/database/migrations/simulate-failure", { pending, failed }).toPromise();
      this.logger.info("Simulated failure:", response);
      return response;
    } catch (error: any) {
      this.logger.error("Failed to simulate failure:", error);
      throw error;
    }
  }

  async clearSimulation(): Promise<{ success: boolean }> {
    try {
      const response = await this.http.post<{ success: boolean }>("/api/database/migrations/clear-simulation", {}).toPromise();
      this.logger.info("Cleared simulation:", response);
      return response;
    } catch (error: any) {
      this.logger.error("Failed to clear simulation:", error);
      throw error;
    }
  }

  async readSimulation(): Promise<{ active: boolean; collection: string }> {
    try {
      const response = await this.http.get<{ active: boolean; collection: string }>("/api/database/migrations/simulation").toPromise();
      this.logger.debug("Simulation state:", response);
      return response;
    } catch (error: any) {
      this.logger.error("Failed to read simulation state:", error);
      return { active: false, collection: "changelog" };
    }
  }

  async retryMigration(fileName: string): Promise<MigrationRetryResult> {
    try {
      const response = await this.http.post<MigrationRetryResult>(`/api/database/migrations/retry/${encodeURIComponent(fileName)}`, {}).toPromise();
      this.logger.info("Retry single migration:", fileName, response);
      return response;
    } catch (error: any) {
      this.logger.error("Failed to retry single migration:", fileName, error);
      throw error;
    }
  }

  async clearFailedMigrations(): Promise<{ success: boolean; deletedCount: number }> {
    try {
      const response = await this.http.post<{ success: boolean; deletedCount: number }>("/api/database/migrations/clear-failed", {}).toPromise();
      this.logger.info("Cleared failed migrations:", response);
      return response;
    } catch (error: any) {
      this.logger.error("Failed to clear failed migrations:", error);
      throw error;
    }
  }
}
