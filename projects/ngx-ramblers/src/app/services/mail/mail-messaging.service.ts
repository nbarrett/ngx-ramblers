import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailConfigService } from "./mail-config.service";
import { Member } from "../../models/member.model";
import {
  BuiltInProcessMappings,
  CreateSendSmtpEmailRequest,
  DEFAULT_MAIL_MESSAGING_CONFIG,
  EmailAddress,
  MailMessagingConfig,
  MailTemplates,
  MemberMergeFields,
  NOTIFICATION_CONFIG_DEFAULTS,
  NotificationConfig,
  NotificationConfigListing,
  NotificationSubject,
  ProcessToTemplateMappings,
  SendSmtpEmailParams,
  SendSmtpEmailRequest,
  SystemMergeFields
} from "../../models/mail.model";
import { DateUtilsService } from "../date-utils.service";

import { CommitteeConfigService } from "../committee/commitee-config.service";
import { SystemConfigService } from "../system/system-config.service";
import { Observable, ReplaySubject } from "rxjs";
import { sortBy } from "../arrays";
import { BannerConfigService } from "../banner-config.service";
import { UrlService } from "../url.service";
import { MemberLoginService } from "../member/member-login.service";
import { NotificationComponent } from "../../notifications/common/notification.component";
import { ContactUsComponent } from "../../committee/contact-us/contact-us";
import { NotificationDirective } from "../../notifications/common/notification.directive";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { extractParametersFrom, notificationMappings } from "../../common/mail-parameters";
import { KeyValue } from "../enums";
import { NotificationConfigService } from "../notification-config.service";
import { StringUtilsService } from "../string-utils.service";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { AlertLevel } from "../../models/alert-target.model";
import { BroadcastService } from "../broadcast-service";
import { MailService } from "./mail.service";
import { AlertInstance } from "../notifier.service";


@Injectable({
  providedIn: "root"
})
export class MailMessagingService {

