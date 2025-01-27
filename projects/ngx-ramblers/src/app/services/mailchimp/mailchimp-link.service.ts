import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailchimpConfigService } from "../mailchimp-config.service";

@Injectable({
  providedIn: "root"
})
export class MailchimpLinkService {

  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpLinkService", NgxLoggerLevel.ERROR);
  private mailchimpConfigService = inject(MailchimpConfigService);
  private mailchimpApiUrl: string;

  constructor() {
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

  public completeInMailSystem(webId: number) {
    return `${this.mailchimpApiUrl}/campaigns/wizard/neapolitan?id=${webId}`;
  }

  public campaignEdit(webId: number) {
    return `${this.mailchimpApiUrl}/campaigns/edit?id=${webId}`;
  }

  public listView(webId: number) {
    return `${this.mailchimpApiUrl}/lists/members/?id=${webId}`;
  }

}
