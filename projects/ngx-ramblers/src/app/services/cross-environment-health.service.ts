import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { CrossEnvironmentHealthResponse } from "../models/health.model";

@Injectable({
  providedIn: "root"
})
export class CrossEnvironmentHealthService {
  private logger: Logger = inject(LoggerFactory).createLogger("CrossEnvironmentHealthService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);

  async healthCheck(): Promise<CrossEnvironmentHealthResponse> {
    try {
      const response = await this.http.get<CrossEnvironmentHealthResponse>("/api/health/environments").toPromise();
      this.logger.debug("Cross-environment health check:", response);
      return response;
    } catch (error: any) {
      this.logger.error("Failed to get cross-environment health:", error);
      throw error;
    }
  }
}
