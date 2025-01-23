import { Component, inject, Input } from "@angular/core";
import { NotificationConfig, SendSmtpEmailParams } from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";

@Component({
  selector: "app-forgot-password-notification-details",
  template: `
    <div>
      @if (notificationConfig?.bannerId) {
        <div class="row w-100 mx-0 mt-2">
          <img class="card-img"
            [src]="mailMessagingService.bannerImageSource(notificationConfig, true)">
        </div>
      }
      <h1>{{ params?.systemMergeFields?.APP_SHORTNAME }} {{ notificationConfig.subject }}</h1>
      <p>Hi {{ params?.memberMergeFields?.FNAME }},</p>
      <p>Sorry you are having trouble logging into the {{ params?.systemMergeFields?.APP_SHORTNAME }}
      site.</p>
      <p>Please click the following link:
        <a href="{{params?.systemMergeFields?.APP_URL}}/admin/set-password/{{params?.memberMergeFields?.PW_RESET}}"
          target="_blank">{{ params?.systemMergeFields?.APP_URL }}
        /admin/set-password/{{ params?.memberMergeFields?.PW_RESET }}</a> and you will be redirected to
        a page on the site
        where you will be guided through the password reset
        process and all should be well.
      </p>
      <p>Please note that once you complete the password reset and login, you will first be asked to enter your User
        Name which is: <strong>{{ params?.memberMergeFields?.USERNAME }}</strong>
      </p>
      <p>If you have any trouble performing this password reset or any problems with the site, please don't hesitate
        to contact one of us by clicking on the most suitable email link below:
      </p>
    </div>
    <app-contact-us [format]="'list'" [roles]="notificationConfig?.signOffRoles"></app-contact-us>
    `,
  standalone: false
})
export class ForgotPasswordNotificationDetailsComponent {

  public mailMessagingService: MailMessagingService = inject(MailMessagingService);

  @Input() params: SendSmtpEmailParams;
  @Input() notificationConfig: NotificationConfig;

}
