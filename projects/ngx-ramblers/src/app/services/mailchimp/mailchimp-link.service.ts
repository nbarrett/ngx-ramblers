import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailchimpConfigService } from "../mailchimp-config.service";

@Injectable({
  providedIn: "root"
})
export class MailchimpLinkService {
  private mailchimpApiUrl: string;
  private logger: Logger;

  constructor(private mailchimpConfigService: MailchimpConfigService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MailchimpLinkService, NgxLoggerLevel.OFF);
    this.queryData();
  }

  queryData(): void {
    this.logger.debug("queryData:");
    this.mailchimpConfigService.getConfig().then(config => {
      this.logger.debug("config:", config);
      this.mailchimpApiUrl = config.apiUrl;
    });
  }

  public campaigns() {
    return `${this.mailchimpApiUrl}/campaigns`;
  }

  public campaignPreview(webId: number) {
    return `${this.mailchimpApiUrl}/campaigns/preview-content-html?id=${webId}`;
  }

  public completeInMailchimp(webId: number) {
    return `${this.mailchimpApiUrl}/campaigns/wizard/neapolitan?id=${webId}`;
  }

  public campaignEdit(webId: number) {
    return `${this.mailchimpApiUrl}/campaigns/edit?id=${webId}`;
  }

  public listView(webId: number) {
    return `${this.mailchimpApiUrl}/lists/members/?id=${webId}`;
  }

}
