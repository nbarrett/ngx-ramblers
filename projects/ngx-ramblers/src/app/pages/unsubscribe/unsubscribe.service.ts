import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ApiResponse } from "../../models/api-response.model";
import { CommonDataService } from "../../services/common-data-service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UnsubscribeConfirmResponse, UnsubscribeFeedbackResponse } from "../../models/mail.model";

@Injectable({ providedIn: "root" })
export class UnsubscribeService {

  private logger: Logger = inject(LoggerFactory).createLogger("UnsubscribeService", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private commonDataService = inject(CommonDataService);
  private BASE_URL = "api/mail/unsubscribe";

  async confirm(token: string): Promise<UnsubscribeConfirmResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/confirm`, { t: token })
    );
    return response.response as UnsubscribeConfirmResponse;
  }

  async submitFeedback(token: string, reason: string, comment: string): Promise<UnsubscribeFeedbackResponse> {
    const response = await this.commonDataService.responseFrom(
      this.logger,
      this.http.post<ApiResponse>(`${this.BASE_URL}/feedback`, { t: token, reason, comment })
    );
    return response.response as UnsubscribeFeedbackResponse;
  }
}
