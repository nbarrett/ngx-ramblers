import { inject, Injectable } from "@angular/core";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { CommonDataService } from "../../services/common-data-service";
import { HttpClient } from "@angular/common/http";
import { ValidateTokenApiResponse, ValidateTokenRequest, ValidateTokenResponse } from "../../models/committee.model";
import { SendSmtpEmailRequest } from "../../models/mail.model";
import { ApiResponse } from "../../models/api-response.model";

@Injectable({
  providedIn: "root"
})
export class ContactUsService {
  private BASE_URL = "/api/contact-us";
  private commonDataService: CommonDataService = inject(CommonDataService);
  private http: HttpClient = inject(HttpClient);
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("ContactUsService", NgxLoggerLevel.ERROR);

  constructor() {
    this.logger.info("ModalService constructed");

  }

  async validateToken(validateTokenRequest: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    this.logger.info("validateTokenRequest:", validateTokenRequest);
    const apiResponse = await this.commonDataService.responseFrom(this.logger, this.http.post<ValidateTokenApiResponse>(`${this.BASE_URL}/validate-token`, validateTokenRequest));
    this.logger.info("validateToken - received", apiResponse);
    return apiResponse.response;
  }

  async sendTransactionalMessage(emailRequest: SendSmtpEmailRequest): Promise<void> {
    this.logger.info("sendMessage emailRequest:", emailRequest);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/transactional/send`, emailRequest))).response;
  }

}
