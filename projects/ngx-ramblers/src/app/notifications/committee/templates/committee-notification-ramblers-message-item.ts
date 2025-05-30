import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { NotificationItem } from "../../../models/committee.model";
import { Member } from "../../../models/member.model";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Subscription } from "rxjs";
import { Organisation } from "../../../models/system.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { NgStyle } from "@angular/common";
import { UrlService } from "../../../services/url.service";

@Component({
    selector: "app-committee-notification-ramblers-message-item",
  template: `
    <table align="center" border="0" cellpadding="0" cellspacing="0"
           style="border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;width:600px;"
           width="600">
      <tbody>
      <tr>
        <td style="mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
            valign="top">
          <table align="center" border="0" cellpadding="0" cellspacing="0"
                 style="border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;">
            <tbody>
              @if (notificationItem?.image?.src) {
                <tr>
                  <td align="center"
                      style="mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
                      valign="top">
                    <a href="{{notificationItem.image.link.href}}"
                       style="mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
                       target="_blank" title=""> <img
                      alt="{{notificationItem.image.alt}}"
                      src="{{urlService.imageSource(notificationItem.image.src, true)}}"
                      [ngStyle]="{
                  'object-fit': 'cover',
                  'object-position': 'center',
                   'max-width': '1200px',
                   'border': '0',
                   'height': 'auto',
                   'outline': 'none',
                   'text-decoration': 'none',
                   '-ms-interpolation-mode': 'bicubic',
                   'vertical-align': 'bottom'}"
                      width="600"/> </a></td>
                </tr>
              }
            <tr>
              <td
                style="mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;word-break: break-word;color: #757575;font-family: Helvetica;font-size: 16px;line-height: 150%;text-align: left;"
                valign="top" width="600">
                @if (notificationItem?.subject) {
                  <h3
                    style="display: block;margin: 0;padding: 0;color: #444444;font-family: Helvetica;font-size: 22px;font-style: normal;font-weight: bold;line-height: 150%;letter-spacing: normal;text-align: left;">
                    <span style="color:#000000">{{ notificationItem.subject }}</span>
                  </h3>
                }
                <span
                  style="margin: 10px 0;padding: 0;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;color:#000000;font-family: Helvetica;font-size: 16px;line-height: 150%;text-align: left;">
                    <ng-content/>
                  </span>
              </td>
            </tr>
            </tbody>
          </table>
        </td>
      </tr>
      </tbody>
    </table>
    @if (notificationItem?.callToAction) {
      <table align="center" border="0" cellpadding="0" cellspacing="0"
             style="border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;width:600px;"
             width="600">
        <tbody>
        <tr>
          <td align="center"
              style="padding-top: 0;padding-bottom: 18px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
              valign="top">
            <table border="0" cellpadding="0" cellspacing="0"
                   style="border-collapse: separate !important;border-radius: 0px;background-color: #F9B104;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
                   width="100%">
              <tbody>
              <tr>
                <td align="center"
                    style="font-family: Arial;font-size: 16px;padding: 12px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
                    valign="middle">
                  <a target=" _blank"
                     style="font-weight:bold;letter-spacing:normal;line-height:100%;text-align:center;text-decoration:none;color:#202020;mso-line-height-rule:exactly;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;display:block;"
                     title="{{notificationItem.callToAction.title}}"
                     href="{{notificationItem.callToAction.href}}">
                    {{ notificationItem.callToAction.title }}</a>
                </td>
              </tr>
              </tbody>
            </table>
          </td>
        </tr>
        </tbody>
      </table>
    }
    <table align="center" border="0" cellpadding="0" cellspacing="0"
           style="border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;width:600px;"
           width="600">
      <tbody>
      <tr>
        <td
          style="min-width: 100%;padding: 20px 0px 30px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;">
          <table border="0" cellpadding="0" cellspacing="0"
                 style="min-width: 100%;border-top: 2px solid #F6B09D;border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
                 width="100%">
            <tbody>
            <tr>
              <td
                style="mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;">
              </td>
            </tr>
            </tbody>
          </table>
        </td>
      </tr>
      </tbody>
    </table>`,
    imports: [NgStyle]
})
export class CommitteeNotificationRamblersMessageItemComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeNotificationRamblersMessageItemComponent", NgxLoggerLevel.ERROR);
  protected mailMessagingService = inject(MailMessagingService);
  protected googleMapsService = inject(GoogleMapsService);
  protected urlService = inject(UrlService);
  private systemConfigService = inject(SystemConfigService);
  protected display = inject(CommitteeDisplayService);

  @Input()
  public members: Member[];

  @Input()
  public notificationItem: NotificationItem;
  private subscriptions: Subscription[] = [];
  public group: Organisation;

  ngOnInit() {
    this.logger.debug("ngOnInit:notificationItem ->", this.notificationItem);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
