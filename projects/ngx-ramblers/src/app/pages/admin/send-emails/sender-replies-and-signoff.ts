import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MailMessagingConfig, NotificationConfig } from "../../../models/mail.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { CommitteeMember } from "../../../models/committee.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { CreateOrAmendSenderComponent } from "./create-or-amend-sender";
import { FormsModule } from "@angular/forms";
import { CommitteeRoleMultiSelectComponent } from "../../../committee/role-multi-select/committee-role-multi-select";

@Component({
    selector: "app-sender-replies-and-sign-off",
    template: `
    <div class="row" app-create-or-amend-sender (senderExists)="senderExists.emit($event)"
    [committeeRoleSender]="committeeRoleSender"></div>
    @if (notificationConfig) {
      <div class="row">
        <div class="col-sm-6">
          <div class="form-group">
            <label for="sender">Sender</label>
            <select [(ngModel)]="notificationConfig.senderRole" (ngModelChange)="senderRoleChanged()"
              id="sender"
              class="form-control input-sm">
              @for (role of mailMessagingConfig.committeeReferenceData.committeeMembers(); track role) {
                <option
                  [ngValue]="role.type">{{ role.nameAndDescription }}
                </option>
              }
            </select>
          </div>
        </div>
        @if (!omitCC) {
          <div class="col-sm-6">
            <div class="form-group">
              <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                [label]="'CC Roles'"
                [roles]="notificationConfig.ccRoles"
                (rolesChange)="this.notificationConfig.ccRoles = $event.roles;"/>
            </div>
          </div>
        }
        <div class="col-sm-6">
          <div class="form-group">
            <label for="reply-to">Reply To</label>
            @if (notificationConfig) {
              <select [(ngModel)]="notificationConfig.replyToRole"
                id="reply-to"
                class="form-control input-sm">
                @for (role of mailMessagingConfig.committeeReferenceData.committeeMembers(); track role) {
                  <option
                    [ngValue]="role.type">{{ role.nameAndDescription }}
                  </option>
                }
              </select>
            }
          </div>
        </div>
        @if (!omitSignOff) {
          <div class="col-sm-6">
            <div class="form-group">
              <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                [label]="'Sign Off Email With Roles'"
                [roles]="notificationConfig.signOffRoles"
                (rolesChange)="this.notificationConfig.signOffRoles = $event.roles;"/>
            </div>
          </div>
        }
      </div>
    }`,
    imports: [CreateOrAmendSenderComponent, FormsModule, CommitteeRoleMultiSelectComponent]
})

export class SenderRepliesAndSignoffComponent implements OnInit {

  @Input("omitSignOff") set omitSignOffValue(omitSignOff: boolean) {
    this.omitSignOff = coerceBooleanProperty(omitSignOff);
  }

  @Input("omitCC") set omitCCValue(omitCC: boolean) {
    this.omitCC = coerceBooleanProperty(omitCC);
  }

  public error: any;
  public committeeRoleSender: CommitteeMember;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private logger = this.loggerFactory.createLogger("SenderRepliesAndSignoffComponent", NgxLoggerLevel.ERROR);
  public omitSignOff: boolean;
  public omitCC: boolean;
  @Output() senderExists: EventEmitter<boolean> = new EventEmitter();

  private notificationConfigInternal: NotificationConfig;

  @Input({ required: true })
  set notificationConfig(value: NotificationConfig) {
    this.notificationConfigInternal = value;
    this.handleNotificationConfigChange();
  }

  get notificationConfig(): NotificationConfig {
    return this.notificationConfigInternal;
  }

  @Input() public mailMessagingConfig: MailMessagingConfig;

  async ngOnInit() {
    this.senderRoleChanged();
    this.logger.info("constructed notificationConfig", this.notificationConfig, "mailMessagingConfig:", this.mailMessagingConfig, "sender:", this.committeeRoleSender);
  }

  senderRoleChanged() {
    this.committeeRoleSender = this.mailMessagingConfig.committeeReferenceData.committeeMemberForRole(this.notificationConfig.senderRole);
  }

  private handleNotificationConfigChange() {
    this.logger.info("notificationConfig changed:", this.notificationConfig);
    this.senderRoleChanged();
  }
}
