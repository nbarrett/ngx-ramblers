import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailConfigService } from "./mail-config.service";
import { MailConfig } from "../../models/mail.model";

@Injectable({
  providedIn: "root"
})
export class MailLinkService {
  private logger: Logger;
  private config: MailConfig;

  constructor(private mailConfigService: MailConfigService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailLinkService", NgxLoggerLevel.OFF);
    this.queryData();
  }

  queryData(): void {
    this.logger.info("queryData:");
    this.mailConfigService.getConfig().then(config => {
      this.logger.info("config:", config);
      this.config = config;
    });
  }

  public campaigns() {
    return `${this.config.baseUrl}/campaigns`;
  }

  public myBaseUrl() {
    return this.config.myBaseUrl;
  }

  public appUrl() {
    return this.config.baseUrl;
  }

  public campaignPreview(webId: number) {
    return `${this.config.baseUrl}/campaigns/preview-content-html?id=${webId}`;
  }

  public completeInMail(webId: number) {
    return `${this.config.baseUrl}/campaigns/wizard/neapolitan?id=${webId}`;
  }

  public campaignEdit(webId: number) {
    return `${this.config.baseUrl}/campaigns/edit?id=${webId}`;
  }

  public templateEdit(templateId: number) {
    return `${this.config.myBaseUrl}/camp/template/${templateId}/message-setup`;
  }

  public listView(webId: number) {
    return `${this.config.baseUrl}/contact/list/id/${webId}`;
  }

  public openUrl(url: string, target?: string): void {
    window.open(url, target || "_blank");
  }

}
