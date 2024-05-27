import { inject, Injectable } from "@angular/core";
import { Member } from "../../models/member.model";
import { MailchimpListService } from "../mailchimp/mailchimp-list.service";
import { MailListUpdaterService } from "../mail/mail-list-updater.service";
import { MailProvider, SystemConfig } from "../../models/system.model";
import { MailMessagingConfig, NotificationConfig } from "../../models/mail.model";
import { MailchimpListUpdaterService } from "../mailchimp/mailchimp-list-updater.service";
import { AlertInstance } from "../notifier.service";
import { LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable({
  providedIn: "root"
})
export class MemberDefaultsService {

  private mailchimpListUpdaterService: MailchimpListUpdaterService = inject(MailchimpListUpdaterService);
  private mailchimpListService: MailchimpListService = inject(MailchimpListService);
  private mailListUpdaterService: MailListUpdaterService = inject(MailListUpdaterService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MemberDefaultsService", NgxLoggerLevel.OFF);

  public resetUpdateStatusForMember = (member: Member, systemConfig: SystemConfig) => {
    switch (systemConfig?.mailDefaults?.mailProvider) {
      case MailProvider.MAILCHIMP:
        this.mailchimpListService.resetUpdateStatusForMember(member);
        break;
    }
  };

  updateMailchimpLists(notify: AlertInstance, members: Member[]) {
    return this.mailchimpListUpdaterService.updateMailchimpLists(notify, members);
  }

  updateBrevoLists(notify: AlertInstance, members: Member[]) {
    return this.mailListUpdaterService.updateMailLists(notify, members)
      .catch(error => {
        this.logger.info("Error updating Brevo lists", error)
        notify.error({title: "Error updating Brevo lists", message: error});
      });
  }

  public updateLists(systemConfig: SystemConfig, notify: AlertInstance, members: Member[]): Promise<any> {
    switch (systemConfig?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        return this.updateBrevoLists(notify, members);
      case MailProvider.MAILCHIMP:
        return this.updateMailchimpLists(notify, members);
      default:
        return Promise.resolve();
    }
  }

  public subscribedToEmails(member: Member, systemConfig: SystemConfig, listId: number): boolean {
    switch (systemConfig?.mailDefaults?.mailProvider) {
      case MailProvider.BREVO:
        return this.mailListUpdaterService.memberSubscribed(member, listId);
      case MailProvider.MAILCHIMP:
        return this.mailchimpListService.memberSubscribedToAnyList(member);
      default:
        return false;
    }
  }

  public applyDefaultMailSettingsToMember(member: Member, systemConfig: SystemConfig, mailMessagingConfig: MailMessagingConfig) {
    member.groupMember = true;
    switch (systemConfig?.mailDefaults?.mailProvider) {
      case MailProvider.NONE:
        return member;
      case MailProvider.BREVO:
        this.mailListUpdaterService.initialiseMailSubscriptionsFromListIds(member, mailMessagingConfig);
        return member;
      case MailProvider.MAILCHIMP:
        this.mailchimpListService.defaultMailchimpSettings(member, systemConfig.mailDefaults.autoSubscribeNewMembers);
        return member;
    }
  }

}
