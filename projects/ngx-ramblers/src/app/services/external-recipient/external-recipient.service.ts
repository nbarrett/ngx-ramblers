import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../../models/api-response.model";
import { CreateExternalRecipientRequest, ExternalRecipient } from "../../models/external-recipient.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";

interface ListResponse extends ApiResponse {
  response: ExternalRecipient[];
}

interface SingleResponse extends ApiResponse {
  response: ExternalRecipient;
}

@Injectable({ providedIn: "root" })
export class ExternalRecipientService {
  private readonly logger: Logger = inject(LoggerFactory).createLogger("ExternalRecipientService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private readonly BASE_URL = "/api/database/external-recipients";

  async list(): Promise<ExternalRecipient[]> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.get<ListResponse>(this.BASE_URL));
    return apiResponse.response ?? [];
  }

  async create(input: CreateExternalRecipientRequest): Promise<ExternalRecipient> {
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<SingleResponse>(this.BASE_URL, input));
    return apiResponse.response;
  }

  async delete(id: string): Promise<void> {
    await this.commonDataService.responseFrom(this.logger, this.http.delete<ApiResponse>(`${this.BASE_URL}/${encodeURIComponent(id)}`));
  }
}
