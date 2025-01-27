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

@Component({
    selector: "app-committee-notification-ramblers-message-item",
    templateUrl: "./committee-notification-ramblers-message-item.html",
    imports: [NgStyle]
})
export class CommitteeNotificationRamblersMessageItemComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeNotificationRamblersMessageItemComponent", NgxLoggerLevel.ERROR);
  mailMessagingService = inject(MailMessagingService);
  googleMapsService = inject(GoogleMapsService);
  private systemConfigService = inject(SystemConfigService);
  display = inject(CommitteeDisplayService);

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
