import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Observable, Subject } from "rxjs";
import { isString } from "es-toolkit/compat";
import { ApiResponse } from "../../models/api-response.model";
import {
  ApexRedirectResponse,
  CreateEnvironmentResponse,
  CustomDomainResponse,
  EnvironmentDefaults,
  EnvironmentSetupRequest,
  EnvironmentStatus,
  HostnameHealthReport,
  ExistingEnvironmentsResponse,
  GroupsByAreaResponse,
  MongoClusterInfo,
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

  async generateContributorBundle(environmentName: string, schema: string, clone: boolean): Promise<Blob> {
    const options = {...this.opts, responseType: "blob" as const};
    try {
      return await firstValueFrom(this.http.post(`${this.BASE_URL}/contributor-bundle`, {environmentName, schema, clone}, options));
    } catch (error) {
      throw new Error(await this.bundleErrorMessage(error));
    }
  }

  async schemaExists(name: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.get<{ exists: boolean }>(`${this.BASE_URL}/schema-exists`, {...this.opts, params: {name}})
    );
    return response?.exists === true;
  }

  private async bundleErrorMessage(error: unknown): Promise<string> {
    const httpError = error as HttpErrorResponse;
    const body = httpError?.error;
    if (body instanceof Blob) {
      const fromBlob = await this.parseBlobError(body);
      if (fromBlob) {
        return fromBlob;
      }
    } else if (isString(body?.error)) {
      return body.error;
    }
    return httpError?.message || "Could not generate the bundle - check the details and try again.";
  }

  private async parseBlobError(blob: Blob): Promise<string | null> {
    try {
      const parsed = JSON.parse(await blob.text());
      return isString(parsed?.error) ? parsed.error : null;
    } catch {
      return null;
    }
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

  async mongoClusters(): Promise<{ clusters: MongoClusterInfo[] }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.BASE_URL}/mongo-clusters`, this.opts),
      this.notifications
    );
    return response as unknown as { clusters: MongoClusterInfo[] };
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

  async hostnameHealth(environmentName: string): Promise<HostnameHealthReport> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.get<ApiResponse>(`${this.BASE_URL}/hostname-status/${environmentName}`, this.opts),
      this.notifications
    );
    return response as unknown as HostnameHealthReport;
  }

  async setupSubdomain(environmentName: string): Promise<{ success: boolean; message: string; hostname?: string }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/setup-subdomain/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as unknown as { success: boolean; message: string; hostname?: string };
  }

  async removeSubdomain(environmentName: string): Promise<{ success: boolean; message: string; hostname?: string; logs?: string[] }> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/remove-subdomain/${environmentName}`, {}, this.opts),
      this.notifications
    );
    return response as unknown as { success: boolean; message: string; hostname?: string; logs?: string[] };
  }

  async addCustomDomain(environmentName: string, hostname: string): Promise<CustomDomainResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/add-custom-domain/${environmentName}`, {hostname}, this.opts),
      this.notifications
    );
    return response as unknown as CustomDomainResponse;
  }

  async removeCustomDomain(environmentName: string, hostname: string): Promise<CustomDomainResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/remove-custom-domain/${environmentName}`, {hostname}, this.opts),
      this.notifications
    );
    return response as unknown as CustomDomainResponse;
  }

  async checkCustomDomain(environmentName: string, hostname: string): Promise<CustomDomainResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/check-custom-domain/${environmentName}`, {hostname}, this.opts),
      this.notifications
    );
    return response as unknown as CustomDomainResponse;
  }

  async setupApexRedirect(environmentName: string, hostname: string): Promise<ApexRedirectResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/setup-apex-redirect/${environmentName}`, {hostname}, this.opts),
      this.notifications
    );
    return response as unknown as ApexRedirectResponse;
  }

  async removeApexRedirect(environmentName: string, hostname: string): Promise<ApexRedirectResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/remove-apex-redirect/${environmentName}`, {hostname}, this.opts),
      this.notifications
    );
    return response as unknown as ApexRedirectResponse;
  }

}
