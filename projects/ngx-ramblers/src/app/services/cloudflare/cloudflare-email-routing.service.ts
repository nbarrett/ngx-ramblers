import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject } from "rxjs";
import { ApiResponse } from "../../models/api-response.model";
import {
  CreateOrUpdateEmailRouteRequest,
  CreateOrUpdateWorkerRequest,
  DestinationAddress,
  EmailRoutingLogEntry,
  EmailRoutingLogsRequest,
  EmailRoutingRule,
  EmailWorkerScript,
  NonSensitiveCloudflareConfig,
  WorkerInvocationSummary,
  WorkerLogsRequest
} from "../../models/cloudflare-email-routing.model";
import { extractErrorMessage } from "../../functions/strings";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class CloudflareEmailRoutingService {

  private logger: Logger = inject(LoggerFactory).createLogger("CloudflareEmailRoutingService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/cloudflare/email-routing";
  private rulesSubject = new BehaviorSubject<EmailRoutingRule[]>([]);
  private catchAllSubject = new BehaviorSubject<EmailRoutingRule>(null);
  private destinationAddressesSubject = new BehaviorSubject<DestinationAddress[]>([]);
  private cloudflareConfigSubject = new BehaviorSubject<NonSensitiveCloudflareConfig>(null);
  private configErrorSubject = new BehaviorSubject<string>(null);
  private configuredSubject = new BehaviorSubject<boolean>(null);
  private workersSubject = new BehaviorSubject<EmailWorkerScript[]>([]);
  private rulesLoaded = false;
  private catchAllLoaded = false;
  private destinationAddressesLoaded = false;
  private configLoaded = false;
  private workersLoaded = false;

  async queryRules(): Promise<EmailRoutingRule[]> {
    if (!this.rulesLoaded) {
      try {
        const rules: EmailRoutingRule[] = (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/rules`))).response;
        this.rulesSubject.next(rules);
        this.configErrorSubject.next(null);
        this.rulesLoaded = true;
      } catch (err) {
        this.logger.error("Failed to query email routing rules:", err);
        this.configErrorSubject.next(extractErrorMessage(err));
        throw err;
      }
    }
    return this.rulesSubject.value;
  }

  async queryCatchAllRule(): Promise<EmailRoutingRule> {
    if (!this.catchAllLoaded) {
      try {
        const rule: EmailRoutingRule = (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/rules/catch-all`))).response;
        this.catchAllSubject.next(rule);
        this.catchAllLoaded = true;
      } catch (err) {
        this.logger.error("Failed to query catch-all rule:", err);
        this.configErrorSubject.next(extractErrorMessage(err));
        throw err;
      }
    }
    return this.catchAllSubject.value;
  }

  async queryDestinationAddresses(): Promise<DestinationAddress[]> {
    if (!this.destinationAddressesLoaded) {
      try {
        const addresses: DestinationAddress[] = (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/destination-addresses`))).response;
        this.destinationAddressesSubject.next(addresses);
        this.destinationAddressesLoaded = true;
      } catch (err) {
        this.logger.error("Failed to query destination addresses:", err);
        this.configErrorSubject.next(extractErrorMessage(err));
        throw err;
      }
    }
    return this.destinationAddressesSubject.value;
  }

  async createDestinationAddress(email: string): Promise<DestinationAddress> {
    const address: DestinationAddress = (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/destination-addresses`, {email}))).response;
    this.invalidateCache();
    return address;
  }

  async deleteDestinationAddress(addressId: string): Promise<void> {
    await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/destination-addresses/${addressId}`));
    this.invalidateCache();
  }

  destinationAddressesNotifications(): BehaviorSubject<DestinationAddress[]> {
    return this.destinationAddressesSubject;
  }

  async queryCloudflareConfig(): Promise<NonSensitiveCloudflareConfig> {
    if (!this.configLoaded) {
      try {
        const config: NonSensitiveCloudflareConfig = (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/config`))).response;
        if (config.configured === false) {
          this.configuredSubject.next(false);
          this.configLoaded = true;
          return config;
        }
        this.configuredSubject.next(true);
        this.cloudflareConfigSubject.next(config);
        this.configLoaded = true;
      } catch (err) {
        this.logger.error("Failed to query cloudflare config:", err);
        this.configErrorSubject.next(extractErrorMessage(err));
        throw err;
      }
    }
    return this.cloudflareConfigSubject.value;
  }

  cloudflareConfigNotifications(): BehaviorSubject<NonSensitiveCloudflareConfig> {
    return this.cloudflareConfigSubject;
  }

  async createRule(request: CreateOrUpdateEmailRouteRequest): Promise<EmailRoutingRule> {
    const rule: EmailRoutingRule = (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/rules`, request))).response;
    this.invalidateCache();
    return rule;
  }

  async updateRule(ruleId: string, request: CreateOrUpdateEmailRouteRequest): Promise<EmailRoutingRule> {
    const rule: EmailRoutingRule = (await this.commonDataService.responseFrom(this.logger, this.http.put<ApiResponse>(`${this.BASE_URL}/rules/${ruleId}`, request))).response;
    this.invalidateCache();
    return rule;
  }

  async deleteRule(ruleId: string): Promise<void> {
    await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/rules/${ruleId}`));
    this.invalidateCache();
  }

  rulesNotifications(): BehaviorSubject<EmailRoutingRule[]> {
    return this.rulesSubject;
  }

  catchAllNotifications(): BehaviorSubject<EmailRoutingRule> {
    return this.catchAllSubject;
  }

  configErrorNotifications(): BehaviorSubject<string> {
    return this.configErrorSubject;
  }

  hasConfigError(): boolean {
    return !!this.configErrorSubject.value;
  }

  emailForwardingAvailable(): boolean {
    return this.configuredSubject.value === true && !this.configErrorSubject.value;
  }

  async queryWorkers(): Promise<EmailWorkerScript[]> {
    if (!this.workersLoaded) {
      try {
        const workers: EmailWorkerScript[] = (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/workers`))).response;
        this.workersSubject.next(workers);
        this.workersLoaded = true;
      } catch (err) {
        this.logger.error("Failed to query workers:", err);
        this.configErrorSubject.next(extractErrorMessage(err));
        throw err;
      }
    }
    return this.workersSubject.value;
  }

  async queryWorkerRecipients(scriptName: string): Promise<string[]> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/workers/${scriptName}/recipients`))).response;
  }

  async createOrUpdateWorker(request: CreateOrUpdateWorkerRequest): Promise<any> {
    const result = (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/workers`, request))).response;
    this.invalidateCache();
    return result;
  }

  async deleteWorker(scriptName: string): Promise<void> {
    await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/workers/${scriptName}`));
    this.invalidateCache();
  }

  async renameWorker(oldName: string, newName: string): Promise<any> {
    const result = (await this.commonDataService.responseFrom(this.logger, this.http.put<ApiResponse>(`${this.BASE_URL}/workers/${oldName}/rename`, {newScriptName: newName}))).response;
    this.invalidateCache();
    return result;
  }

  workersNotifications(): BehaviorSubject<EmailWorkerScript[]> {
    return this.workersSubject;
  }

  async queryEmailRoutingLogs(request: EmailRoutingLogsRequest): Promise<EmailRoutingLogEntry[]> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/logs/email-routing`, request))).response;
  }

  async queryWorkerLogs(request: WorkerLogsRequest): Promise<WorkerInvocationSummary[]> {
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/logs/workers`, request))).response;
  }

  invalidateCache() {
    this.rulesLoaded = false;
    this.catchAllLoaded = false;
    this.destinationAddressesLoaded = false;
    this.workersLoaded = false;
  }
}
