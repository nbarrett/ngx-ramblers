import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import { MailSubscription } from "../../../models/mail.model";

@Component({
  selector: "app-mail-subscription-setting",
  template: `
    <div class="row">
      <div class="col-sm-5">
        <div class="custom-control custom-checkbox">
          <input *ngIf="subscription"
                 [(ngModel)]="subscription.subscribed"
                 type="checkbox" class="custom-control-input" id="mail-list-{{subscription.id}}-subscription">
          <label class="custom-control-label"
                 for="mail-list-{{subscription.id}}-subscription">{{ checkboxTitle() }}</label>
        </div>
      </div>
    </div>`
})
export class MailSubscriptionSettingComponent implements OnInit {

  private logger: Logger;

  @Input() public subscription: MailSubscription;
  @Input() public member: Member;
  @Input() public listType: string;

  constructor(public stringUtils: StringUtilsService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailSubscriptionSettingsComponent", NgxLoggerLevel.INFO);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:mailSubscription:", this.subscription, "listType:", this.listType);
  }

  checkboxTitle() {
    return "Subscribe to " + this.listType + " emails";
  }

}
