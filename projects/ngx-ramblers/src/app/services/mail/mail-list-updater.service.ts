import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../models/member.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { AlertInstance } from "../notifier.service";
import { StringUtilsService } from "../string-utils.service";
import { MailConfigService } from "./mail-config.service";
import { MailConfig } from "../../models/mail.model";
import { MailListService } from "./mail-list.service";
import map from "lodash-es/map";
import { KeyValue } from "../enums";

@Injectable({
  providedIn: "root"
})
export class MailListUpdaterService {
  private logger: Logger;

  constructor(private mailConfigService: MailConfigService,
              private mailListService: MailListService,
              private stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailListUpdaterService", NgxLoggerLevel.OFF);
  }

  updateMailLists(notify: AlertInstance, members: Member[]): Promise<any> {
    this.logger.info("updateMailchimpLists:members:", members);
    return this.mailConfigService.getConfig().then((mailConfig: MailConfig) => {
      if (mailConfig.allowSendCampaign) {
        const listTypes = this.configuredLists(mailConfig);
        notify.success(`Sending updates to Brevo lists ${listTypes.join(", ")}`, true);
        return Promise.all(listTypes.map((listType: string) => this.mailListService.createBatchSubscriptionForList(listType, members)))
          .then(() => Promise.all(listTypes.map((listType: string) => this.mailListService.batchUnsubscribeMembers(listType, members, notify))))
          .then(() => this.notifyUpdatesComplete(notify))
          .catch((error) => this.mailError(error, notify));
      } else {
        return Promise.resolve(this.notifyIntegrationNotEnabled(notify));
      }
    });
  }

  private configuredLists(mailConfig: MailConfig): string[] {
    return map(mailConfig.lists, (listId: number, listType) => ({
      key: listType,
      value: listId
    })).filter((list: KeyValue<number>) => list.value).map((list) => list.key);
  }

  private mailError(errorResponse, notify: AlertInstance) {
    this.logger.error(errorResponse);
    notify.error({
      title: "Brevo updates failed",
      message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + this.stringUtils.stringify(errorResponse.error)) : "")
    });
    notify.clearBusy();
  }

  private notifyUpdatesComplete(notify: AlertInstance) {
    notify.success({title: "Brevo updates", message: "Mailchimp lists were updated successfully"});
    notify.clearBusy();
    return true;
  }

  private notifyIntegrationNotEnabled(notify: AlertInstance) {
    notify.warning({
      title: "Brevo updates",
      message: "Mail Integration is not enabled so list updates have been skipped"
    });
    notify.clearBusy();
    return true;
  }

}
