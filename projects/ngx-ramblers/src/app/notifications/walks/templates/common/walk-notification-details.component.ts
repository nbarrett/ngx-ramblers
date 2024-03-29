import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../../../models/member.model";
import { WalkDataAudit } from "../../../../models/walk-data-audit.model";
import { WalkEvent } from "../../../../models/walk-event.model";
import { WalkNotification } from "../../../../models/walk-notification.model";
import { EventType, Walk } from "../../../../models/walk.model";
import { WalkDisplayService } from "../../../../pages/walks/walk-display.service";
import { GoogleMapsService } from "../../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";

@Component({
  selector: "app-walk-notification-details",
  template: `
    <table style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Walk Date:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">{{ walk.walkDate | displayDate }}</td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Start Time:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
            [textContent]="walk.startTime | valueOrDefault"></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Description:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
            [textContent]="walk.briefDescriptionAndStartPoint | valueOrDefault"></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Longer Description:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
            [textContent]="walk.longerDescription | valueOrDefault"></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Distance:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
            [textContent]="walk.distance | valueOrDefault"></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Nearest Town:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
            [textContent]="walk.nearestTown | valueOrDefault"></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Grade:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
            [textContent]="walk.grade | valueOrDefault"></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Grid Ref:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
          <a [href]="'http://gridreferencefinder.com/?gr=' + walk.gridReference" target="_blank"><span
            [textContent]="walk.gridReference | valueOrDefault"></span></a></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Postcode:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px">
          <a [href]="googleMapsService.urlForPostcode(walk.postcode)" target="_blank"><span
            [textContent]="walk.postcode | valueOrDefault"></span></a></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Display Name:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
            [textContent]="walk.displayName | valueOrDefault"></td>
      </tr>

      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Contact Email:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"><a
          [href]="'mailto:'+ walk.contactEmail"><span
          [textContent]="walk.contactEmail | valueOrDefault"></span></a></td>
      </tr>
      <tr>
        <td style="border:1px solid lightgrey; font-weight: bold; padding: 6px">Contact Phone:</td>
        <td style="border:1px solid lightgrey; font-weight: normal; padding: 6px"
            [textContent]="walk.contactPhone"></td>
      </tr>
      <tr>
    </table>`
})
export class WalkNotificationDetailsComponent implements OnInit {

  @Input("data") set walkNotificationValue(data: WalkNotification) {
    this.data = data;
    this.initialiseData();
  }
  public data: WalkNotification;
  public walk: Walk;
  public status: EventType;
  public event: WalkEvent;
  public walkDataAudit: WalkDataAudit;
  public validationMessages: string[];
  public reason: string;

  protected logger: Logger;
  public members: Member[];

  constructor(
    public googleMapsService: GoogleMapsService,
    public display: WalkDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkNotificationDetailsComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:members ->", this.display.members);
    this.members = this.display.members;
    this.initialiseData();
  }

  private initialiseData() {
    this.logger.info("initialiseData:data ->", this.data);
    if (this.data) {
      this.walk = this.data.walk;
      this.status = this.data.status;
      this.event = this.data.event;
      this.walkDataAudit = this.data.walkDataAudit;
      this.validationMessages = this.data.validationMessages;
      this.reason = this.data.reason;
    }
  }

}
