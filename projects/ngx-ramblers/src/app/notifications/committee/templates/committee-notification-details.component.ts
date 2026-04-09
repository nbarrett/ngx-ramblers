import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeFile, GroupEventSummary, Notification, NotificationItem } from "../../../models/committee.model";
import { Member } from "../../../models/member.model";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageService } from "../../../services/page.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { Subscription } from "rxjs";
import { Organisation } from "../../../models/system.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { CommitteeNotificationRamblersMessageItemComponent } from "./committee-notification-ramblers-message-item";
import { MarkdownComponent } from "ngx-markdown";
import { CommitteeNotificationGroupEventMessageItemComponent } from "./committee-notification-group-event-message-item";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
    selector: "app-committee-notification-details",
    template: `

<app-committee-notification-ramblers-message-item
  [notificationItem]="toNotificationItemFromNotification(notification)">
  <div markdown [data]="notification.content.text.value"></div>
  @if (notification?.content.includeDownloadInformation) {
    <p>
      <b>File type:</b>
      <span>{{ committeeFile.fileType }}</span>
      <br>
        <b>Description:</b>
        <span>{{ display.fileTitle(committeeFile) }}</span>
      </p>
      <p>If you want to download this attachment you can click <a [href]="display.fileUrl(committeeFile)">here</a>,
      alternatively
      you can view or download it from our {{ group?.shortName }}
      <a [href]="absolutePageUrl()">{{ sourcePageTitle || currentPageTitle() }} page</a>.
    </p>
  }
</app-committee-notification-ramblers-message-item>

@if (selectedGroupEvents().length > 0) {
  @for (event of selectedGroupEvents(); track event.id; let last = $last) {
    <app-committee-notification-ramblers-message-item [notificationItem]="toNotificationItem(event, notification)">
      <app-committee-notification-group-event-message-item [notification]="notification" [event]="event"/>
    </app-committee-notification-ramblers-message-item>
    @if (!last) {
      <table align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;width:100%;" width="100%">
        <tbody>
        <tr>
          <td style="padding: 10px 0 26px;">
            <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;width:100%;" width="100%">
              <tbody>
              <tr>
                <td style="border-top: 2px solid #f6b09d;">&nbsp;</td>
              </tr>
              </tbody>
            </table>
          </td>
        </tr>
        </tbody>
      </table>
    }
  }
}
@if (notification.content.signoffText.include) {
  <app-committee-notification-ramblers-message-item>
    <div markdown [data]="notification?.content.signoffText.value"></div>
    @if (notification?.content.signoffAs.include) {
      <app-contact-us format="list"
      [roles]="notification?.content.signoffAs.value"></app-contact-us>
    }
  </app-committee-notification-ramblers-message-item>
}`,
    imports: [CommitteeNotificationRamblersMessageItemComponent, MarkdownComponent, CommitteeNotificationGroupEventMessageItemComponent, ContactUsComponent]
})
export class CommitteeNotificationDetailsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeNotificationDetailsComponent", NgxLoggerLevel.ERROR);
  mailMessagingService = inject(MailMessagingService);
  googleMapsService = inject(GoogleMapsService);
  private systemConfigService = inject(SystemConfigService);
  private pageService = inject(PageService);
  private urlService = inject(UrlService);
  private stringUtils = inject(StringUtilsService);
  display = inject(CommitteeDisplayService);

  @Input()
  public members: Member[];
  @Input()
  public committeeFile: CommitteeFile;
  @Input()
  public notification: Notification;
  @Input()
  public sourcePagePath: string;
  @Input()
  public sourcePageTitle: string;

  private subscriptions: Subscription[] = [];
  public group: Organisation;

  selectedGroupEvents(): GroupEventSummary[] {
    return this.notification.groupEvents.filter(item => item.selected);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:notification ->", this.notification, "committeeFile ->", this.committeeFile);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
  }

  absolutePageUrl(): string {
    const path = this.sourcePagePath || this.urlService.urlPath();
    return this.urlService.baseUrl() + "/" + path;
  }

  currentPageTitle(): string {
    return this.pageService.titleFromPath(this.urlService.urlPath());
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  toNotificationItem(event: GroupEventSummary, notification: Notification): NotificationItem {
    const href = this.display.urlService.linkUrl({area: event.eventType.area, id: event.slug || event.id});
    const title = "View " + this.stringUtils.asTitle(this.stringUtils.asWords(event.ramblersEventType || event.eventType.eventType || ""));
    const image = notification.groupEventsFilter.includeImage ? {
      alt: title,
      link: {href, title},
      src: event.image
    } : null;
    return {
      callToAction: {
        href,
        title
      },
      image,
      subject: event.title,
      text: event.description
    };
  }

  toNotificationItemFromNotification(notification: Notification): NotificationItem {
    return {
      callToAction: null,
      image: null,
      subject: notification.content.title.value,
      text: notification.content.text.value
    };
  }
}
