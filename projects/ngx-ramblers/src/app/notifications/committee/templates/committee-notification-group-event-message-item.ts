import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GroupEventSummary, Notification } from "../../../models/committee.model";
import { Member } from "../../../models/member.model";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Subscription } from "rxjs";
import { Organisation } from "../../../models/system.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { NgStyle } from "@angular/common";
import { MarkdownComponent } from "ngx-markdown";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";

@Component({
    selector: "app-committee-notification-group-event-message-item",
    template: `
      <span>{{ event?.eventDate | displayDate }}</span>
      @if (event?.eventTime) {
        <span> • <span>{{ event?.eventTime }}</span></span>
      }
      <span> • </span>
      <span>{{ event?.eventType?.description }}</span>
      @if (event?.distance) {
        <span> • {{ event.distance }}</span>
      }
      <br/>
      @if (notification?.groupEventsFilter?.includeContact && event.contactName) {
        <span>
        Contact: <a [href]="'mailto:' + event.contactEmail">
        <span>{{ event.contactName || event.contactEmail }}</span>
      </a>
          @if (event?.contactPhone) {
            <span> ({{ event?.contactPhone }})</span>
          }
    </span>
      }
      @if (notification?.groupEventsFilter?.includeLocation && event?.postcode) {
        <span>
        <span> • </span>Location: @if (event?.location) {
          <span [ngStyle]="{'margin-right': '6px'}">{{ event.location }}</span>
        }  <a [href]="googleMapsService.urlForPostcode(event.postcode)"
              target="_blank">{{ event.postcode }}</a></span>
      }
      @if (notification?.groupEventsFilter?.includeDescription) {
        <div markdown [data]="event.description"></div>
      }`,
    imports: [NgStyle, MarkdownComponent, DisplayDatePipe]
})
export class CommitteeNotificationGroupEventMessageItemComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeNotificationGroupEventMessageItemComponent", NgxLoggerLevel.ERROR);
  mailMessagingService = inject(MailMessagingService);
  googleMapsService = inject(GoogleMapsService);
  private systemConfigService = inject(SystemConfigService);
  display = inject(CommitteeDisplayService);
  private subscriptions: Subscription[] = [];
  public group: Organisation;

  @Input()
  public members: Member[];

  @Input()
  public event: GroupEventSummary;

  @Input()
  public notification: Notification;

  ngOnInit() {
    this.logger.info("ngOnInit:event ->", this.event);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
