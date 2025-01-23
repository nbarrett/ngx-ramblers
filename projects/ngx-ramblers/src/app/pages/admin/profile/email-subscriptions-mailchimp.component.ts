import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { Member } from "../../../models/member.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MailProvider, RootFolder, SystemConfig } from "../../../models/system.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";

@Component({
  selector: "app-email-subscriptions-mailchimp",
  template: `
    @if (mailchimpConfig?.lists?.walks) {
      <div class="custom-control custom-checkbox">
        <input [(ngModel)]="member.mailchimpLists.walks.subscribed" type="checkbox" class="custom-control-input"
          name="walks-subscribed"
          id="prof-subscribe-walks-emails">
        <label class="custom-control-label"
          for="prof-subscribe-walks-emails">Walks emails
        </label>
      </div>
    }
    @if (mailchimpConfig?.lists?.socialEvents) {
      <div class="custom-control custom-checkbox">
        <input [(ngModel)]="member.mailchimpLists.socialEvents.subscribed" type="checkbox"
          class="custom-control-input"
          name="social-events-subscribed"
          id="prof-subscribe-social-events-emails">
        <label class="custom-control-label"
          for="prof-subscribe-social-events-emails">Social events emails
        </label>
      </div>
    }
    @if (mailchimpConfig?.lists?.general) {
      <div class="custom-control custom-checkbox">
        <input [(ngModel)]="member.mailchimpLists.general.subscribed" type="checkbox"
          class="custom-control-input"
          name="general-subscribed"
          id="prof-subscribe-general-emails">
        <label class="custom-control-label"
          for="prof-subscribe-general-emails">General emails
        </label>
      </div>
    }`,
  standalone: false
})
export class EmailSubscriptionsMailchimpComponent implements OnInit, OnDestroy {

  public config: SystemConfig;
  public icons: RootFolder = RootFolder.icons;
  public logos: RootFolder = RootFolder.logos;
  private subscriptions: Subscription[] = [];
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  private mailchimpConfigService: MailchimpConfigService = inject(MailchimpConfigService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("EmailSubscriptionsMailchimpComponent", NgxLoggerLevel.DEBUG);

  @Input() public member: Member;
  public mailchimpConfig: MailchimpConfig;

  protected readonly MailProvider = MailProvider;

  async ngOnInit() {
    this.logger.debug("ngOnInit");
    this.mailchimpConfig = await this.mailchimpConfigService.getConfig();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
