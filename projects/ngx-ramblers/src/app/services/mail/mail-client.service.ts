import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { ApiResponse } from "../../models/api-response.model";
import {
  MailClientConnectionSettings,
  MailClientCredentialCreated,
  MailClientCredentialView,
  MailClientCreateCredentialRequest
} from "../../models/mail-client.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class MailClientService {
  private logger: Logger = inject(LoggerFactory).createLogger("MailClientService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private baseUrl = "/api/mail-client";

  settings(): Promise<MailClientConnectionSettings> {
    return this.response<MailClientConnectionSettings>(this.http.get<ApiResponse>(`${this.baseUrl}/settings`));
  }

  credentials(): Promise<MailClientCredentialView[]> {
    return this.response<MailClientCredentialView[]>(this.http.get<ApiResponse>(`${this.baseUrl}/credentials`));
  }

  createCredential(body: MailClientCreateCredentialRequest): Promise<MailClientCredentialCreated> {
    return this.response<MailClientCredentialCreated>(this.http.post<ApiResponse>(`${this.baseUrl}/credentials`, body));
  }

  revokeCredential(id: string): Promise<{revoked: boolean}> {
    return this.response<{revoked: boolean}>(this.http.delete<ApiResponse>(`${this.baseUrl}/credentials/${id}`));
  }

  private async response<T>(observable: Observable<ApiResponse>): Promise<T> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, observable);
    return apiResponse.response as T;
  }
}
