import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { MailMessagingConfig, NotificationConfig } from "../../../../models/mail.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { Subscription } from "rxjs";
import { KEY_NULL_VALUE_NONE } from "../../../../services/enums";

@Component({
  selector: "app-notification-config-to-process-mapping",
  template: `
    <div *ngIf="mailMessagingConfig" class="row img-thumbnail thumbnail-2">
      <div class="thumbnail-heading">Process Mappings</div>
      <div class="col-sm-12">
        <div class="form-group">
          <label for="process-mapping-forgot-password">Forgot Password Process Uses Email Configuration</label>
          <select [(ngModel)]="mailMessagingConfig.mailConfig.forgotPasswordNotificationConfigId"
                  id="process-mapping-forgot-password"
                  class="form-control input-sm">
            <option *ngFor="let mapping of notificationConfigsPlusNone"
                    [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
            </option>
          </select>
        </div>
      </div>
      <div class="col-sm-12">
        <div class="form-group">
          <label for="process-mapping-walk-notification">Walk Changes Notifications Uses Email Configuration</label>
          <select [(ngModel)]="mailMessagingConfig.mailConfig.walkNotificationConfigId"
                  id="process-mapping-walk-notification"
                  class="form-control input-sm">
            <option
              *ngFor="let mapping of notificationConfigsPlusNone"
              [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
            </option>
          </select>
        </div>
      </div>
    </div>
  `
})

export class NotificationConfigToProcessMappingComponent implements OnInit, OnDestroy {

  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private subscriptions: Subscription[] = [];
  public notificationConfigsPlusNone: NotificationConfig[];
  private logger: Logger = this.loggerFactory.createLogger("NotificationConfigToProcessMappingComponent", NgxLoggerLevel.OFF);
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  public mailMessagingConfig: MailMessagingConfig;

  ngOnInit() {
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.notificationConfigsPlusNone = [{
        id: KEY_NULL_VALUE_NONE.key,
        subject: {text: KEY_NULL_VALUE_NONE.value}
      } as NotificationConfig].concat(mailMessagingConfig.notificationConfigs);
      this.logger.info("mailMessagingConfig:", mailMessagingConfig);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
