import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeFile, GroupEvent, Notification } from "../../../models/committee.model";
import { Member } from "../../../models/member.model";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Subscription } from "rxjs";
import { Organisation } from "../../../models/system.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";

@Component({
  selector: "app-committee-notification-details",
  template: `
    <p markdown [data]="notification.content.text.value"></p>
    <ng-container *ngIf="notification?.content.includeDownloadInformation">
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
        <a href="committee">Committee page</a>.
      </p>
    </ng-container>
    <ng-container *ngIf="selectedGroupEvents().length > 0">
      <h4><strong style="font-size:14px">Up and coming events</strong></h4>
      <div *ngFor="let event of selectedGroupEvents()">
        <p style="font-size: 14px;font-weight: bold">
          <span [textContent]="event.eventDate | displayDate"></span>
          <span *ngIf="event.eventTime"> • <span [textContent]="event.eventTime"></span>
      </span>
          •
          <span [textContent]="event.eventType.description"></span>
          •
          <app-link area="{{event.eventType.area}}"
                    id="{{event.id}}"
                    text="{{event.title}}"></app-link>
          <span *ngIf="event.distance"> •
        <span [textContent]="event.distance"></span>
      </span>
        </p>
        <div style="font-size: 14px;font-weight: bold">
      <span *ngIf="notification.groupEventsFilter.includeContact && event.contactName">
        Contact: <a [href]="'mailto:' + event.contactEmail">
        <span [textContent]="event.contactName || event.contactEmail"></span>
      </a>
        <span *ngIf="event.contactPhone"> ({{ event.contactPhone }})</span>
      </span>
          <span *ngIf="notification.groupEventsFilter.includeLocation && event.postcode">
        • Location: <a [href]="googleMapsService.urlForPostcode(event.postcode)"
                       target="_blank">
        <span [textContent]="event.postcode"></span>
      </a></span>
        </div>
        <p markdown [data]="event.description" style="padding: 0px 0px 0px 0px"
           *ngIf="notification.groupEventsFilter.includeDescription"></p>
      </div>
    </ng-container>
    <p *ngIf="notification.content.signoffText.include" markdown [data]="notification?.content.signoffText.value"></p>`
})
export class CommitteeNotificationDetailsComponent implements OnInit, OnDestroy {

  @Input()
  public members: Member[];
  @Input()
  public committeeFile: CommitteeFile;
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
    this.logger = loggerFactory.createLogger(CommitteeNotificationDetailsComponent, NgxLoggerLevel.OFF);
  }

  selectedGroupEvents(): GroupEvent[] {
    return this.notification.groupEvents.filter(item => item.selected);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:notification ->", this.notification, "committeeFile ->", this.committeeFile);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
