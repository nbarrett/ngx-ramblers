import { HttpClient, HttpEventType } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { CrossEnvironmentHealthResponse, EnvironmentHealthCheck, EnvironmentHealthEvent, EnvironmentHealthEventType, EnvironmentHealthProgress, HealthWebAnalytics } from "../models/health.model";
import { CrossEnvironmentHostnameHealth } from "../models/environment-setup.model";

import {Observable} from "rxjs";
import {environmentHealthSummary} from "../functions/environment-health";

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

  progressiveHealthCheck(): Observable<EnvironmentHealthProgress> {
    return new Observable(observer => {
      const state = {offset: 0, buffer: "", response: null as CrossEnvironmentHealthResponse | null, complete: false};
      const accept = (event: EnvironmentHealthEvent): void => {
        if (event.type === EnvironmentHealthEventType.ERROR) {
          throw new Error(event.error || "Environment health check failed");
        } else if (event.type === EnvironmentHealthEventType.START) {
          state.response = {timestamp: event.timestamp, environments: [], summary: environmentHealthSummary([], event.total)};
          observer.next({response: state.response, complete: false});
        } else if (state.response && event.type === EnvironmentHealthEventType.RESULT && event.environment) {
          const environments = [...state.response.environments, event.environment];
          state.response = {timestamp: event.timestamp, environments, summary: environmentHealthSummary(environments, state.response.summary.total)};
          observer.next({response: state.response, complete: false});
        } else if (state.response && event.type === EnvironmentHealthEventType.COMPLETE) {
          if (state.response.environments.length !== state.response.summary.total) {
            throw new Error("Environment health checks ended before all results arrived. Refresh to try again.");
          }
          state.complete = true;
          state.response = {...state.response, timestamp: event.timestamp};
          this.cachedResponse = state.response;
          observer.next({response: state.response, complete: true});
        }
      };
      const receive = (text: string): void => {
        state.buffer += text.slice(state.offset);
        state.offset = text.length;
        const lines = state.buffer.split("\n");
        state.buffer = lines.pop() || "";
        lines.filter(line => line.trim()).forEach(line => accept(JSON.parse(line)));
      };
      const subscription = this.http.get("/api/health/environments/stream", {observe: "events", responseType: "text", reportProgress: true}).subscribe({
        next: event => {
          try {
            if (event.type === HttpEventType.DownloadProgress && event.partialText) {
              receive(event.partialText);
            } else if (event.type === HttpEventType.Response) {
              receive(event.body || "");
              if (state.complete) {
                observer.complete();
              } else {
                observer.error(new Error("Environment health checks ended before all results arrived. Refresh to try again."));
              }
            }
          } catch (error) {
            observer.error(error);
          }
        },
        error: error => observer.error(error)
      });
      return () => subscription.unsubscribe();
    });
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
