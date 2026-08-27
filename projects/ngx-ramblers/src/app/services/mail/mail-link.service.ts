import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailConfigService } from "./mail-config.service";
import { MailConfig } from "../../models/mail.model";
import { MemberResourcesReferenceDataService } from "../member/member-resources-reference-data.service";

@Injectable({
  providedIn: "root"
})
export class MailLinkService {
  private logger: Logger = inject(LoggerFactory).createLogger("MailLinkService", NgxLoggerLevel.ERROR);
  private mailConfigService = inject(MailConfigService);
  private memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  private config: MailConfig;
  private platformAdminEnabled = false;

  constructor() {
    this.queryConfig();
    this.memberResourcesReferenceData.platformAdminEnabledChanges().subscribe(enabled => {
      this.platformAdminEnabled = enabled;
    });
  }

  get canNavigateToBrevo(): boolean {
    return this.platformAdminEnabled;
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

  public listView(listId: number) {
    return `${this.config.baseUrl}/contact/list/id/${listId}`;
  }

  profileInformation() {
    return `${this.config.baseUrl}/profile/information`;
  }

  public contactView(contactId: number) {
    return this.config?.baseUrl ? `${this.config.baseUrl}/contact/index/${contactId}` : "";
  }

  public apiKeysView() {
    return `${this.config.baseUrl}/settings/keys/api`;
  }

  public smtpKeysView() {
    return `${this.config.baseUrl}/settings/keys/smtp`;
  }

  public openUrl(url: string, target?: string): void {
    if (this.platformAdminEnabled && url) {
      window.open(url, target || "_blank");
    }
  }

}
