import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailConfigService } from "./mail-config.service";
import { MailConfig, MailMessagingConfig } from "../../models/mail.model";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { AlertLevel, AlertMessageAndType } from "../../models/alert-target.model";
import { BroadcastService } from "../broadcast-service";

@Injectable({
  providedIn: "root"
})
export class MailLinkService {
  private logger: Logger;
  private config: MailConfig;

  constructor(private broadcastService: BroadcastService<AlertMessageAndType>,
              private mailConfigService: MailConfigService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailLinkService", NgxLoggerLevel.OFF);
    this.queryConfig();
  }

  queryConfig(): void {
    this.logger.info("queryData:");
    this.mailConfigService.queryConfig().then(config => {
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

  public editorUrl() {
    return this.config.editorUrl;
  }

  public appUrl() {
    return this.config.baseUrl;
  }

  public campaignEdit(campaignId: number) {
    return `${this.config.myBaseUrl}/camp/preview/id/${campaignId}`;
  }

  public campaignEditRichText(campaignId: number) {
    return `${this.config.editorUrl}/editor/classic/html/${campaignId}?editor=rich-text`;
  }

  public campaignEditHtml(campaignId: number) {
    return `${this.config.editorUrl}/editor/classic/html/${campaignId}?editor=html`;
  }

  public templateEdit(templateId: number) {
    return `${this.config.myBaseUrl}/camp/template/${templateId}/message-setup`;
  }

  public listView(listId: number) {
    return `${this.config.baseUrl}/contact/list/id/${listId}`;
  }

  public contactView(contactId: number) {
    return `${this.config.baseUrl}/contact/index/${contactId}`;
  }

  public apiKeysView() {
    return `${this.config.baseUrl}/settings/keys/api`;
  }

  public openUrl(url: string, target?: string): void {
    window.open(url, target || "_blank");
  }

  editTemplateWithNotifications(templateId: number, notReady: boolean, mailMessagingConfig: MailMessagingConfig) {
    if (!notReady) {
      if (mailMessagingConfig.mailConfig?.allowSendTransactional) {
        if (!templateId) {
          this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
            message: {
              title: "Edit Mail Template",
              message: "Please select a template from the drop-down before choosing edit"
            }, type: AlertLevel.ALERT_ERROR
          }));
        } else {
          const templateUrl = this.templateEdit(templateId);
          this.logger.info("editing template:", templateUrl);
          return window.open(templateUrl, "_blank");
        }
      } else {
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
          message: {
            title: "Mail Integration not enabled",
            message: "List and campaign dropdowns will not be populated"
          }, type: AlertLevel.ALERT_WARNING
        }));
      }
    }
  }
}
