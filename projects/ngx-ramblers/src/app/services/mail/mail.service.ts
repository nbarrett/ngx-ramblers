import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject } from "rxjs";
import { ApiResponse } from "../../models/api-response.model";
import { CommonDataService } from "../common-data-service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { Account, MailTemplates, SendSmtpEmailRequest, TemplateOptions } from "../../models/mail.model";

@Injectable({
  providedIn: "root"
})
export class MailService {
  private readonly logger: Logger;
  private BASE_URL = "api/mail";

  constructor(private http: HttpClient,
              private commonDataService: CommonDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("TransactionalMailService", NgxLoggerLevel.OFF);
  }

  async sendTransactionalMessage(emailRequest: SendSmtpEmailRequest): Promise<void> {
    const subject = new Subject<ApiResponse>();
    this.logger.info("sendMessage emailRequest:", emailRequest);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/transactional/send`, emailRequest), subject)).response;
  }

  async queryAccount(): Promise<Account> {
    const subject = new Subject<ApiResponse>();
    this.logger.info("queryAccount");
    return (await this.commonDataService.responseFrom(this.logger, this.http.get<ApiResponse>(`${this.BASE_URL}/account`), subject)).response;
  }

  async queryTemplates(templateOptions?: TemplateOptions): Promise<MailTemplates> {
    const subject = new Subject<ApiResponse>();
    this.logger.info("template list templateOptions:", templateOptions);
    return (await this.commonDataService.responseFrom(this.logger, this.http.post<ApiResponse>(`${this.BASE_URL}/templates`, templateOptions), subject)).response;
  }

}
