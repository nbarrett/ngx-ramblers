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
  templateUrl: "./committee-notification-ramblers-message-item.html"
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
