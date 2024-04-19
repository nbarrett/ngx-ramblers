import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import { MailConfig } from "../../../models/mail.model";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import { MailListService } from "../../../services/mail/mail-list.service";

@Component({
  selector: "[app-mail-subscription-settings]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row" *ngIf="member">
        <div class="col-sm-12">
          <p>Please select how {{ member | fullNameWithAlias }} wants to be <b>emailed</b>
            by using the subscription checkboxes below. To see the member entry in a
            brevo list, click the corresponding mail icon</p>
          <app-mail-subscription-setting [member]="member" [mailConfig]="mailConfig" [listType]="'general'"/>
          <app-mail-subscription-setting [member]="member" [mailConfig]="mailConfig" [listType]="'walks'"/>
          <app-mail-subscription-setting [member]="member" [mailConfig]="mailConfig" [listType]="'socialEvents'"/>
        </div>
      </div>
    </div>`
})
export class MailSubscriptionSettingsComponent implements OnInit {
  private logger: Logger;
  public member: Member;
  public mailConfig: MailConfig;

  @Input("member") set memberValue(member: Member) {
    this.member = member;
    this.initialiseSubscriptions();
  }

  @Input("mailConfig") set mailConfigValue(mailConfig: MailConfig) {
    this.mailConfig = mailConfig;
    this.initialiseSubscriptions();
  }

  constructor(public stringUtils: StringUtilsService,
              public mailLinkService: MailLinkService,
              public mailListService: MailListService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailSubscriptionSettingsComponent", NgxLoggerLevel.INFO);
  }


  ngOnInit() {
    this.initialiseSubscriptions();
  }

  private initialiseSubscriptions() {
    this.logger.info("constructed with:member:", this.member, "mailConfig:", this.mailConfig);
    ["general", "walks", "socialEvents"].forEach(listType => {
      if (this.mailConfig && this.mailConfig?.lists[listType] && (!this.member?.mailLists || !this.member?.mailLists[listType])) {
        this.logger.info("creating", listType, "subscription defaults for :member:", this.member, "mailConfig:", this.mailConfig);
        this.mailListService.createOrSetMailSubscription(this.member, listType, false);
      }
    });
  }


}
