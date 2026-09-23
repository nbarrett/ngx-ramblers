import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { MailMessagingConfig, NotificationConfig } from "../../../../models/mail.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { Subscription } from "rxjs";
import { KEY_NULL_VALUE_NONE } from "../../../../functions/enums";
import { ContentTextEditor } from "../../../../modules/common/tiptap-editor/content-text-editor";
import { FormsModule } from "@angular/forms";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { volunteerManagementEnabled } from "../../../../functions/volunteer-management";

@Component({
    selector: "app-notification-config-to-process-mapping",
    template: `
    @if (mailMessagingConfig) {
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Process Mappings</div>
        <div class="col-sm-12 mb-3">
          <app-content-text-editor standalone category="admin" name="mail-settings-process-mappings"/>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="process-mapping-contact-us">Contact Us Process Uses Email Configuration</label>
            <select [(ngModel)]="mailMessagingConfig.mailConfig.contactUsNotificationConfigId"
              id="process-mapping-contact-us"
              class="form-control input-sm">
              @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                <option
                  [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="process-mapping-forgot-password">Forgot Password Process Uses Email Configuration</label>
            <select [(ngModel)]="mailMessagingConfig.mailConfig.forgotPasswordNotificationConfigId"
              id="process-mapping-forgot-password"
              class="form-control input-sm">
              @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                <option
                  [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="process-mapping-walk-notification">Walk Changes Notifications Uses Email Configuration</label>
            <select [(ngModel)]="mailMessagingConfig.mailConfig.walkNotificationConfigId"
              id="process-mapping-walk-notification"
              class="form-control input-sm">
              @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                <option
                  [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="process-mapping-expense-notification">Expense Notifications Use Email Configuration</label>
            <select [(ngModel)]="mailMessagingConfig.mailConfig.expenseNotificationConfigId"
              id="process-mapping-expense-notification"
              class="form-control input-sm">
              @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                <option
                  [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="process-mapping-booking-notification">Booking Notifications Use Email Configuration</label>
            <select [(ngModel)]="mailMessagingConfig.mailConfig.bookingNotificationConfigId"
              id="process-mapping-booking-notification"
              class="form-control input-sm">
              @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                <option
                  [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="process-mapping-member-sync-notification">Member Sync Notifications Use Email Configuration</label>
            <select [(ngModel)]="mailMessagingConfig.mailConfig.memberSyncNotificationConfigId"
              id="process-mapping-member-sync-notification"
              class="form-control input-sm">
              @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                <option
                  [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="process-mapping-bulk-load-digest">Member Bulk Load Committee Summary Uses Email Configuration</label>
            <select [(ngModel)]="mailMessagingConfig.mailConfig.memberBulkLoadDigestConfigId"
              id="process-mapping-bulk-load-digest"
              class="form-control input-sm">
              @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                <option
                  [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="col-sm-12">
          <div class="form-group">
            <label for="process-mapping-photo-upload-notification">Walk Photos Added By Members Uses Email Configuration</label>
            <select [(ngModel)]="mailMessagingConfig.mailConfig.photoUploadNotificationConfigId"
              id="process-mapping-photo-upload-notification"
              class="form-control input-sm">
              @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                <option
                  [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        @if (volunteerManagementEnabled) {
          <div class="col-sm-12">
            <div class="form-group">
              <label for="process-mapping-volunteer-notification">Rights of Way Volunteer Correspondence Uses Email Configuration</label>
              <select [(ngModel)]="mailMessagingConfig.mailConfig.volunteerNotificationConfigId"
                id="process-mapping-volunteer-notification"
                class="form-control input-sm">
                @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                  <option
                    [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}
                  </option>
                }
              </select>
            </div>
          </div>
        }
        @if (platformMailConfigsVisible) {
          @for (process of registrationProcesses; track process.key) {
            <div class="col-sm-12">
              <div class="form-group">
                <label [for]="'process-mapping-' + process.key">{{process.label}} Uses Email Configuration</label>
                <select [(ngModel)]="mailMessagingConfig.mailConfig[process.key]" [id]="'process-mapping-' + process.key" class="form-control input-sm">
                  @for (mapping of notificationConfigsPlusNone; track mapping.id) {
                    <option [ngValue]="mapping.id">{{ mapping?.subject?.text || '(no subject)' }}</option>
                  }
                </select>
              </div>
            </div>
          }
        }
      </div>
    }
    `,
    imports: [ContentTextEditor, FormsModule]
})

export class NotificationConfigToProcessMappingComponent implements OnInit, OnDestroy {

  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private subscriptions: Subscription[] = [];
  public notificationConfigsPlusNone: NotificationConfig[];
  private logger: Logger = this.loggerFactory.createLogger("NotificationConfigToProcessMappingComponent", NgxLoggerLevel.ERROR);
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  public mailMessagingConfig: MailMessagingConfig;
  public platformMailConfigsVisible = false;
  public volunteerManagementEnabled = false;
  private systemConfigService = inject(SystemConfigService);
  public readonly registrationProcesses = [
    {key: "registrationConfirmationConfigId", label: "Site Registration Confirmation"},
    {key: "registrationReviewConfigId", label: "Site Registration Review"},
    {key: "registrationInvitationConfigId", label: "Site Registration Invitation"}
  ] as const;

  ngOnInit() {
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.refreshNotificationConfigOptions();
      this.logger.info("mailMessagingConfig:", mailMessagingConfig, "notificationConfigsPlusNone:", this.notificationConfigsPlusNone);
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(config => {
      this.volunteerManagementEnabled = volunteerManagementEnabled(config);
      this.refreshNotificationConfigOptions();
    }));
    this.refreshNotificationConfigOptions();
  }

  private refreshNotificationConfigOptions() {
    const flags = this.mailMessagingService.notificationConfigFlags();
    this.platformMailConfigsVisible = flags.platformMailConfigsVisible;
    if (!this.mailMessagingConfig) {
      this.notificationConfigsPlusNone = [];
    } else {
      this.notificationConfigsPlusNone = [{
        id: KEY_NULL_VALUE_NONE.key,
        subject: {text: KEY_NULL_VALUE_NONE.value}
      } as NotificationConfig].concat(this.mailMessagingService.visibleNotificationConfigs(this.mailMessagingConfig.notificationConfigs));
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
