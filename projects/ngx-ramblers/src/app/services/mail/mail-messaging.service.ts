import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailConfigService } from "./mail-config.service";
import { Member } from "../../models/member.model";
import {
  Account,
  AccountMergeFields,
  BuiltInProcessMappings,
  CreateSendSmtpEmailRequest,
  DEFAULT_MAIL_MESSAGING_CONFIG,
  EmailAddress,
  ListSetting,
  MailConfig,
  MailMessagingConfig,
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
import { sortBy } from "../../functions/arrays";
import { BannerConfigService } from "../banner-config.service";
import { UrlService } from "../url.service";
import { MemberLoginService } from "../member/member-login.service";
import { NotificationComponent } from "../../notifications/common/notification.component";
import { ContactUsComponent } from "../../committee/contact-us/contact-us";
import { NotificationDirective } from "../../notifications/common/notification.directive";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { extractParametersFrom, notificationMappings } from "../../common/mail-parameters";
import { KeyValue } from "../../functions/enums";
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
  private logger: Logger = inject(LoggerFactory).createLogger("MailMessagingService", NgxLoggerLevel.ERROR);

  constructor() {
    this.initialise();
  }

  async initialise(): Promise<void> {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
      message: {
        title: "Mail Settings",
        message: "Getting Mail Settings"
      }, type: AlertLevel.ALERT_SUCCESS
    }));
    this.logger.info("initialising data:");
    this.committeeConfig.events().subscribe(data => {
      this.mailMessagingConfig.committeeReferenceData = data;
      this.broadcastSuccess("Committee Config");
    });
    this.systemConfigService.events().subscribe(item => {
      this.mailMessagingConfig.group = item.group;
      this.mailMessagingConfig.externalSystems = item.externalSystems;
      this.broadcastSuccess("Group Information");
    });
    await this.refreshMailConfig();
    await this.refreshAccount();
    await this.configureBrevoLists();
    await this.refreshFolders();
    await this.refreshTemplates();
    await this.refreshBanners();
    await this.refreshNotificationConfigs();
  }

  private refreshNotificationConfigs() {
    const configType = "Notification Configs";
    this.notificationConfigService.all().then((notificationConfigs) => {
      this.logger.info("retrieved notificationConfigs:", notificationConfigs);
      this.mailMessagingConfig.notificationConfigs = notificationConfigs.sort(sortBy("subject.text"));
      const message = `Found ${this.stringUtilsService.pluraliseWithCount(notificationConfigs.length, "Notification config")}`;
      return this.broadcastSuccess(configType, message);
    }).catch(error => this.broadcastError(error, configType));
  }

  private refreshBanners() {
    const configType = "Banners";
    this.bannerConfigService.all().then((banners) => {
      this.logger.info("retrieved banners:", banners);
      this.mailMessagingConfig.banners = banners.filter(item => item.fileNameData).sort(sortBy("name"));
      const message = `Found ${this.stringUtilsService.pluraliseWithCount(this.mailMessagingConfig.banners.length, "banner")}`;
      this.broadcastSuccess(configType, message);
    }).catch(error => this.broadcastError(error, configType));
  }

  private async refreshMailConfig() {
    const configType = "Mail config";
    try {
      this.mailMessagingConfig.mailConfig = await this.mailConfigService.queryConfig();
      this.logger.info("config:", this.mailMessagingConfig.mailConfig);
      if (!this.mailMessagingConfig.mailConfig.allowSendTransactional) {
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
          message: {
            title: "Mail Integration not enabled",
            message: "List and template dropdowns will not be populated"
          }, type: AlertLevel.ALERT_WARNING
        }));
      } else {
        this.broadcastSuccess(configType);
      }
    } catch (error) {
      return this.broadcastError(error, configType);
    }
  }

  private async refreshFolders() {
    const configType = "Brevo Folders";
    try {
      this.mailMessagingConfig.brevo.folders = await this.mailService.queryFolders();
      return this.broadcastSuccess(configType);
    } catch (error) {
      this.mailMessagingConfig.brevo.folders = {count: 0, folders: []};
      return this.broadcastError(error, configType);
    }
  }

  private async refreshAccount() {
    const configType = "Brevo Account";
    try {
      this.mailMessagingConfig.brevo.account = await this.mailService.queryAccount();
      return this.broadcastSuccess(configType);
    } catch (error) {
      this.mailMessagingConfig.brevo.account = {};
      this.broadcastError(error, configType);

    }
  }

  private async configureBrevoLists() {
    const configType = "Brevo Lists";
    try {
      const lists = await this.mailService.queryLists();
      this.mailMessagingConfig.brevo.lists = {count: lists.count, lists: lists.lists.sort(sortBy("id"))};
      const message = `Found ${this.stringUtilsService.pluraliseWithCount(lists.count, "list")}`;
      return this.broadcastSuccess(configType, message);
    } catch (error) {
      this.broadcastError(error, configType);
      this.mailMessagingConfig.brevo.lists = {count: 0, lists: []};
      return this.broadcastError(error, configType);
    }

  }

  notificationConfigs(configListing: NotificationConfigListing): NotificationConfig[] {
    const mailConfig = configListing.mailMessagingConfig.mailConfig;
    const workflowIds: string[] = this.workflowIdsFor(mailConfig);
    const notificationConfigs = this.mailMessagingConfig.notificationConfigs
      .filter(item => (configListing.includeWorkflowRelatedConfigs || !workflowIds.includes(item.id)))
      .filter(item => !configListing.includeMemberSelections || configListing.includeMemberSelections.length === 0 || configListing.includeMemberSelections.includes(item.defaultMemberSelection))
      .filter(item => !configListing.excludeMemberSelections || configListing.excludeMemberSelections.length === 0 || !configListing.excludeMemberSelections.includes(item.defaultMemberSelection));
    this.logger.info("workflowIds:", workflowIds, "mailConfig:", mailConfig, "includeWorkflowRelatedConfigs:", configListing.includeWorkflowRelatedConfigs, "-> notificationConfigs:", notificationConfigs,);
    return notificationConfigs;
  }

  public workflowIdsFor(mailConfig: MailConfig) {
    return [mailConfig.forgotPasswordNotificationConfigId, mailConfig.walkNotificationConfigId, mailConfig.expenseNotificationConfigId];
  }

  private emitConfigWhenReadyGiven(reason: string) {
    if (this.mailMessagingConfig.brevo.mailTemplates &&
      this.mailMessagingConfig.brevo.folders &&
      this.mailMessagingConfig.brevo.account &&
      this.mailMessagingConfig.brevo.lists &&
      this.mailMessagingConfig.committeeReferenceData &&
      this.mailMessagingConfig.group &&
      this.mailMessagingConfig.mailConfig &&
      this.mailMessagingConfig.banners &&
      this.mailMessagingConfig.notificationConfigs) {
      this.migrateTemplateMappings();
      this.migrateMailConfig();
      this.logger.info("received", reason, "emitting mailMessagingConfig:", this.mailMessagingConfig);
      this.subject.next(this.mailMessagingConfig);
    } else {
      this.logger.info("received", reason, "not emitting mailMessagingConfig:", this.mailMessagingConfig);
    }
  }

  private migrateTemplateMappings() {
    const processToTemplateMappings: ProcessToTemplateMappings = this.mailMessagingConfig.mailConfig["templateMappings"] as ProcessToTemplateMappings;
    const migratedNotificationConfigs: NotificationConfig[] = notificationMappings(processToTemplateMappings);
    this.logger.info("templateMappings:", processToTemplateMappings, "migratedNotificationConfigs:", migratedNotificationConfigs);
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

  private async refreshTemplates() {
    const configType = "Mail Templates";
    try {
      const mailTemplates = await this.mailService.queryTemplates();
      this.mailMessagingConfig.brevo.mailTemplates = mailTemplates;
      this.logger.info("refreshTemplates response:", mailTemplates);
      this.emitConfigWhenReadyGiven("brevo.mailTemplates");
      const message = `Found ${this.stringUtilsService.pluraliseWithCount(mailTemplates.count, "template")}`;
      return this.broadcastSuccess(configType, message);
    } catch (error) {
      this.mailMessagingConfig.brevo.mailTemplates = {templates: [], count: 0};
      this.broadcastError(error, "Mail templates");
    }
  }

  private broadcastSuccess(configType: string, message?: string) {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
      message: {
        title: configType,
        message: message || "retrieved config successfully"
      }, type: AlertLevel.ALERT_SUCCESS
    }));
    this.emitConfigWhenReadyGiven(configType);
  }

  private broadcastError(error: any, configType: string) {
    this.logger.error(configType, error);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
      title: "Failed to query " + configType,
      message: error
    }));
    return this.emitConfigWhenReadyGiven(configType);
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
    this.logger.info("keyValues ->", keyValues, "subject ->", subject, "returnedSubject:", returnedSubject);
    return returnedSubject;
  }

  public createEmailRequest(createSendSmtpEmailRequest: CreateSendSmtpEmailRequest): SendSmtpEmailRequest {
    const {
      member,
      notificationConfig,
      notificationDirective,
      bodyContent
    }: CreateSendSmtpEmailRequest = createSendSmtpEmailRequest;
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
    this.logger.info("createEmailRequest ->", emailRequest);
    return emailRequest;
  }

  public createSendSmtpEmailParams(signoffRoles: string[], notificationDirective: NotificationDirective, member: Member, notificationConfig: NotificationConfig, bodyContent: string, includeSignOffNames: boolean, subject?: string, addresseeType?: string) {
    this.logger.info("createSendSmtpEmailParams:notificationConfig:", notificationConfig, "member:", member);
    const params = {
      messageMergeFields: {
        subject,
        SIGNOFF_NAMES: includeSignOffNames ? this.signoffNames(signoffRoles, notificationDirective) : "",
        BANNER_IMAGE_SOURCE: this.bannerImageSource(notificationConfig, true),
        ADDRESS_LINE: addresseeType,
        BODY_CONTENT: bodyContent,
      },
      memberMergeFields: this.toMemberMergeVariables(member),
      systemMergeFields: this.toSystemMergeFields(member),
      accountMergeFields: this.toAccountMergeFields(this.mailMessagingConfig.brevo.account)
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

  toSystemMergeFields(member: Member): SystemMergeFields {
    return {
      FACEBOOK_URL: this.mailMessagingConfig?.externalSystems?.facebook?.groupUrl,
      INSTAGRAM_URL: this.mailMessagingConfig?.externalSystems?.instagram?.groupUrl,
      TWITTER_URL: this.mailMessagingConfig?.externalSystems?.twitter?.groupUrl,
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
      systemMergeFields: this.toSystemMergeFields(this.memberLoginService.loggedInMember()),
      accountMergeFields: this.toAccountMergeFields(this.mailMessagingConfig.brevo.account)
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

  public toAccountMergeFields(account: Account): AccountMergeFields {
    return {
      POSTCODE: account?.address?.zipCode,
      STREET: account?.address?.street,
      TOWN: account?.address?.city
    };
  }

  bannerImageSource(notificationConfig: NotificationConfig, absolute: boolean) {
    const selectedBanner = this.mailMessagingConfig?.banners?.find(item => item.id === notificationConfig?.bannerId);
    const bannerSource = this.urlService.imageSource(`${selectedBanner?.fileNameData.rootFolder}/${selectedBanner?.fileNameData.awsFileName}`, absolute);
    this.logger.debug("notificationConfig.bannerId:", notificationConfig?.bannerId, "bannerSource:", bannerSource);
    return bannerSource;
  }

  saveConfig(mailMessagingConfig: MailMessagingConfig, deletedConfigIds: string[]): Promise<any> {
    this.logger.info("saveConfig.mailMessagingConfig:", mailMessagingConfig, "deletedConfigIds:", deletedConfigIds);
    return Promise.all([this.mailConfigService.saveConfig(mailMessagingConfig.mailConfig), this.notificationConfigService.saveAndDelete(mailMessagingConfig.notificationConfigs, deletedConfigIds)])
      .then(() => this.initialise());
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

  private migrateMailConfig() {
    if (!this.mailMessagingConfig.mailConfig?.listSettings) {
      this.mailMessagingConfig.mailConfig.listSettings = [];
    }
    this.mailMessagingConfig?.brevo?.lists?.lists.forEach(list => {
      if (!this.mailMessagingConfig.mailConfig.listSettings.find(item => item.id === list.id)) {
        const listSetting: ListSetting = {id: list.id, autoSubscribeNewMembers: true};
        this.logger.info("adding listSetting:", listSetting);
        this.mailMessagingConfig.mailConfig.listSettings.push(listSetting);
      }
    });
  }
}
