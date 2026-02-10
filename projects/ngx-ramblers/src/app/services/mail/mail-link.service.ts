import { inject, Injectable } from "@angular/core";
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
  private logger: Logger = inject(LoggerFactory).createLogger("MailLinkService", NgxLoggerLevel.ERROR);
  private broadcastService = inject<BroadcastService<AlertMessageAndType>>(BroadcastService);
  private mailConfigService = inject(MailConfigService);
  private config: MailConfig;

  constructor() {
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
    return `${this.config.editorUrl}/editor/classic/rich-text/${campaignId}`;
  }

  public campaignEditHtml(campaignId: number) {
    return `${this.config.editorUrl}/editor/classic/html/${campaignId}`;
  }

  public templateEdit(templateId: number) {
    return `${this.config.baseUrl}/templates/email/edit/${templateId}`;
  }

  public templateEditRichText(templateId: number) {
    return `${this.config.editorUrl}/editor/template/rich-text/${templateId}`;
  }

  public listView(listId: number) {
    return `${this.config.baseUrl}/contact/list/id/${listId}`;
  }

  profileInformation() {
    return `${this.config.baseUrl}/profile/information`;
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

  private openTemplateUrl(templateId: number, notReady: boolean, mailMessagingConfig: MailMessagingConfig, urlBuilder: (id: number) => string): Window {
    if (notReady) {
      return null;
    }
    if (!mailMessagingConfig?.mailConfig?.allowSendTransactional) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
        message: {
          title: "Mail Integration not enabled",
          message: "List and campaign dropdowns will not be populated"
        }, type: AlertLevel.ALERT_WARNING
      }));
      return null;
    }
    if (!templateId) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
        message: {
          title: "Edit Mail Template",
          message: "Please select a template from the drop-down before choosing edit"
        }, type: AlertLevel.ALERT_ERROR
      }));
      return null;
    }
    const templateUrl = urlBuilder(templateId);
    this.logger.info("editing template:", templateUrl);
    return window.open(templateUrl, "_blank");
  }

  editTemplateWithNotifications(templateId: number, notReady: boolean, mailMessagingConfig: MailMessagingConfig): Window {
    return this.openTemplateUrl(templateId, notReady, mailMessagingConfig, id => this.templateEdit(id));
  }

  editTemplateRichTextWithNotifications(templateId: number, notReady: boolean, mailMessagingConfig: MailMessagingConfig): Window {
    return this.openTemplateUrl(templateId, notReady, mailMessagingConfig, id => this.templateEditRichText(id));
  }

}
