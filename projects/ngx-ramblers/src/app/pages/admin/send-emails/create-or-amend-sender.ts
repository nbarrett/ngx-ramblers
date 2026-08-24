import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { CreateSenderResponse, Sender, SendersResponse } from "../../../models/mail.model";
import { NonSensitiveCloudflareConfig } from "../../../models/cloudflare-email-routing.model";
import { MailService } from "../../../services/mail/mail.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { CommitteeMember, roleEmailAddresses } from "../../../models/committee.model";
import { ALERT_ERROR, ALERT_SUCCESS } from "../../../models/alert-target.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { CloudflareEmailRoutingService } from "../../../services/cloudflare/cloudflare-email-routing.service";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronUp, faList } from "@fortawesome/free-solid-svg-icons";
import { BrevoButtonComponent } from "../../../modules/common/third-parties/brevo-button";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { MailSendersListComponent } from "../system-settings/mail/mail-senders-list";

@Component({
    selector: "[app-create-or-amend-sender]",
    styles: [`
    .sender-action-buttons
      display: grid
      gap: 0.5rem
      justify-items: stretch
    .sender-action-buttons ::ng-deep app-brevo-button,
    .sender-action-buttons ::ng-deep app-brevo-button .brevo-dropdown,
    .sender-action-buttons ::ng-deep app-brevo-button .btn
      width: 100%
      display: flex
    `],
    template: `
    <ng-template #viewSendersButton>
      <button type="button" class="btn btn-quiet d-flex align-items-center justify-content-center gap-2 w-100" (click)="toggleAllSenders()">
        <fa-icon [icon]="showingSenders ? faChevronUp : faList"/>
        {{ showingSenders ? "Hide senders" : "View senders" }}
      </button>
    </ng-template>
    @if (emailOnDomain() && matchedSenders().length > 0 && missingSenderAddresses().length === 0) {
      <div class="col-sm-12">
        <div class="d-flex align-items-start gap-2">
          <div class="flex-grow-1">
            @if (sendersWithNameMismatch().length > 0) {
              <alert type="warning" class="flex-grow-1 mb-0">
                  <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                  <strong class="ms-2">Brevo Sender Name Mismatch</strong>
                  <ul class="mb-0 mt-1">
                    @for (sender of sendersWithNameMismatch(); track sender.id ?? $index) {
                      <li>Brevo has: {{ sender.name }} ({{ sender.email }}) - expected {{ expectedSenderName() }}</li>
                    }
                  </ul>
                </alert>
              <div class="mt-2">
                <app-brevo-button [disabled]="apiRequestPending" [loading]="apiRequestPending" button
                  (click)="updateSenderNames()"
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
              @if (duplicateSenderAddresses().length > 0) {
                <alert type="warning" class="flex-grow-1 mb-0">
                  <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
                  <strong class="ms-2">Duplicate Brevo senders</strong>
                  <span class="ms-2">More than one sender is registered for the same address. Delete the extra in the list below and keep the one named {{ expectedSenderName() }}.</span>
                  <ul class="mb-0 mt-1">
                    @for (address of duplicateSenderAddresses(); track address) {
                      <li>{{ address }}</li>
                    }
                  </ul>
                </alert>
              } @else {
                <alert type="success" class="flex-grow-1 mb-0">
                  <fa-icon [icon]="ALERT_SUCCESS.icon"></fa-icon>
                  <strong class="ms-2">Brevo senders created</strong>
                  <span class="ms-2">{{ expectedSenderName() }} is registered in Brevo as {{ matchedSenderEmails() }}</span>
                </alert>
              }
            }
          </div>
          <div class="sender-action-buttons flex-shrink-0">
            <ng-container *ngTemplateOutlet="viewSendersButton"/>
          </div>
        </div>
      </div>
    }
    @if (emailOnDomain() && missingSenderAddresses().length > 0) {
      <div class="col-sm-12">
        <div class="d-flex align-items-start gap-2">
          <alert type="warning" class="flex-grow-1 mb-0">
            <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
            <strong class="ms-2">Brevo senders not yet created</strong>
            <span class="ms-2">These role addresses are not registered as outbound senders in Brevo:</span>
            <ul class="mb-1 mt-1">
              @for (address of missingSenderAddresses(); track address) {
                <li>{{ address }}</li>
              }
            </ul>
          </alert>
          <div class="sender-action-buttons flex-shrink-0">
            <app-brevo-button class="w-100" [disabled]="!senderCommitteeMemberInternal || apiRequestPending" [loading]="apiRequestPending" button
              (click)="createSenders()"
            title="Create Senders"></app-brevo-button>
            <ng-container *ngTemplateOutlet="viewSendersButton"/>
          </div>
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
    @if (!emailOnDomain() || (matchedSenders().length === 0 && missingSenderAddresses().length === 0)) {
      <div class="col-sm-12 mt-2">
        <ng-container *ngTemplateOutlet="viewSendersButton"/>
      </div>
    }
    @if (showingSenders) {
      <div class="col-sm-12">
        <app-mail-senders-list embedded
          [highlightEmails]="roleMailboxAddresses"
          [editingRoleType]="senderCommitteeMemberInternal?.type"
          (sendersChanged)="onSendersChanged($event)"/>
      </div>
    }`,
    imports: [AlertComponent, FontAwesomeModule, BrevoButtonComponent, NgTemplateOutlet, MailSendersListComponent]
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
  private mailMessagingService = inject(MailMessagingService);
  private logger = this.loggerFactory.createLogger("CreateOrAmendSenderComponent", NgxLoggerLevel.ERROR);
  baseDomain = "";
  private subscriptions: Subscription[] = [];
  @ViewChild(MailSendersListComponent) private sendersList: MailSendersListComponent;

  @Input({
    alias: "committeeRoleSender",
    required: true
  }) set committeeRoleSenderValue(senderCommitteeMember: CommitteeMember) {
    this.handleCommitteeRoleSenderChange(senderCommitteeMember);
  }

  @Input() set mailboxAddresses(value: string[]) {
    this.mailboxListFromParent = true;
    this.roleMailboxAddresses = value ?? [];
    this.notifySenderExists();
  }

  @Output() senderExists: EventEmitter<boolean> = new EventEmitter();

  showingSenders = false;
  roleMailboxAddresses: string[] = [];
  private mailboxListFromParent = false;
  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;
  protected readonly faChevronUp = faChevronUp;
  protected readonly faList = faList;

  toggleAllSenders() {
    this.showingSenders = !this.showingSenders;
    if (this.showingSenders) {
      void this.refreshSenders();
    }
  }

  roleAddresses(): string[] {
    if (this.mailboxListFromParent) {
      return this.roleMailboxAddresses;
    } else {
      return this.computedRoleAddresses();
    }
  }

  private computedRoleAddresses(): string[] {
    const role = this.senderCommitteeMemberInternal;
    return role
      ? roleEmailAddresses(role, this.baseDomain).filter(address => !this.baseDomain || address.toLowerCase().endsWith(`@${this.baseDomain.toLowerCase()}`))
      : [];
  }

  private refreshRoleMailboxAddresses() {
    if (!this.mailboxListFromParent) {
      this.roleMailboxAddresses = this.computedRoleAddresses();
    }
  }

  matchedSenders(): Sender[] {
    return this.roleAddresses()
      .map(address => this.senderMatchedByEmail(address))
      .filter((sender): sender is Sender => Boolean(sender));
  }

  matchedSenderEmails(): string {
    return this.matchedSenders().map(sender => sender.email).join(", ");
  }

  missingSenderAddresses(): string[] {
    return this.sendersResponse
      ? this.roleAddresses().filter(address => !this.senderMatchedByEmail(address))
      : [];
  }

  senderDoesNotExist(): boolean {
    const primaryEmail = this.senderCommitteeMemberInternal?.email;
    return Boolean(primaryEmail && this.sendersResponse && !this.senderMatchedByEmail(primaryEmail));
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
        this.refreshRoleMailboxAddresses();
      })
    );
    if (this.mailMessagingService.brevoAccountConfigured()) {
      await this.refreshSenders();
      this.logger.info("constructed with sendersResponse:", this.sendersResponse);
      this.notifySenderExists();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  emailOnDomain(): boolean {
    return this.senderCommitteeMemberInternal?.email?.endsWith(`@${this.baseDomain}`);
  }

  private async refreshSenders() {
    this.sendersResponse = await this.mailService.querySenders();
    if (this.sendersList) {
      await this.sendersList.reload();
    }
  }

  async createSenders() {
    if (!this.emailOnDomain()) {
      this.error = {message: `Sender email must end with @${this.baseDomain}`};
      return;
    }
    if (this.senderCommitteeMemberInternal) {
      this.apiRequestPending = true;
      delete this.error;
      const name = this.expectedSenderName();
      const addresses = this.missingSenderAddresses();
      this.logger.info("creating senders for addresses:", addresses);
      await addresses.reduce<Promise<void>>(async (previous, address) => {
        await previous;
        if (!this.error) {
          const sender: Sender = {active: true, name, email: address};
          this.createSenderResponse = await this.mailService.createSender(sender)
            .catch(error => this.error = error);
          if (!this.createSenderResponse?.id && !this.error) {
            this.error = {message: `Error creating sender ${address}`, response: this.createSenderResponse};
          }
        }
      }, Promise.resolve());
      this.apiRequestPending = false;
      await this.refreshSenders();
      this.notifySenderExists();
    }
  }

  handleCommitteeRoleSenderChange(senderCommitteeMember: CommitteeMember) {
    this.senderCommitteeMemberInternal = senderCommitteeMember;
    this.logger.info("handleSenderChange:senderCommitteeMember:", senderCommitteeMember);
    delete this.createSenderResponse;
    this.refreshRoleMailboxAddresses();
    this.notifySenderExists();
  }

  private notifySenderExists() {
    const value = !this.senderDoesNotExist();
    this.logger.info("notifySenderExists:", value, "for:", this.senderCommitteeMemberInternal?.email);
    this.senderExists.emit(value);
  }

  public senderMatchedByEmail(email: string): Sender {
    const wanted = (email ?? "").toLowerCase();
    return this?.sendersResponse?.senders?.find(sender => sender?.email?.toLowerCase() === wanted);
  }

  sendersWithNameMismatch(): Sender[] {
    const expected = this.expectedSenderName();
    return expected ? this.matchedSenders().filter(sender => sender.name !== expected) : [];
  }

  duplicateSenderAddresses(): string[] {
    const senders = this.sendersResponse?.senders ?? [];
    return this.roleAddresses().filter(address =>
      senders.filter(sender => (sender.email ?? "").toLowerCase() === address.toLowerCase()).length > 1);
  }

  onSendersChanged(senders: Sender[]) {
    this.sendersResponse = {senders};
    this.notifySenderExists();
  }

  async updateSenderNames() {
    const expected = this.expectedSenderName();
    const mismatched = this.sendersWithNameMismatch().filter(sender => Boolean(sender.id));
    if (expected && mismatched.length > 0) {
      this.apiRequestPending = true;
      delete this.error;
      await mismatched.reduce<Promise<void>>(async (previous, matchedSender) => {
        await previous;
        if (!this.error) {
          const updatedSender: Sender = {
            active: matchedSender.active,
            name: expected,
            email: matchedSender.email
          };
          this.logger.info("updateSenderNames: from:", matchedSender.name, "to:", updatedSender.name);
          await this.mailService.updateSender(matchedSender.id, updatedSender)
            .catch(error => this.error = error);
        }
      }, Promise.resolve());
      this.apiRequestPending = false;
      if (!this.error) {
        await this.refreshSenders();
      }
    }
  }
}
