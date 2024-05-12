import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { MailchimpConfig } from "../../models/mailchimp.model";
import { Member } from "../../models/member.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailchimpConfigService } from "../mailchimp-config.service";
import { AlertInstance } from "../notifier.service";
import { StringUtilsService } from "../string-utils.service";
import { MailchimpListSubscriptionService } from "./mailchimp-list-subscription.service";
import { MailchimpListService } from "./mailchimp-list.service";

@Injectable({
  providedIn: "root"
})
export class MailchimpListUpdaterService {
  private logger: Logger;

  constructor(private mailchimpConfigService: MailchimpConfigService,
              private mailchimpListService: MailchimpListService,
              private stringUtils: StringUtilsService,
              private mailchimpListSubscriptionService: MailchimpListSubscriptionService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MailchimpListUpdaterService, NgxLoggerLevel.OFF);
  }

  updateMailchimpLists(notify: AlertInstance, members: Member[]): Promise<any> {
    this.logger.info("updateMailchimpLists:members:", members);
    return this.mailchimpConfigService.getConfig().then((config: MailchimpConfig) => {
      if (config.mailchimpEnabled) {
        const listTypes: string[] = this.mailchimpConfigService.configuredListTypes(config)?.filter(item => item.value)?.map(item => item.key);
        notify.success(`Sending updates to Mailchimp lists ${listTypes.join(", ")}`, true);
        return Promise.all(listTypes.map((listType: string) => this.mailchimpListSubscriptionService.createBatchSubscriptionForList(listType, members)))
          .then(() => Promise.all(listTypes.map((listType: string) => this.mailchimpListService.batchUnsubscribeMembers(listType, members, notify))))
          .then(() => this.notifyUpdatesComplete(notify))
          .catch((error) => this.mailchimpError(error, notify));
      } else {
        return Promise.resolve(this.notifyMailchimpIntegrationNotEnabled(notify));
      }
    });
  }

  private mailchimpError(errorResponse, notify: AlertInstance) {
    this.logger.error(errorResponse);
    notify.error({
      title: "Mailchimp updates failed",
      message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + this.stringUtils.stringify(errorResponse.error)) : "")
    });
    notify.clearBusy();
  }

  private notifyUpdatesComplete(notify: AlertInstance) {
    notify.success({title: "Mailchimp updates", message: "Mailchimp lists were updated successfully"});
    notify.clearBusy();
    return true;
  }

  private notifyMailchimpIntegrationNotEnabled(notify: AlertInstance) {
    notify.warning({
      title: "Mailchimp updates",
      message: "Mailchimp Integration is not enabled so list updates have been skipped"
    });
    notify.clearBusy();
    return true;
  }

}
