import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeFile, GroupEvent, Notification } from "../../../models/committee.model";
import { Member } from "../../../models/member.model";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Subscription } from "rxjs";
import { Organisation } from "../../../models/system.model";

@Component({
  selector: "app-committee-notification-details",
  templateUrl: "./committee-notification-details.component.html"
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
    private changeDetectorRef: ChangeDetectorRef,
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
