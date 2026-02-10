import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { CreateSenderResponse, Sender, SendersResponse } from "../../../models/mail.model";
import { NonSensitiveCloudflareConfig } from "../../../models/cloudflare-email-routing.model";
import { MailService } from "../../../services/mail/mail.service";
import { CommitteeMember } from "../../../models/committee.model";
import { ALERT_ERROR, ALERT_SUCCESS } from "../../../models/alert-target.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { CloudflareEmailRoutingService } from "../../../services/cloudflare/cloudflare-email-routing.service";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { BrevoButtonComponent } from "../../../modules/common/third-parties/brevo-button";
import { RouterLink } from "@angular/router";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";

@Component({
    selector: "[app-create-or-amend-sender]",
    template: `
    @if (emailOnDomain() && senderMatchedByEmail()) {
      <div class="col-sm-12">
        @if (senderNameMismatch()) {
          <alert type="warning" class="flex-grow-1">
              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
              <strong class="ms-2">Brevo Sender Name Mismatch</strong>
              <ul class="mb-0 mt-1">
                <li>Brevo has: {{ senderMatchedByEmail()?.name }} ({{ senderMatchedByEmail()?.email }})</li>
                <li>Expected: {{ expectedSenderName() }} ({{ senderCommitteeMemberInternal?.email }})</li>
                <li><a routerLink="/admin/mail-settings" [queryParams]="{tab: 'senders'}">See existing Senders</a></li>
              </ul>
            </alert>
          <div class="mt-2">
            <app-brevo-button [disabled]="apiRequestPending" [loading]="apiRequestPending" button
              (click)="updateSenderName()"
            title="Update Sender Name"></app-brevo-button>
          </div>
          @if (error) {
            <div class="d-flex align-items-start">
              <alert type="danger" class="flex-grow-1">
                <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                <strong class="ms-2">Error</strong>
                <span class="ms-2">{{ stringUtilsService.stringify(error) }}</span>
              </alert>
            </div>
          }
        } @else {
          <alert type="success" class="flex-grow-1">
            <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
            <strong class="ms-2">Brevo Sender Created</strong>
            <span class="ms-2">- {{ senderMatchedByEmail()?.name }} ({{ senderCommitteeMemberInternal?.email }}) exists as an outbound sender in Brevo.</span>
          </alert>
        }
      </div>
    }
    @if (emailOnDomain() && senderDoesNotExist()) {
      <div class="col-sm-12">
        <div class="d-flex align-items-start">
          <alert type="warning" class="flex-grow-1">
            <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
            <strong class="ms-2">Brevo Sender Not Yet Created</strong>
            <span class="ms-2">- Click button to create {{ senderCommitteeMemberInternal?.email }}
              as an outbound sender in Brevo. <a routerLink="/admin/mail-settings" [queryParams]="{tab: 'senders'}">See existing Senders</a></span>
          </alert>
          <app-brevo-button class="ms-2 mt-1" [disabled]="!senderCommitteeMemberInternal || apiRequestPending" [loading]="apiRequestPending" button
            (click)="createSender()"
          title="Create Sender"></app-brevo-button>
        </div>
        @if (error) {
          <div class="d-flex align-items-start">
            <alert type="danger" class="flex-grow-1">
              <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
              <strong class="ms-2">Error</strong>
              <span class="ms-2">{{ stringUtilsService.stringify(error) }}</span>
            </alert>
          </div>
        }
      </div>
    }
    @if (this.createSenderResponse?.id) {
      <div class="col-sm-12">
        <div class="d-flex align-items-start">
          <alert type="success" class="flex-grow-1">
            <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
            <strong class="ms-2">New Sender Created</strong>
            <span class="ms-2">- {{ senderCommitteeMemberInternal?.fullName }} was added to Brevo as a sender. <a routerLink="/admin/mail-settings" [queryParams]="{tab: 'senders'}">See existing Senders</a></span>
          </alert>
        </div>
      </div>
    }`,
    imports: [AlertComponent, FontAwesomeModule, BrevoButtonComponent, RouterLink]
})

export class CreateOrAmendSenderComponent implements OnInit, OnDestroy {

  public error: any;
  public apiRequestPending: boolean;
  public createSenderResponse: CreateSenderResponse;
  public sendersResponse: SendersResponse;
  protected senderCommitteeMemberInternal: CommitteeMember;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private mailService: MailService = inject(MailService);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private committeeConfigService: CommitteeConfigService = inject(CommitteeConfigService);
  public stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private logger = this.loggerFactory.createLogger("CreateOrAmendSenderComponent", NgxLoggerLevel.ERROR);
  baseDomain = "";
  private subscriptions: Subscription[] = [];

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

  expectedSenderName(): string {
    if (!this.senderCommitteeMemberInternal) {
      return null;
    }
    return this.committeeConfigService.nameAndDescriptionFrom(this.senderCommitteeMemberInternal);
  }

  async ngOnInit() {
    this.subscriptions.push(
      this.cloudflareEmailRoutingService.cloudflareConfigNotifications().subscribe((config: NonSensitiveCloudflareConfig) => {
        this.logger.info("cloudflareConfigNotifications config:", config);
        this.baseDomain = config?.baseDomain || "";
      })
    );
    await this.refreshSenders();
    this.logger.info("constructed with sendersResponse:", this.sendersResponse);
    this.notifySenderExists();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  emailOnDomain(): boolean {
    return this.senderCommitteeMemberInternal?.email?.endsWith(`@${this.baseDomain}`);
  }

  private async refreshSenders() {
    this.sendersResponse = await this.mailService.querySenders();
  }

  async createSender() {
    if (!this.emailOnDomain()) {
      this.error = {message: `Sender email must end with @${this.baseDomain}`};
      return;
    }
    if (this.senderCommitteeMemberInternal) {
      this.apiRequestPending = true;
      delete this.error;
      const sender: Sender = {
        active: true,
        name: this.expectedSenderName(),
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
  }

  senderNameMismatch(): boolean {
    const matchedSender = this.senderMatchedByEmail();
    const expected = this.expectedSenderName();
    return matchedSender && expected && matchedSender.name !== expected;
  }

  async updateSenderName() {
    const matchedSender = this.senderMatchedByEmail();
    const expected = this.expectedSenderName();
    if (matchedSender?.id && expected) {
      this.apiRequestPending = true;
      delete this.error;
      const updatedSender: Sender = {
        active: matchedSender.active,
        name: expected,
        email: matchedSender.email
      };
      this.logger.info("updateSenderName: from:", matchedSender.name, "to:", updatedSender.name);
      await this.mailService.updateSender(matchedSender.id, updatedSender)
        .catch(error => this.error = error)
        .finally(() => this.apiRequestPending = false);
      if (!this.error) {
        await this.refreshSenders();
      }
    }
  }
}
