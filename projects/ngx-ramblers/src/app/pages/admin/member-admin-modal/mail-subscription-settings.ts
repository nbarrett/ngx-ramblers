import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import {
  ListInfo,
  ListSetting,
  MailListAudit,
  MailMessagingConfig,
  MailSubscription
} from "../../../models/mail.model";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import cloneDeep from "lodash-es/cloneDeep";
import { SystemConfig } from "../../../models/system.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";

@Component({
  selector: "[app-mail-subscription-settings]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row" *ngIf="member">
        <div class="col-sm-12">
          <p>Please select how {{ member | fullNameWithAlias }} wants to be <b>emailed</b>
            by using the subscription checkboxes below.</p>
        </div>
        <div class="col-sm-12 mb-3">
          <div class="row" *ngIf="member?.mail?.subscriptions && mailMessagingConfig">
            <div class="col-sm-4"
                 *ngFor="let subscription of mailMessagingService.allSubscriptions(member.mail.subscriptions)">
              <app-mail-subscription-setting [member]="member" [subscription]="subscription"/>
            </div>
            <div class="col">
              <app-brevo-button button [disabled]="!member?.mail?.id"
                                (click)="viewBrevoContact(member?.mail?.id)"
                                [title]="linkTitle()"/>
            </div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col col-sm-12">
          <table
            class="round styled-table table-striped table-hover table-sm table-pointer">
            <thead>
            <tr>
              <th>Time</th>
              <th>Created By</th>
              <th>Audit Message</th>
            </tr>
            </thead>
            <tbody>
            <tr *ngFor="let mailListAudit of mailListAudits">
              <td>{{ mailListAudit.timestamp | displayDateAndTime }}</td>
              <td>{{ mailListAudit.createdBy | memberIdToFullName : members }}</td>
              <td>{{ mailListAudit.audit }}
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`
})
export class MailSubscriptionSettingsComponent implements OnInit {
  private logger: Logger;
  public member: Member;
  public systemConfig: SystemConfig;
  public mailMessagingConfig: MailMessagingConfig;
  @Input("systemConfig") set systemConfigValue(systemConfig: SystemConfig) {
    this.systemConfig = systemConfig;
    this.initialiseSubscriptions();
  }

  @Input("mailMessagingConfig") set mailMessagingConfigValue(mailMessagingConfig: MailMessagingConfig) {
    this.mailMessagingConfig = mailMessagingConfig;
    this.initialiseSubscriptions();
  }

  @Input("member") set memberValue(member: Member) {
    this.member = member;
  }

  @Input() public mailListAudits: MailListAudit[];
  @Input() public members: Member[];


  constructor(public stringUtils: StringUtilsService,
              public mailLinkService: MailLinkService,
              protected mailMessagingService: MailMessagingService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailSubscriptionSettingsComponent", NgxLoggerLevel.OFF);
  }


  ngOnInit() {
    this.initialiseSubscriptions();
  }

  viewBrevoContact(id: number) {
    return id ? window.open(`${this.mailLinkService.contactView(id)}`) : null;
  }

  linkTitle() {
    return this.member?.mail?.id ? "View contact details In Brevo" : "Contact not yet created in Brevo";
  }

  private listSetting(list: ListInfo): ListSetting {
    return this.mailMessagingConfig?.mailConfig?.listSettings?.find(item => item.id === list.id);
  }

  private initialiseListSubscription(list: ListInfo) {
    this.logger.info("constructed with:member:", this.member, "mailMessagingConfig:", this.mailMessagingConfig, "list:", list);
    if (this.mailMessagingConfig && list && this.member && !this.member.mail?.subscriptions?.find(mailSubscription => mailSubscription?.id === list.id)) {
      const listSetting: ListSetting = this.listSetting(list);
      const subscription: MailSubscription = {
        subscribed: listSetting?.autoSubscribeNewMembers,
        id: list.id
      };
      if (!this.member?.mail?.subscriptions) {
        this.logger.info("mail subscription doesn't exist - creating default value:", subscription);
        this.member.mail = {...this.member.mail, subscriptions: [subscription]};
      } else if (!this.member?.mail.subscriptions?.find(mailSubscription => mailSubscription?.id === list.id)) {
        this.logger.info("mail subscription exists as", cloneDeep(this.member.mail.subscriptions), "but missing value for", list, "- adding value:", subscription);
        this.member.mail.subscriptions.push(subscription);
      }
    }
  }

  private initialiseSubscriptions() {
    if (this.mailMessagingConfig && this.systemConfig && this.member) {
      this.logger.info("constructed with:member:", this.member, "mailMessagingConfig:", this.mailMessagingConfig,);
      this.mailMessagingConfig?.brevo?.lists?.lists.forEach((list: ListInfo) => this.initialiseListSubscription(list));
      this.removeInvalidSubscriptions();
    } else {
      this.logger.info("initialiseSubscriptions:missing:member:", this.member, "mailMessagingConfig:", this.mailMessagingConfig, "systemConfig:", this.systemConfig);
    }
  }

  private removeInvalidSubscriptions() {
    this.logger.info("removeInvalidSubscriptions:before:", cloneDeep(this.member.mail.subscriptions));
    const validIds: number[] = this.mailMessagingConfig.brevo.lists.lists.map(list => list.id);
    this.member.mail.subscriptions = this.member.mail.subscriptions.filter(item => validIds.includes(item.id));
    this.logger.info("removeInvalidSubscriptions:after:", this.member.mail.subscriptions, "applying validIds:", validIds);
  }
}