  private subject = new ReplaySubject<MailMessagingConfig>();
  private mailMessagingConfig: MailMessagingConfig = DEFAULT_MAIL_MESSAGING_CONFIG();
  private broadcastService: BroadcastService<any> = inject(BroadcastService);
  private mailService: MailService = inject(MailService);
  private urlService: UrlService = inject(UrlService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private committeeConfig: CommitteeConfigService = inject(CommitteeConfigService);
  private mailConfigService: MailConfigService = inject(MailConfigService);
  private notificationConfigService: NotificationConfigService = inject(NotificationConfigService);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  private bannerConfigService: BannerConfigService = inject(BannerConfigService);
  private stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private memberLoginService: MemberLoginService = inject(MemberLoginService);
  private fullNamePipe: FullNamePipe = inject(FullNamePipe);
  private logger: Logger = inject(LoggerFactory).createLogger("MailMessagingService", NgxLoggerLevel.OFF);

  constructor() {
    this.initialise();
  }

  initialise(): void {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
      message: {
        title: "Mail Settings",
        message: "Getting Mail Settings"
      }, type: AlertLevel.ALERT_SUCCESS
    }));
    this.logger.off("initialising data:");
    this.committeeConfig.events().subscribe(data => {
      this.mailMessagingConfig.committeeReferenceData = data;
      this.emitConfigWhenReadyGiven("committeeConfig");
    });
    this.systemConfigService.events().subscribe(item => {
      this.mailMessagingConfig.group = item.group;
      this.emitConfigWhenReadyGiven("systemConfigService:group");
    });
    this.mailConfigService.queryConfig().then(config => {
      this.logger.off("config:", config);
      this.mailMessagingConfig.mailConfig = config;
      if (!config.allowSendTransactional) {
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
          message: {
            title: "Mail Integration not enabled",
            message: "List and template dropdowns will not be populated"
          }, type: AlertLevel.ALERT_WARNING
        }));
      }
      this.emitConfigWhenReadyGiven("mailConfigService");
    });
    this.bannerConfigService.all().then((banners) => {
      this.logger.off("retrieved banners:", banners);
      this.mailMessagingConfig.banners = banners.filter(item => item.fileNameData).sort(sortBy("name"));
      this.emitConfigWhenReadyGiven("banners");
    });
    this.notificationConfigService.all().then((notificationConfigs) => {
      this.logger.off("retrieved notificationConfigs:", notificationConfigs);
      this.mailMessagingConfig.notificationConfigs = notificationConfigs.sort(sortBy("subject.text"));
      this.emitConfigWhenReadyGiven("notificationConfigs");
    });
    this.refreshTemplates();
  }

  notificationConfigs(configListing: NotificationConfigListing): NotificationConfig[] {
    const mailConfig = configListing.mailMessagingConfig.mailConfig;
    const workflowIds: string[] = [mailConfig.forgotPasswordNotificationConfigId, mailConfig.walkNotificationConfigId, mailConfig.expenseNotificationConfigId];
    const notificationConfigs = this.mailMessagingConfig.notificationConfigs
      .filter(item => (configListing.includeWorkflowRelatedConfigs || !workflowIds.includes(item.id)))
      .filter(item => !configListing.includeMemberSelections || configListing.includeMemberSelections.length === 0 || configListing.includeMemberSelections.includes(item.defaultMemberSelection))
      .filter(item => !configListing.excludeMemberSelections || configListing.excludeMemberSelections.length === 0 || !configListing.excludeMemberSelections.includes(item.defaultMemberSelection));
    this.logger.off("workflowIds:", workflowIds, "mailConfig:", mailConfig, "includeWorkflowRelatedConfigs:", configListing.includeWorkflowRelatedConfigs, "-> notificationConfigs:", notificationConfigs,);
    return notificationConfigs;
  }

  private emitConfigWhenReadyGiven(reason: string) {
    if (this.mailMessagingConfig.mailTemplates && this.mailMessagingConfig.committeeReferenceData && this.mailMessagingConfig.group && this.mailMessagingConfig.mailConfig && this.mailMessagingConfig.banners && this.mailMessagingConfig.notificationConfigs) {
      this.migrateTemplateMappings();
      this.logger.info("received", reason, "emitting mailMessagingConfig:", this.mailMessagingConfig);
      this.subject.next(this.mailMessagingConfig);
    } else {
      this.logger.info("received", reason, "not emitting mailMessagingConfig:", this.mailMessagingConfig);
    }
  }

  private migrateTemplateMappings() {
    const processToTemplateMappings: ProcessToTemplateMappings = this.mailMessagingConfig.mailConfig["templateMappings"] as ProcessToTemplateMappings;
    const migratedNotificationConfigs: NotificationConfig[] = notificationMappings(processToTemplateMappings);
    this.logger.off("templateMappings:", processToTemplateMappings, "migratedNotificationConfigs:", migratedNotificationConfigs);
    if (this.mailMessagingConfig.notificationConfigs.length === 0 && processToTemplateMappings) {
      this.mailMessagingConfig.notificationConfigs = migratedNotificationConfigs;
      this.mailMessagingConfig.mailConfig["templateMappings"] = null;
    }
    if (this.mailMessagingConfig.notificationConfigs.length === 0) {
      this.mailMessagingConfig.notificationConfigs = NOTIFICATION_CONFIG_DEFAULTS;
    }
  }

  public events(): Observable<MailMessagingConfig> {
    return this.subject.asObservable();
  }

  private refreshTemplates() {
    this.mailService.queryTemplates().then((mailTemplates: MailTemplates) => {
      this.mailMessagingConfig.mailTemplates = mailTemplates;
      this.logger.info("refreshTemplates response:", mailTemplates);
      this.emitConfigWhenReadyGiven("mailTemplates");
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
        message: {
          title: "Mail Templates",
          message: "Found " + this.stringUtilsService.pluraliseWithCount(mailTemplates.count, "template")
        }, type: AlertLevel.ALERT_SUCCESS
      }));
    }).catch(error => {
      this.logger.error("refreshTemplates error:", error);
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
        title: "Failed to query Mail templates",
        message: error
      }));
    });
  }

  public initialiseSubject(notificationConfig: NotificationConfig) {
    if (notificationConfig && !notificationConfig?.subject?.text) {
      notificationConfig.subject = {suffixParameter: null, prefixParameter: null, text: ""};
    }
  }

  public toSubject(subject: NotificationSubject, emailRequest: SendSmtpEmailRequest) {
    const keyValues: KeyValue<any>[] = extractParametersFrom(emailRequest.params, false);
    const prefix = subject?.prefixParameter ? keyValues.find(item => item.key === subject?.prefixParameter)?.value : null;
    const suffix = subject?.suffixParameter ? keyValues.find(item => item.key === subject?.suffixParameter)?.value : null;
    const returnedSubject = [prefix, subject?.text, suffix].filter(item => item).join(" - ");
    this.logger.off("keyValues ->", keyValues, "subject ->", subject, "returnedSubject:", returnedSubject);
    return returnedSubject;
  }

  public createEmailRequest(createSendSmtpEmailRequest: CreateSendSmtpEmailRequest): SendSmtpEmailRequest {
    const {member, notificationConfig, notificationDirective, bodyContent}: CreateSendSmtpEmailRequest = createSendSmtpEmailRequest;
    const fullName = this.fullNamePipe.transform(member);
    const roles: string[] = notificationConfig.signOffRoles;
    const emailRequest: SendSmtpEmailRequest = {
      subject: null,
      to: [{email: member.email, name: fullName}],
      sender: this.createBrevoAddress(notificationConfig.senderRole),
      replyTo: this.createBrevoAddress(notificationConfig.replyToRole),
      params: this.createSendSmtpEmailParams(roles, notificationDirective, member, notificationConfig, bodyContent, true, "Hi {{params.messageMergeFields.FNAME}},"),
      templateId: notificationConfig.templateId,
    };
    if (notificationConfig?.ccRoles.length > 0) {
      emailRequest.cc = notificationConfig?.ccRoles?.map(role => this.createBrevoAddress(role));
    }
    const subject = createSendSmtpEmailRequest.emailSubject || this.toSubject(notificationConfig.subject, emailRequest);
    emailRequest.subject = subject;
    emailRequest.params.messageMergeFields.subject = subject;
    this.logger.off("createEmailRequest ->", emailRequest);
    return emailRequest;
  }

  public createSendSmtpEmailParams(roles: string[], notificationDirective: NotificationDirective, member: Member, notificationConfig: NotificationConfig, bodyContent: string, includeSignOffNames: boolean, subject?: string, addresseeType?: string) {
    this.logger.info("createSendSmtpEmailParams:notificationConfig:", notificationConfig, "member:", member);
    const params = {
      messageMergeFields: {
        subject,
        SIGNOFF_NAMES: includeSignOffNames ? this.signoffNames(roles, notificationDirective) : "",
        BANNER_IMAGE_SOURCE: this.bannerImageSource(notificationConfig, true),
        ADDRESS_LINE: addresseeType,
        BODY_CONTENT: bodyContent,
      },
      memberMergeFields: this.toMemberMergeVariables(member),
      systemMergeFields: this.toSystemMergeFields(member),
    };
    this.logger.info("createSendSmtpEmailParams:notificationConfig:", notificationConfig, "member:", member, "returning:", params);
    return params;
  }

  private signoffNames(roles: string[], notificationDirective: NotificationDirective): string {
    this.logger.info("signoffNames for roles:", roles);
    const componentAndData = new NotificationComponent<ContactUsComponent>(ContactUsComponent);
    if (notificationDirective?.viewContainerRef) {
      notificationDirective.viewContainerRef.clear();
      const componentRef = notificationDirective.viewContainerRef.createComponent(componentAndData.component);
      componentRef.instance.roles = roles;
      componentRef.instance.emailStyle = true;
      componentRef.instance.format = "list";
      componentRef.changeDetectorRef.detectChanges();
      const html = componentRef.location.nativeElement.innerHTML;
      this.logger.info("signoffNames ->", html);
      return html;
    } else {
      this.logger.info("signoffNames -> null due to null notificationDirective");
    }
  }

  toSystemMergeFields(member?: Member): SystemMergeFields {
    return {
      APP_SHORTNAME: this.mailMessagingConfig.group?.shortName,
      APP_LONGNAME: this.mailMessagingConfig.group?.longName,
      APP_URL: this.mailMessagingConfig.group?.href,
      PW_RESET_LINK: member?.passwordResetId ? `${this.mailMessagingConfig.group?.href}/admin/set-password/${member?.passwordResetId}` : null
    };
  }

  public createBrevoAddress(role: string): EmailAddress {
    const committeeMember = this.mailMessagingConfig.committeeReferenceData.committeeMemberForRole(role);
    return {name: committeeMember?.fullName, email: committeeMember?.email};
  }

  public exampleEmailParams(): SendSmtpEmailParams {
    return {
      messageMergeFields: {
        subject: "Example Email",
        BANNER_IMAGE_SOURCE: "Example Banner Image Source",
        ADDRESS_LINE: `<p>Hi {{params.memberMergeFields.FNAME}},</p>`,
        SIGNOFF_NAMES: "Example Signoff Names"
      },
      memberMergeFields: this.toMemberMergeVariables(this.memberLoginService.loggedInMember()),
      systemMergeFields: this.toSystemMergeFields(this.memberLoginService.loggedInMember())
    };
  };

  public toMemberMergeVariables(member: Member): MemberMergeFields {
    return {
      FULL_NAME: this.fullNamePipe.transform(member),
      EMAIL: member?.email,
      FNAME: member?.firstName,
      LNAME: member?.lastName,
      MEMBER_NUM: member?.membershipNumber,
      MEMBER_EXP: this.dateUtils.displayDate(member?.membershipExpiryDate),
      USERNAME: member?.userName,
      PW_RESET: member?.passwordResetId || ""
    };
  }

  bannerImageSource(notificationConfig: NotificationConfig, absolute: boolean) {
    const selectedBanner = this.mailMessagingConfig?.banners?.find(item => item.id === notificationConfig?.bannerId);
    const bannerSource = this.urlService.imageSource(`${selectedBanner?.fileNameData.rootFolder}/${selectedBanner?.fileNameData.awsFileName}`, absolute);
    this.logger.debug("notificationConfig.bannerId:", notificationConfig?.bannerId, "bannerSource:", bannerSource);
    return bannerSource;
  }

  saveConfig(mailMessagingConfig: MailMessagingConfig, deletedConfigIds: string[]): Promise<any> {
    this.logger.off("saveConfig.mailMessagingConfig:", mailMessagingConfig, "deletedConfigIds:", deletedConfigIds);
    return Promise.all([this.mailConfigService.saveConfig(mailMessagingConfig.mailConfig), this.notificationConfigService.saveAndDelete(mailMessagingConfig.notificationConfigs, deletedConfigIds)]);
  }

  refresh() {
    this.initialise();
  }

  queryNotificationConfig(notify: AlertInstance, mailMessagingConfig: MailMessagingConfig, configKey: keyof BuiltInProcessMappings): NotificationConfig {
    const notificationConfig = mailMessagingConfig?.notificationConfigs?.find(item => item.id === mailMessagingConfig.mailConfig[configKey]);
    if (!notificationConfig) {
      notify.error({
        title: "Email Notification Configuration Error",
        message: `Unable to send notifications as the Process Mapping for ${this.stringUtilsService.asTitle(configKey)} has not been configured`,
      });
    } else {
      return notificationConfig;
    }
  }
}
