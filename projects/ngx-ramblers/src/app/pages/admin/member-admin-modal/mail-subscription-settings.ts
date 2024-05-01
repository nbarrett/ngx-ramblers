import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import { MailConfig, MailSubscription } from "../../../models/mail.model";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import { KeyValue } from "../../../services/enums";
import map from "lodash-es/map";
import cloneDeep from "lodash-es/cloneDeep";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";

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
            <app-mail-subscription-setting [member]="member" [subscription]="subscription"
                                           [listType]="listTypeFor(subscription)"/>
          </div>
        </ng-container>
      </div>
    </div>`
})
export class MailSubscriptionSettingsComponent implements OnInit {
  private logger: Logger;
  public member: Member;
  public mailConfig: MailConfig;
  public lists: KeyValue<number>[] = [];

  @Input("member") set memberValue(member: Member) {
    this.member = member;
  }

  @Input("mailConfig") set mailConfigValue(mailConfig: MailConfig) {
    this.mailConfig = mailConfig;
    this.initialiseSubscriptions();
  }

  constructor(public stringUtils: StringUtilsService,
              public mailLinkService: MailLinkService,
              public mailListUpdaterService: MailListUpdaterService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailSubscriptionSettingsComponent", NgxLoggerLevel.INFO);
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
      const subscription: MailSubscription = {subscribed: true, id: list.value};
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
    if (this.mailConfig) {
      this.lists = this.mailListUpdaterService.mapToKeyValues(this.mailConfig.lists);
      this.logger.info("constructed with:member:", this.member, "mailConfig:", this.mailConfig, "lists:", this.lists);
      this.lists.forEach((list: KeyValue<number>) => this.initialiseListSubscription(list));
    }
  }


  listTypeFor(subscription: MailSubscription) {
    return this.lists.find(list => list.value === subscription.id)?.key;
  }
}
