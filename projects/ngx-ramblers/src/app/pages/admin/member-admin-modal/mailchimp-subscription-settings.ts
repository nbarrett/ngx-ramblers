import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Member } from "../../../models/member.model";
import { MailchimpLinkService } from "../../../services/mailchimp/mailchimp-link.service";
import { MailchimpConfig, MailchimpSubscription } from "../../../models/mailchimp.model";
import { FormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { MailchimpSegmentEditorComponent } from "../system-settings/mailchimp/mailchimp-segment-editor";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";

@Component({
    selector: "[app-mailchimp-subscription-settings]",
    template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      @if (member.mailchimpLists) {
        <div class="row">
          <div class="col-sm-12">
            <p>Please select how {{ member | fullNameWithAlias }} wants to be <b>emailed</b>
            by using the subscription checkboxes below. To see the member entry in a
          mailchimp list, click the corresponding mailchimp icon</p>
          @if (mailchimpConfig?.lists?.general) {
            <div class="row">
              <div class="col-sm-5">
                <div class="form-check">
                  <input (change)="mailchimpChangeSubscribed('general')"
                    [(ngModel)]="member.mailchimpLists.general.subscribed"
                    type="checkbox" class="form-check-input" id="subscribe-general-emails">
                  <label class="form-check-label"
                    for="subscribe-general-emails">General emails
                  </label>
                </div>
              </div>
              <div class="col-sm-7">
                <button [disabled]="!member?.mailchimpLists?.general.web_id"
                  (click)="viewMailchimpListEntry(member?.mailchimpLists?.general.web_id)"
                  title="View general list entry In Mailchimp">
                  <img
                    [ngClass]="member?.mailchimpLists?.general.web_id ? 'mailchimp-logo': 'mailchimp-logo disabled-image'"
                    src="/assets/images/mailchimp/freddie_wink.svg"
                  alt="View general list entry In Mailchimp"></button>
                </div>
              </div>
            }
            @if (mailchimpConfig?.lists?.walks) {
              <div class="row">
                <div class="col-sm-5">
                  <div class="form-check">
                    <input (change)="mailchimpChangeSubscribed('walks')"
                      [(ngModel)]="member.mailchimpLists.walks.subscribed"
                      type="checkbox" class="form-check-input" id="subscribe-walks-emails">
                    <label class="form-check-label"
                      for="subscribe-walks-emails">Walks emails
                    </label>
                  </div>
                </div>
                <div class="col-sm-7">
                  <button [disabled]="!member?.mailchimpLists?.walks?.web_id"
                    (click)="viewMailchimpListEntry(member?.mailchimpLists?.walks?.web_id)"
                    title="View walks list entry In Mailchimp">
                    <img
                      [ngClass]="member?.mailchimpLists?.walks?.web_id ? 'mailchimp-logo': 'mailchimp-logo disabled-image'"
                      src="/assets/images/mailchimp/freddie_wink.svg"
                    alt="View walks list entry In Mailchimp"></button>
                  </div>
                </div>
              }
              @if (mailchimpConfig?.lists?.socialEvents) {
                <div class="row">
                  <div class="col-sm-5">
                    <div class="form-check">
                      <input (change)="mailchimpChangeSubscribed('socialEvents')"
                        [(ngModel)]="member.mailchimpLists.socialEvents.subscribed"
                        type="checkbox" class="form-check-input" id="subscribe-social-events-emails">
                      <label class="form-check-label"
                        for="subscribe-social-events-emails">Social events emails
                      </label>
                    </div>
                  </div>
                  <div class="col-sm-7">
                    <button [disabled]="!member?.mailchimpLists?.socialEvents.web_id"
                      (click)="viewMailchimpListEntry(member?.mailchimpLists?.socialEvents.web_id)"
                      title="View social list entry In Mailchimp">
                      <img
                        [ngClass]="member?.mailchimpLists?.socialEvents?.web_id ? 'mailchimp-logo': 'mailchimp-logo disabled-image'"
                        src="/assets/images/mailchimp/freddie_wink.svg"
                      alt="View social list entry In Mailchimp"></button>
                    </div>
                  </div>
                }
                <div class="col-sm-12">
                  <app-mailchimp-segment-editor [showTitle]="true"
                  [segments]="member?.mailchimpSegmentIds"></app-mailchimp-segment-editor>
                </div>
              </div>
            </div>
          }
        </div>`,
    imports: [FormsModule, NgClass, MailchimpSegmentEditorComponent, FullNameWithAliasPipe]
})
export class MailChimpSubscriptionSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MailChimpSubscriptionSettingsComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  private mailchimpLinkService = inject(MailchimpLinkService);
  protected dateUtils = inject(DateUtilsService);
  public member: Member;
  public mailchimpConfig: MailchimpConfig;

  @Input("member") set memberValue(member: Member) {
    this.member = member;
  }
  @Input("mailchimpConfig") set mailConfigValue(mailchimpConfig: MailchimpConfig) {
    this.mailchimpConfig = mailchimpConfig;
  }

  ngOnInit() {
  }

  mailchimpChangeSubscribed(listType: string) {
    const mailchimpSubscription: MailchimpSubscription = this.member.mailchimpLists[listType];
    const subscribed = mailchimpSubscription.subscribed;
    this.logger.info("listType", listType, "subscribed:", subscribed);
    if (!subscribed) {
      mailchimpSubscription.unique_email_id = null;
      mailchimpSubscription.email = null;
      mailchimpSubscription.web_id = null;
      mailchimpSubscription.updated = false;
    }
    this.logger.info("listType", listType, "mailchimpSubscription now:", mailchimpSubscription);
  }

  viewMailchimpListEntry(webId: number) {
    return window.open(`${this.mailchimpLinkService.listView(webId)}`);
  }

}
