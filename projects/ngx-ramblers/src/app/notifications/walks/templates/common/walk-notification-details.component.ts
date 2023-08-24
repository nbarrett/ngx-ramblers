import { AfterViewInit, Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../../../models/member.model";
import { WalkDataAudit } from "../../../../models/walk-data-audit.model";
import { WalkEvent } from "../../../../models/walk-event.model";
import { WalkNotification } from "../../../../models/walk-notification.model";
import { EventType, Walk } from "../../../../models/walk.model";
import { WalkDisplayService } from "../../../../pages/walks/walk-display.service";
import { GoogleMapsService } from "../../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { RamblersWalksAndEventsService } from "../../../../services/walks/ramblers-walks-and-events.service";

@Component({
  selector: "app-walk-notification-details",
  templateUrl: "./walk-notification-details.component.html"
})
export class WalkNotificationDetailsComponent implements OnInit, AfterViewInit {

  @Input()
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
    public ramblersWalksAndEventsService: RamblersWalksAndEventsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkNotificationDetailsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:data ->", this.data);
    if (this.data) {
      this.walk = this.data.walk;
      this.status = this.data.status;
      this.event = this.data.event;
      this.walkDataAudit = this.data.walkDataAudit;
      this.validationMessages = this.data.validationMessages;
      this.reason = this.data.reason;
    }
    this.members = this.display.members;
  }

  ngAfterViewInit(): void {
    this.logger.debug("ngAfterViewInit:data ->", this.data);
  }

}
