import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import {
  CreateSenderResponse,
  MailMessagingConfig,
  NotificationConfig,
  SendersResponse
} from "../../../models/mail.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { MailService } from "../../../services/mail/mail.service";
import { CommitteeMember } from "../../../models/committee.model";
import { ALERT_ERROR, ALERT_SUCCESS } from "../../../models/alert-target.model";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: " app-sender-replies-and-sign-off",
  template: `
    <div class="row">
      <ng-container *ngIf="notificationConfig">
        <div *ngIf="senderDoesNotExist()" class="col-sm-12">
          <div class="d-flex align-items-start">
            <alert type="warning" class="flex-grow-1">
              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
              <strong class="ml-2">Sender Not Yet Created</strong>
              <span class="ml-2">- Click button to add {{ senderCommitteeMember?.fullName }} to Brevo as a sender. <a
                target="_blank" href="https://app.brevo.com/senders/list">See existing Senders</a></span>
            </alert>
            <app-brevo-button class="ml-2 mt-1" button (click)="createSender()"
                              title="Create Sender"></app-brevo-button>
          </div>
          <div *ngIf="error" class="d-flex align-items-start">
            <alert type="danger" class="flex-grow-1">
              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
              <strong class="ml-2">Error</strong>
              <span class="ml-2">{{ stringUtilsService.stringify(error) }}</span>
            </alert>
          </div>
        </div>
        <div *ngIf="this.createSenderResponse?.id" class="col-sm-12">
          <div class="d-flex align-items-start">
            <alert type="success" class="flex-grow-1">
              <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
              <strong class="ml-2">New Sender Created</strong>
              <span class="ml-2">- {{ senderCommitteeMember?.fullName }} was added to Brevo as a sender. <a
                target="_blank" href="https://app.brevo.com/senders/list">See existing Senders</a></span>
            </alert>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="form-group">
            <label for="sender">Sender</label>
            <select [(ngModel)]="notificationConfig.senderRole" (ngModelChange)="senderRoleChanged()"
                    id="sender"
                    class="form-control input-sm">
              <option *ngFor="let role of mailMessagingConfig.committeeReferenceData.committeeMembers()"
                      [ngValue]="role.type">{{ role.nameAndDescription }}
              </option>
            </select>
          </div>
        </div>
        <div *ngIf="!omitCC" class="col-sm-6">
          <div class="form-group">
            <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                                             [label]="'CC Roles'"
                                             [roles]="notificationConfig.ccRoles"
                                             (rolesChange)="this.notificationConfig.ccRoles = $event.roles;"/>
          </div>
        </div>
        <div class="col-sm-6">
          <div class="form-group">
            <label for="reply-to">Reply To</label>
            <select *ngIf="notificationConfig" [(ngModel)]="notificationConfig.replyToRole"
                    id="reply-to"
                    class="form-control input-sm">
              <option *ngFor="let role of mailMessagingConfig.committeeReferenceData.committeeMembers()"
                      [ngValue]="role.type">{{ role.nameAndDescription }}
              </option>
            </select>
          </div>
        </div>
        <div *ngIf="!omitSignOff" class="col-sm-6">
          <div class="form-group">
            <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                                             [label]="'Sign Off Email With Roles'"
                                             [roles]="notificationConfig.signOffRoles"
                                             (rolesChange)="this.notificationConfig.signOffRoles = $event.roles;"/>
          </div>
        </div>
      </ng-container>
    </div>`
})

export class SenderRepliesAndSignoffComponent implements OnInit {

  @Input("omitSignOff") set omitSignOffValue(omitSignOff: boolean) {
    this.omitSignOff = coerceBooleanProperty(omitSignOff);
  }

  @Input("omitCC") set omitCCValue(omitCC: boolean) {
    this.omitCC = coerceBooleanProperty(omitCC);
  }

  public error: any;
  public createSenderResponse: CreateSenderResponse;
  public sendersResponse: SendersResponse;
  public senderCommitteeMember: CommitteeMember;

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private mailService: MailService = inject(MailService);
  public stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private logger = this.loggerFactory.createLogger("SenderRepliesAndSignoffComponent", NgxLoggerLevel.OFF);
  public omitSignOff: boolean;
  public omitCC: boolean;
  @Output() senderExists: EventEmitter<boolean> = new EventEmitter();
  @Input() public notificationConfig: NotificationConfig;
  @Input() public mailMessagingConfig: MailMessagingConfig;

  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;

  senderDoesNotExist(): boolean {
    return !this.sendersResponse?.senders?.find(sender => sender?.email === this.senderCommitteeMember?.email);
  }

  async ngOnInit() {
    await this.refreshSenders();
    this.logger.info("constructed notificationConfig", this.notificationConfig, "mailMessagingConfig:", this.mailMessagingConfig, "sendersResponse:", this.sendersResponse);
    if (this.notificationConfig) {
      this.senderRoleChanged();
    }
  }

  private async refreshSenders() {
    this.sendersResponse = await this.mailService.querySenders();
  }

  async createSender() {
    delete this.error;
    const sender = {
      active: true,
      name: this.senderCommitteeMember.nameAndDescription,
      email: this.senderCommitteeMember.email
    };
    this.logger.info("From:", this.senderCommitteeMember, "creating sender:", sender);
    this.createSenderResponse = await this.mailService.createSender(sender).catch(error => this.error = error);
    this.logger.info("createSenderResponse:", this.createSenderResponse);
    if (this.createSenderResponse.id) {
      await this.refreshSenders();
      this.notifySenderExists();
    } else {
      this.error = {message: "Error creating sender", response: this.createSenderResponse};
    }
  }

  senderRoleChanged() {
    this.senderCommitteeMember = this.mailMessagingConfig.committeeReferenceData.committeeMemberForRole(this.notificationConfig.senderRole);
    delete this.createSenderResponse;
    this.notifySenderExists();
  }

  private notifySenderExists() {
    this.senderExists.emit(!this.senderDoesNotExist());
  }
}
