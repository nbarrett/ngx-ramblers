import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { CreateSenderResponse, Sender, SendersResponse } from "../../../models/mail.model";
import { MailService } from "../../../services/mail/mail.service";
import { CommitteeMember } from "../../../models/committee.model";
import { ALERT_ERROR, ALERT_SUCCESS } from "../../../models/alert-target.model";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "[app-create-or-amend-sender]",
  template: `
    <div *ngIf="senderDoesNotExist()" class="col-sm-12">
      <div class="d-flex align-items-start">
        <alert type="warning" class="flex-grow-1">
          <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
          <strong class="ml-2">Sender Not Yet Created</strong>
          <span class="ml-2">- Click button to add {{ senderCommitteeMemberInternal?.fullName }}
            to Brevo as a sender. <a
              target="_blank" href="https://app.brevo.com/senders/list">See existing Senders</a></span>
        </alert>
        <app-brevo-button class="ml-2 mt-1" [disabled]="!senderCommitteeMemberInternal || apiRequestPending" button
                          (click)="createSender() "
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
          <span class="ml-2">- {{ senderCommitteeMemberInternal?.fullName }} was added to Brevo as a sender. <a
            target="_blank" href="https://app.brevo.com/senders/list">See existing Senders</a></span>
        </alert>
      </div>
    </div>`
})

export class CreateOrAmendSenderComponent implements OnInit {

  public error: any;
  public apiRequestPending: boolean;
  public createSenderResponse: CreateSenderResponse;
  public sendersResponse: SendersResponse;
  protected senderCommitteeMemberInternal: CommitteeMember;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private mailService: MailService = inject(MailService);
  public stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private logger = this.loggerFactory.createLogger("CreateOrAmendSenderComponent", NgxLoggerLevel.ERROR);

  @Input({
    alias: "committeeRoleSender",
    required: true
  }) set committeeRoleSenderValue(senderCommitteeMember: CommitteeMember) {
    this.handleCommitteeRoleSenderChange(senderCommitteeMember);
  }

  @Output() senderExists: EventEmitter<boolean> = new EventEmitter();

  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;

  senderDoesNotExist(): boolean {
    const response = this.senderCommitteeMemberInternal?.email && this.sendersResponse && !this.senderMatchedByEmail();
    this.logger.debug("senderDoesNotExist:senderCommitteeMemberInternal:", this.senderCommitteeMemberInternal, "sendersResponse:", this.sendersResponse, "sender:", this.senderMatchedByEmail());
    return response;
  }

  async ngOnInit() {
    await this.refreshSenders();
    this.logger.info("constructed with sendersResponse:", this.sendersResponse);
    this.notifySenderExists();
  }

  private async refreshSenders() {
    this.sendersResponse = await this.mailService.querySenders();
  }

  async createSender() {
    if (this.senderCommitteeMemberInternal) {
      this.apiRequestPending = true;
      delete this.error;
      const sender: Sender = {
        active: true,
        name: this.senderCommitteeMemberInternal.nameAndDescription,
        email: this.senderCommitteeMemberInternal.email
      };
      this.logger.info("From:", this.senderMatchedByEmail(), "creating sender:", sender);
      this.createSenderResponse = await this.mailService.createSender(sender)
        .catch(error => this.error = error)
        .finally(() => this.apiRequestPending = false);
      this.logger.info("createSenderResponse:", this.createSenderResponse);
      if (this.createSenderResponse.id) {
        await this.refreshSenders();
        this.notifySenderExists();
      } else {
        this.error = {message: "Error creating sender", response: this.createSenderResponse};
      }
    }
  }

  handleCommitteeRoleSenderChange(senderCommitteeMember: CommitteeMember) {
    this.senderCommitteeMemberInternal = senderCommitteeMember;
    this.logger.info("handleSenderChange:senderCommitteeMember:", senderCommitteeMember);
    delete this.createSenderResponse;
    this.notifySenderExists();
  }

  private notifySenderExists() {
    const value = !this.senderDoesNotExist();
    this.logger.info("notifySenderExists:", value, "for:", this.senderCommitteeMemberInternal?.email);
    this.senderExists.emit(value);
  }

  public senderMatchedByEmail(): Sender {
    return this?.sendersResponse?.senders?.find(sender => sender?.email === this.senderCommitteeMemberInternal?.email);
  };
}
