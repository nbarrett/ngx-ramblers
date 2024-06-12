import { Component, Input, OnDestroy, OnInit } from "@angular/core";
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

@Component({
  selector: "app-committee-notification-ramblers-message-item",
  template: `
    <table border="0" cellpadding="0" cellspacing="0"
           style="border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
           width="100%">
      <tbody>
      <tr>
        <td
          style="padding: 9px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
          valign="top">
          <table align="left" border="0" cellpadding="0" cellspacing="0"
                 style="border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;">
            <tbody>
            <tr *ngIf="notificationItem?.image?.src">
              <td align="center"
                  style="padding: 0 9px 9px 9px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
                  valign="top">
                <a href="{{notificationItem.image.link.href}}"
                   style="mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
                   target="_blank" title=""> <img
                  alt="{{notificationItem.image.alt}}"
                  src="{{notificationItem.image.src}}"
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
                  width="563"/> </a></td>
            </tr>
            <tr>
              <td
                style="padding: 0 9px 0 9px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;word-break: break-word;color: #757575;font-family: Helvetica;font-size: 16px;line-height: 150%;text-align: left;"
                valign="top" width="563">
                <h3 *ngIf="notificationItem?.subject"
                  style="display: block;margin: 0;padding: 0;color: #444444;font-family: Helvetica;font-size: 22px;font-style: normal;font-weight: bold;line-height: 150%;letter-spacing: normal;text-align: left;">
                  <span style="color:#000000">{{ notificationItem.subject }}</span>
                </h3>
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
    <table *ngIf="notificationItem?.callToAction" border="0" cellpadding="0" cellspacing="0"
           style="min-width: 100%;border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace: 0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
           width="100%">
      <tbody>
      <tr>
        <td align="center"
            style="padding-top: 0;padding-right: 18px;padding-bottom: 18px;padding-left: 18px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"
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
    <table border="0" cellpadding="0" cellspacing="0" style="min-width: 100%;border-collapse: collapse;mso-table-lspace: 0pt;mso-table-rspace:
                0pt;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;table-layout: fixed !important;"
           width="100%">
      <tbody>
      <tr>
        <td
          style="min-width: 100%;padding: 20px 18px 30px;mso-line-height-rule: exactly;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;">
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
    </table>`
})
export class CommitteeNotificationRamblersMessageItemComponent implements OnInit, OnDestroy {

  @Input()
  public members: Member[];

  @Input()
  public notificationItem: NotificationItem;

  protected logger: Logger;
  private subscriptions: Subscription[] = [];
  public group: Organisation;

  constructor(
    public mailMessagingService: MailMessagingService,
    public googleMapsService: GoogleMapsService,
    private systemConfigService: SystemConfigService,
    public display: CommitteeDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CommitteeNotificationRamblersMessageItemComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:notificationItem ->", this.notificationItem);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
