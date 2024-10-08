import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GroupEvent, Notification, NotificationItem } from "../../../models/committee.model";
import { Member } from "../../../models/member.model";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Subscription } from "rxjs";
import { Organisation } from "../../../models/system.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";

@Component({
  selector: "app-committee-notification-group-event-message-item",
  template: `
    <span>{{ event.eventDate | displayDate }}</span>
    <span *ngIf="event.eventTime"> • <span>{{ event.eventTime }}</span></span>
    <span> • </span>
    <span>{{ event.eventType.description }}</span>
    <span *ngIf="event.distance"> • {{ event.distance }}</span>
    <br/>
    <span *ngIf="notification.groupEventsFilter.includeContact && event.contactName">
        Contact: <a [href]="'mailto:' + event.contactEmail">
        <span>{{ event.contactName || event.contactEmail }}</span>
      </a>
      <span *ngIf="event.contactPhone"> ({{ event.contactPhone }})</span>
    </span>
    <span *ngIf="notification.groupEventsFilter.includeLocation && event.postcode">
    <span> • </span>Location: <span *ngIf="event.location" [ngStyle]="{'margin-right': '6px'}">{{event.location}}</span>  <a [href]="googleMapsService.urlForPostcode(event.postcode)"
                       target="_blank">{{ event.postcode }}</a></span>
    <div markdown [data]="event.description" *ngIf="notification.groupEventsFilter.includeDescription"></div>`
})
export class CommitteeNotificationGroupEventMessageItemComponent implements OnInit, OnDestroy {

  @Input()
  public members: Member[];

  @Input()
  public event: GroupEvent;

  @Input()
  public notification: Notification;

  protected logger: Logger;
  private subscriptions: Subscription[] = [];
  public group: Organisation;

  constructor(
    public mailMessagingService: MailMessagingService,
    public googleMapsService: GoogleMapsService,
    private systemConfigService: SystemConfigService,
    public display: CommitteeDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CommitteeNotificationGroupEventMessageItemComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:event ->", this.event);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
