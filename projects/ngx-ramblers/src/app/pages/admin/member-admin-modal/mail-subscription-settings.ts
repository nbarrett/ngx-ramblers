import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import { MailConfig, MailListAudit, MailSubscription } from "../../../models/mail.model";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import { KeyValue } from "../../../services/enums";
import cloneDeep from "lodash-es/cloneDeep";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { SystemConfig } from "../../../models/system.model";

@Component({
  selector: "[app-mail-subscription-settings]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row" *ngIf="member">
        <div class="col-sm-12">
          <p>Please select how {{ member | fullNameWithAlias }} wants to be <b>emailed</b>
            by using the subscription checkboxes below.</p>
        </div>
        <div class="col-sm-12 mb-2">
          <app-brevo-button button [disabled]="!member?.mail?.id"
                            (click)="viewBrevoContact(member?.mail?.id)"
                            [title]="linkTitle()"/>
        </div>
        <ng-container *ngIf="member?.mail?.subscriptions">
          <div class="col-sm-12" *ngFor="let subscription of member.mail.subscriptions">
            <app-mail-subscription-setting [member]="member" [subscription]="subscription"/>
          </div>
        </ng-container>
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
  public mailConfig: MailConfig;
  public lists: KeyValue<number>[] = [];

  @Input("systemConfig") set systemConfigValue(systemConfig: SystemConfig) {
    this.systemConfig = systemConfig;
    this.initialiseSubscriptions();
  }

  @Input("member") set memberValue(member: Member) {
    this.member = member;
  }

  @Input("mailConfig") set mailConfigValue(mailConfig: MailConfig) {
    this.mailConfig = mailConfig;
    this.initialiseSubscriptions();
  }

  @Input() public mailListAudits: MailListAudit[];
  @Input() public members: Member[];

  constructor(public stringUtils: StringUtilsService,
              public mailLinkService: MailLinkService,
              public mailListUpdaterService: MailListUpdaterService,
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

  private initialiseListSubscription(list: KeyValue<number>) {
    this.logger.info("constructed with:member:", this.member, "mailConfig:", this.mailConfig, "list:", list);
    if (this.mailConfig && list && this.member && !this.member.mail?.subscriptions?.[list.value]) {
      const subscription: MailSubscription = {
        subscribed: this.systemConfig?.mailDefaults?.autoSubscribeNewMembers,
        id: list.value
      };
      if (!this.member?.mail?.subscriptions) {
        this.logger.info("mail subscription doesn't exist - creating default value:", subscription);
        this.member.mail = {...this.member.mail, subscriptions: [subscription]};
      } else if (!this.member?.mail.subscriptions.find(subscription => subscription.id === list.value)) {
        this.logger.info("mail subscription exists as", cloneDeep(this.member.mail.subscriptions), "but missing value for", list, "- adding value:", subscription);
        this.member.mail.subscriptions.push(subscription);
      }
    }
  }

  private initialiseSubscriptions() {
    if (this.mailConfig && this.systemConfig && this.member) {
      this.lists = this.mailListUpdaterService.mapToKeyValues(this.mailConfig.lists);
      this.logger.info("constructed with:member:", this.member, "mailConfig:", this.mailConfig, "lists:", this.lists);
      this.lists.forEach((list: KeyValue<number>) => this.initialiseListSubscription(list));
    } else {
      this.logger.info("initialiseSubscriptions:missing:member:", this.member, "mailConfig:", this.mailConfig, "systemConfig:", this.systemConfig);
    }
  }

}
