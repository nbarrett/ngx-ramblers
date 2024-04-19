import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import { MailConfig, MailSubscription } from "../../../models/mail.model";
import { MailLinkService } from "../../../services/mail/mail-link.service";

@Component({
  selector: "app-mail-subscription-setting",
  template: `
    <div *ngIf="mailConfig?.lists[listType]" class="row">
      <div class="col-sm-5">
        <div *ngIf="mailSubscription" class="custom-control custom-checkbox">
          <input (change)="mailChangeSubscribed()"
                 [(ngModel)]="mailSubscription.subscribed"
                 type="checkbox" class="custom-control-input" id="mail-subscribe-general-emails">
          <label class="custom-control-label"
                 for="mail-subscribe-general-emails">{{ checkboxTitle() }}</label>
        </div>
      </div>
      <div class="col-sm-7">
        <app-brevo-button [disabled]="!mailSubscription?.mailIdentifiers?.id"
                          (click)="viewMailListEntry(mailSubscription?.mailIdentifiers?.id)"
                          [title]="linkTitle()"/>
      </div>
    </div>`
})
export class MailSubscriptionSettingComponent implements OnInit {
  private logger: Logger;
  public listType: string;
  public member: Member;
  public mailConfig: MailConfig;
  public mailSubscription: MailSubscription;

  @Input("member") set memberValue(member: Member) {
    this.member = member;
    this.initialiseSubscription();
  }

  @Input("listType") set listTypeValue(listType: string) {
    this.listType = listType;
    this.initialiseSubscription();
  }

  @Input("mailConfig") set mailConfigValue(mailConfig: MailConfig) {
    this.mailConfig = mailConfig;
    this.initialiseSubscription();
  }

  constructor(public stringUtils: StringUtilsService,
              public mailLinkService: MailLinkService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailSubscriptionSettingsComponent", NgxLoggerLevel.INFO);
  }

  ngOnInit() {
    this.initialiseSubscription();
  }

  private initialiseSubscription() {
    this.logger.info("constructed with:member:", this.member, "mailConfig:", this.mailConfig);
    if (this.mailConfig && this.member?.mailLists && this.listType) {
      this.mailSubscription = this.member?.mailLists[this.listType];
    }
  }

  viewMailListEntry(id: number) {
    return id ? window.open(`${this.mailLinkService.listView(id)}`) : null;
  }

  mailChangeSubscribed() {
    this.mailSubscription.syncRequired = true;
    this.logger.info("listType", this.listType, "mailSubscription:", this.mailSubscription);
  }

  checkboxTitle() {
    return "Subscribe to " + this.listType + " emails";
  }

  linkTitle() {
    return this.member?.mailContactIdentifiers?.id ? "View " + this.listType + " list entry In Brevo" : "List entry not yet created in Brevo";
  }

}
