import { Component, Input } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { MailchimpContact } from "../../../../../../../../server/lib/shared/server-models";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";

@Component({
  selector: "app-mailchimp-contact",
  templateUrl: "./mailchimp-contact.html",
})
export class MailchimpContactComponent {
  private logger: Logger;
  @Input()
  mailchimpContact: MailchimpContact;


  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("MailchimpSettingsContactComponent", NgxLoggerLevel.OFF);
  }

}
