import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { CrossEnvironmentHealthResponse, EnvironmentHealthCheck, HealthWebAnalytics } from "../models/health.model";
import { CrossEnvironmentHostnameHealth } from "../models/environment-setup.model";

@Injectable({
  providedIn: "root"
})
export class CrossEnvironmentHealthService {
  private logger: Logger = inject(LoggerFactory).createLogger("CrossEnvironmentHealthService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private cachedResponse: CrossEnvironmentHealthResponse | null = null;

  async healthCheck(): Promise<CrossEnvironmentHealthResponse> {
    try {
      const response = await this.http.get<CrossEnvironmentHealthResponse>("/api/health/environments").toPromise();
      this.logger.debug("Cross-environment health check:", response);
      this.cachedResponse = response;
      return response;
    } catch (error: any) {
      this.logger.error("Failed to get cross-environment health:", error);
      throw error;
    }
  }

  async hostnameHealth(forceRefresh?: boolean): Promise<CrossEnvironmentHostnameHealth> {
    try {
      const url = forceRefresh ? "/api/health/hostnames?refresh=true" : "/api/health/hostnames";
      const response = await this.http.get<CrossEnvironmentHostnameHealth>(url).toPromise();
      this.logger.debug("Cross-environment hostname health:", response);
      return response;
    } catch (error: any) {
      this.logger.error("Failed to get cross-environment hostname health:", error);
      throw error;
    }
  }

  private async findCheck(environmentName: string): Promise<EnvironmentHealthCheck | null> {
    if (!environmentName) {
      return null;
    }
    const response = this.cachedResponse ?? await this.healthCheck();
    return response?.environments?.find(environment => environment.environment === environmentName) ?? null;
  }

  async webHostForEnvironment(environmentName: string): Promise<string | null> {
    const check = await this.findCheck(environmentName);
    if (!check?.adminUrl) {
      return null;
    }
    try {
      return new URL(check.adminUrl).hostname;
    } catch {
      this.logger.warn("Unparseable adminUrl for environment", environmentName, check.adminUrl);
      return null;
    }
  }

  async webAnalyticsForEnvironment(environmentName: string): Promise<HealthWebAnalytics | null> {
    const check = await this.findCheck(environmentName);
    return check?.healthResponse?.webAnalytics ?? null;
  }
}
