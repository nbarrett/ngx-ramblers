import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailConfigService } from "./mail-config.service";

@Injectable({
  providedIn: "root"
})
export class MailLinkService {
  private baseUrl: string;
  private logger: Logger;

  constructor(private mailConfigService: MailConfigService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailLinkService", NgxLoggerLevel.OFF);
    this.queryData();
  }

  queryData(): void {
    this.logger.info("queryData:");
    this.mailConfigService.getConfig().then(config => {
      this.logger.info("config:", config);
      this.baseUrl = config.baseUrl;
    });
  }

  public campaigns() {
    return `${this.baseUrl}/campaigns`;
  }

  public campaignPreview(webId: number) {
    return `${this.baseUrl}/campaigns/preview-content-html?id=${webId}`;
  }

  public completeInMail(webId: number) {
    return `${this.baseUrl}/campaigns/wizard/neapolitan?id=${webId}`;
  }

  public campaignEdit(webId: number) {
    return `${this.baseUrl}/campaigns/edit?id=${webId}`;
  }

  public templateEdit(templateId: number) {
    return `${this.baseUrl}/camp/template/${templateId}/message-setup`;
  }

  public listView(webId: number) {
    return `${this.baseUrl}/lists/members/?id=${webId}`;
  }

}
