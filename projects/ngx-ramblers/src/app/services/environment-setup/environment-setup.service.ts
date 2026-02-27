import { HttpClient, HttpHeaders } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable, Subject } from "rxjs";
import { ApiResponse } from "../../models/api-response.model";
import {
  CreateEnvironmentResponse,
  EnvironmentDefaults,
  EnvironmentSetupRequest,
  EnvironmentStatus,
  ExistingEnvironmentsResponse,
  GitHubPushResponse,
  GitHubSecretStatus,
  GroupsByAreaResponse,
  MongoDbConfig,
  RamblersAreaLookup,
  ResumeEnvironmentResponse,
  SetupStatusResponse,
  ValidateRequestResponse,
  ValidationResult
} from "../../models/environment-setup.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class EnvironmentSetupService {

  private logger: Logger = inject(LoggerFactory).createLogger("EnvironmentSetupService", NgxLoggerLevel.ERROR);
  private commonDataService = inject(CommonDataService);
  private http = inject(HttpClient);
  private BASE_URL = "/api/environment-setup";
  private notifications = new Subject<ApiResponse>();
  private setupApiKey: string | null = null;

  setSetupApiKey(key: string): void {
    this.setupApiKey = key;
  }

  private get opts(): { headers?: HttpHeaders } {
    return this.setupApiKey
      ? { headers: new HttpHeaders({"x-setup-api-key": this.setupApiKey}) }
      : {};
  }

  setupNotifications(): Observable<ApiResponse> {
    return this.notifications.asObservable();
  }

  async status(): Promise<SetupStatusResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.BASE_URL}/status`),
      this.notifications
    );
    return response as unknown as SetupStatusResponse;
  }

  async groupsByArea(lookup: RamblersAreaLookup): Promise<GroupsByAreaResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/ramblers/groups-by-area`, lookup, this.opts),
      this.notifications
    );
    return response as unknown as GroupsByAreaResponse;
  }

  async validateRamblersApiKey(apiKey: string): Promise<ValidationResult> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/ramblers/validate-api-key`, {apiKey}, this.opts),
      this.notifications
    );
    return response as unknown as ValidationResult;
  }

  async validateMongodb(config: MongoDbConfig): Promise<ValidationResult> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/validate/mongodb`, config, this.opts),
      this.notifications
    );
    return response as unknown as ValidationResult;
  }

  async validateAwsAdmin(): Promise<ValidationResult> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/validate/aws-admin`, {}, this.opts),
      this.notifications
    );
    return response as unknown as ValidationResult;
  }

  async validateRequest(request: EnvironmentSetupRequest): Promise<ValidateRequestResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/validate/request`, request, this.opts),
      this.notifications
    );
    return response as unknown as ValidateRequestResponse;
  }

  async createEnvironment(request: EnvironmentSetupRequest): Promise<CreateEnvironmentResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/create`, request, this.opts),
      this.notifications
    );
    return response as unknown as CreateEnvironmentResponse;
  }

  async defaults(): Promise<EnvironmentDefaults> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.BASE_URL}/defaults`, this.opts),
      this.notifications
    );
    return response as unknown as EnvironmentDefaults;
  }

  async environmentDetails(environmentName: string): Promise<{
    environmentBasics: { memory: string; scaleCount: number; organisation: string };
    serviceConfigs: {
      mongodb: { cluster: string; username: string; password: string };
      aws: { region: string };
      brevo: { apiKey: string };
      googleMaps: { apiKey: string };
      osMaps: { apiKey: string };
      recaptcha: { siteKey: string; secretKey: string };
      ramblers: { apiKey: string };
      flyio: { personalAccessToken: string };
    };
    ramblersInfo: { areaCode: string; areaName: string; groupCode: string; groupName: string };
  }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.BASE_URL}/environment-details/${environmentName}`, this.opts),
      this.notifications
    );
    return response as any;
  }

  async existingEnvironments(): Promise<ExistingEnvironmentsResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.BASE_URL}/existing-environments`, this.opts),
      this.notifications
    );
    return response as unknown as ExistingEnvironmentsResponse;
  }

  async resumeEnvironment(environmentName: string, runDbInit: boolean, runFlyDeployment: boolean): Promise<ResumeEnvironmentResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/resume`, {environmentName, runDbInit, runFlyDeployment}, this.opts),
      this.notifications
    );
    return response as unknown as ResumeEnvironmentResponse;
  }

  async destroyEnvironment(environmentName: string): Promise<{ success: boolean; message: string; steps?: { step: string; success: boolean; message: string }[] }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.delete<ApiResponse>(`${this.BASE_URL}/destroy/${environmentName}`, this.opts),
      this.notifications
    );
    return response as unknown as { success: boolean; message: string };
  }

  async copyAssets(environmentName: string): Promise<{
    success: boolean;
    message: string;
    copiedAssets?: { icons: string[]; logos: string[]; backgrounds: string[] };
    failures?: { file: string; error: string }[];
  }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/copy-assets/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as unknown as {
      success: boolean;
      message: string;
      copiedAssets?: { icons: string[]; logos: string[]; backgrounds: string[] };
      failures?: { file: string; error: string }[];
    };
  }

  async authenticateBrevoDomain(environmentName: string): Promise<{ success: boolean; message: string; hostname?: string }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/authenticate-brevo-domain/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as unknown as { success: boolean; message: string; hostname?: string };
  }

  async seedSamplePages(environmentName: string): Promise<{ success: boolean; message: string; upsertedCount?: number }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/seed-sample-pages/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as unknown as { success: boolean; message: string; upsertedCount?: number };
  }

  async seedNotificationConfigs(environmentName: string): Promise<{ success: boolean; message: string; seededCount?: number; skippedCount?: number }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/seed-notification-configs/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as unknown as { success: boolean; message: string; seededCount?: number; skippedCount?: number };
  }

  async populateBrevoTemplates(environmentName: string): Promise<{ success: boolean; message: string; createdCount?: number; updatedCount?: number; skippedCount?: number }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/populate-brevo-templates/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as unknown as { success: boolean; message: string; createdCount?: number; updatedCount?: number; skippedCount?: number };
  }

  async adminPasswordReset(environmentName: string): Promise<{
    success: boolean;
    message: string;
    resetUrl?: string;
    flyResetUrl?: string;
    userName?: string;
    email?: string;
  }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/admin-password-reset/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as any;
  }

  async environmentStatus(environmentName: string): Promise<EnvironmentStatus> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.BASE_URL}/environment-status/${environmentName}`, this.opts),
      this.notifications
    );
    return response as unknown as EnvironmentStatus;
  }

  async setupSubdomain(environmentName: string): Promise<{ success: boolean; message: string; hostname?: string }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/setup-subdomain/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as unknown as { success: boolean; message: string; hostname?: string };
  }

  async githubStatus(): Promise<GitHubSecretStatus> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.BASE_URL}/github/status`, this.opts),
      this.notifications
    );
    return response as unknown as GitHubSecretStatus;
  }

  async pushToGitHub(): Promise<GitHubPushResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/github/push`, {}, this.opts),
      this.notifications
    );
    return response as unknown as GitHubPushResponse;
  }
}
