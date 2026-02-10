import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import {
  BuiltInRole,
  CommitteeMember,
  CommitteeRecipientOption,
  EmailDerivation,
  ForwardEmailTarget,
  RoleType
} from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import {
  DestinationAddress,
  DestinationVerificationStatus,
  EmailRouteType,
  EmailRoutingActionType,
  EmailRoutingMatcherField,
  EmailRoutingMatcherType,
  EmailRoutingRule,
  EmailWorkerScript,
  NonSensitiveCloudflareConfig
} from "../../../../models/cloudflare-email-routing.model";
import { FullNamePipe } from "../../../../pipes/full-name.pipe";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { enumKeyValues, KeyValue } from "../../../../functions/enums";
import { normaliseEmail, toDotCase, validEmail } from "../../../../functions/strings";
import { sortBy } from "../../../../functions/arrays";
import { NgSelectComponent } from "@ng-select/ng-select";
import { CommitteeConfigService } from "../../../../services/committee/commitee-config.service";
import { MemberNamingService } from "projects/ngx-ramblers/src/app/services/member/member-naming.service";
import { UrlService } from "../../../../services/url.service";
import { StoredValue } from "../../../../models/ui-actions";
import { FormsModule } from "@angular/forms";
import { CommitteeMemberLookupComponent } from "./committee-member-lookup";
import { CreateOrAmendSenderComponent } from "../../send-emails/create-or-amend-sender";
import { EmailRoutingStatusComponent } from "./email-routing-status";
import { EmailRoutingLogComponent } from "./email-routing-log";
import { CopyIconComponent } from "../../../../modules/common/copy-icon/copy-icon";
import { MarkdownComponent } from "ngx-markdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgTemplateOutlet } from "@angular/common";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";

export enum CommitteeMemberTab {
  ROLE_DETAILS = "Role Details",
  OUTBOUND_EMAIL = "Outbound Email",
  INBOUND_FORWARDING = "Inbound Forwarding",
  CONTACT_US = "Contact Us",
  EMAIL_LOGS = "Email Logs"
}

@Component({
    selector: "app-committee-member",
    template: `
    @if (committeeMember) {
      <div class="p-2 pt-0">
        <ng-template #forwardTargetControls let-label="label">
          @if (committeeMember.forwardEmailTarget === ForwardEmailTarget.CUSTOM) {
            <div class="col-sm-12">
              <div class="row">
                <div class="col-sm-6">
                  <div class="form-group">
                    <label for="forward-target-{{index}}" class="control-label">{{ label }}</label>
                    <select class="form-control input-sm"
                      [(ngModel)]="committeeMember.forwardEmailTarget"
                      (ngModelChange)="forwardTargetChanged()"
                      [disabled]="committeeMember.vacant"
                      id="forward-target-{{index}}">
                      @for (target of forwardTargets; track target.value) {
                        <option [ngValue]="target.value">{{ forwardTargetLabel(target.value) }}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="form-group">
                    <label for="forward-custom-email-{{index}}" class="control-label">Custom email address</label>
                    <input [(ngModel)]="committeeMember.forwardEmailCustom"
                      [disabled]="committeeMember.vacant"
                      id="forward-custom-email-{{index}}"
                      [class.is-invalid]="committeeMember.forwardEmailCustom && !validEmail(committeeMember.forwardEmailCustom)"
                      type="email" class="form-control">
                    @if (committeeMember.forwardEmailCustom && !validEmail(committeeMember.forwardEmailCustom)) {
                      <div class="invalid-feedback d-block">
                        Please enter a valid email address
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          } @else {
            <div class="col-sm-12">
              <div class="form-group">
                <label for="forward-target-{{index}}" class="control-label">{{ label }}</label>
                <select class="form-control input-sm"
                  [(ngModel)]="committeeMember.forwardEmailTarget"
                  (ngModelChange)="forwardTargetChanged()"
                  [disabled]="committeeMember.vacant"
                  id="forward-target-{{index}}">
                  @for (target of forwardTargets; track target.value) {
                    <option [ngValue]="target.value">{{ forwardTargetLabel(target.value) }}</option>
                  }
                </select>
              </div>
            </div>
          }
          @if (committeeMember.forwardEmailTarget === ForwardEmailTarget.MULTIPLE) {
            @if (!committeeMember.forwardEmailRecipients?.length && importableWorkerName()) {
              <div class="col-sm-12 mt-2">
                <div class="alert alert-warning d-flex align-items-center justify-content-between">
                  <span>An existing Cloudflare Worker <strong>{{ importableWorkerName() }}</strong> was found. You can import its recipients.</span>
                  <button class="btn btn-primary btn-sm ms-3"
                    [disabled]="importingRecipients"
                    (click)="importRecipientsFromWorker()">
                    @if (importingRecipients) {
                      Importing...
                    } @else {
                      Import Recipients
                    }
                  </button>
                </div>
              </div>
            }
            <div class="col-sm-12 mt-2">
              <label class="control-label">Recipients</label>
              <ng-select
                [items]="recipientEmailOptions"
                [searchable]="true"
                [clearable]="true"
                [editableSearchTerm]="true"
                [addTag]="tagRecipientEmail"
                [multiple]="true"
                [closeOnSelect]="true"
                dropdownPosition="bottom"
                [placeholder]="'Select one or more recipients'"
                class="recipient-select"
                bindLabel="label"
                bindValue="email"
                (open)="refreshRecipientEmailOptions()"
                id="new-recipient-{{index}}"
                [(ngModel)]="committeeMember.forwardEmailRecipients"
                (ngModelChange)="recipientsChanged($event)">
              </ng-select>
            </div>
          }
        </ng-template>
        <app-section-toggle
          [tabs]="tabs"
          [(selectedTab)]="selectedTab"
          [queryParamKey]="StoredValue.SUB_TAB"
          [fullWidth]="true"/>
        @switch (selectedTab) {
          @case (CommitteeMemberTab.ROLE_DETAILS) {
            <app-markdown-editor standalone category="admin" name="committee-role-details-help" description="Role details help"/>
            <hr/>
            <div class="row">
              <div class="col-sm-6">
                <app-committee-member-lookup [disabled]="committeeMember.vacant" [committeeMember]="committeeMember"
                  (memberChange)="setOtherMemberFields($event)"/>
              </div>
              <div class="col-sm-6">
                <div class="form-group">
                  <label for="committee-member-fullName-{{index}}"
                  class="control-label">Full Name</label>
                  <input [(ngModel)]="committeeMember.fullName" [disabled]="committeeMember.vacant"
                    (ngModelChange)="changeNameAndDescription()"
                    id="committee-member-fullName-{{index}}"
                         type="text" class="form-control">
                </div>
              </div>
            </div>
            <div class="row mt-3">
              <div class="col-sm-12">
                <div class="form-group">
                  <label for="committee-member-description-{{index}}"
                         class="control-label">Role Description</label>
                  <input [(ngModel)]="committeeMember.description" (ngModelChange)="changeDescription()"
                         id="committee-member-description-{{index}}"
                    type="text" class="form-control">
                </div>
              </div>
            </div>
            <div class="row mt-3">
              <div class="col-sm-3">
                <div class="form-group">
                  <label for="role-type-{{index}}">Role Type</label>
                  <select class="form-control input-sm"
                    [(ngModel)]="committeeMember.roleType"
                    id="role-type-{{index}}">
                    @for (type of roleTypes; track type.value) {
                      <option
                        [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                      </option>
                    }
                  </select>
                </div>
              </div>
              <div class="col-sm-4">
                <div class="form-group">
                  <label for="built-in-role-{{index}}">Maps to Built-in Role</label>
                  <select class="form-control input-sm"
                    [(ngModel)]="committeeMember.builtInRoleMapping"
                    id="built-in-role-{{index}}">
                    @for (type of builtInRoles; track type.value) {
                      <option
                        [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                      </option>
                    }
                  </select>
                </div>
              </div>
              <div class="col-sm-2 ms-auto">
                <div class="form-group">
                  <label for="committee-member-vacant-{{index}}" class="control-label">
                    Role is vacant
                  </label>
                  <div class="form-check">
                    <input type="checkbox" class="form-check-input"
                      [(ngModel)]="committeeMember.vacant"
                      (ngModelChange)="roleChange()"
                      id="committee-member-vacant-{{index}}">
                  </div>
                </div>
              </div>
            </div>
          }
          @case (CommitteeMemberTab.OUTBOUND_EMAIL) {
            <app-markdown-editor standalone category="admin" name="committee-outbound-email-help" description="Outbound email help"/>
            <hr/>
            <div class="row">
              <div class="col d-flex align-items-end flex-wrap gap-3">
                <div class="d-flex align-items-center gap-3">
                  <label class="control-label mb-0">Derive sender email address from</label>
                  <div class="form-check form-check-inline mb-0">
                    <input class="form-check-input" type="radio" [value]="EmailDerivation.ROLE"
                      [(ngModel)]="committeeMember.emailDerivation"
                      (ngModelChange)="deriveRoleEmail()"
                      id="email-derivation-role-{{index}}">
                    <label class="form-check-label" for="email-derivation-role-{{index}}">Role</label>
                  </div>
                  <div class="form-check form-check-inline mb-0">
                    <input class="form-check-input" type="radio" [value]="EmailDerivation.FULL_NAME"
                      [(ngModel)]="committeeMember.emailDerivation"
                      (ngModelChange)="deriveRoleEmail()"
                      id="email-derivation-name-{{index}}">
                    <label class="form-check-label" for="email-derivation-name-{{index}}">Full Name</label>
                  </div>
                </div>
                <div class="form-group mb-0 flex-grow-1">
                  <label for="committee-member-email-{{index}}"
                  class="control-label">Sender Email</label>
                  <input [(ngModel)]="committeeMember.email" [disabled]="committeeMember.vacant"
                    (ngModelChange)="syncEmailDerivationFromEmail()"
                    id="committee-member-email-{{index}}"
                    [class.is-invalid]="committeeMember.email && !emailOnDomain()"
                    type="text" class="form-control">
                  @if (committeeMember.email && !emailOnDomain()) {
                    <div class="invalid-feedback d-block">
                      Sender email must end with {{ '@' + baseDomain }}
                      &mdash; <a style="cursor: pointer; font-size: 0.85em" (click)="deriveRoleEmail()">fix it for me</a>
                    </div>
                  }
                </div>
              </div>
              <div class="col-sm-12 mt-3" app-create-or-amend-sender [committeeRoleSender]="committeeMember"></div>
            </div>
          }
          @case (CommitteeMemberTab.INBOUND_FORWARDING) {
            <app-markdown-editor standalone category="admin" name="committee-inbound-forwarding-help" description="Inbound forwarding help"/>
            <hr/>
            <div class="row">
              <ng-container *ngTemplateOutlet="forwardTargetControls; context: {label: 'Forward incoming emails to'}"></ng-container>
              <div class="col-sm-12 mt-3" app-email-routing-status
                [committeeMember]="committeeMember"
                [memberEmail]="resolvedForwardEmail()"
                [memberEmails]="resolvedForwardEmails()"
                [forceMultiRecipient]="committeeMember.forwardEmailTarget === ForwardEmailTarget.MULTIPLE"></div>
            </div>
          }
          @case (CommitteeMemberTab.CONTACT_US) {
            <app-markdown-editor standalone category="admin" name="committee-contact-us-help" description="Contact Us help"/>
            <hr/>
            <div class="row">
              <ng-container *ngTemplateOutlet="forwardTargetControls; context: {label: 'Send Contact Us emails to'}"></ng-container>
              @if (committeeMember.forwardEmailTarget === ForwardEmailTarget.MULTIPLE) {
                <div class="col-sm-12 mt-3" app-email-routing-status
                  [committeeMember]="committeeMember"
                  [memberEmails]="committeeMember.forwardEmailRecipients || []"
                  [forceMultiRecipient]="committeeMember.forwardEmailTarget === ForwardEmailTarget.MULTIPLE"></div>
              }
              <div class="col-sm-12 mt-3">
                <h6 class="section-heading">Contact Link</h6>
                <div class="row">
                  <div class="col-sm-6">
                    <label class="control-label">Markdown</label>
                    <div class="d-flex align-items-center">
                      <code class="me-2">{{ markdownLink(committeeMember) }}</code>
                      <app-copy-icon title [value]="markdownLink(committeeMember)"
                        elementName="markdown link"/>
                    </div>
                  </div>
                  <div class="col-sm-6">
                    <label class="control-label">Preview</label>
                    <div>
                      <span class="as-button" markdown>{{ markdownLink(committeeMember) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
          @case (CommitteeMemberTab.EMAIL_LOGS) {
            <app-markdown-editor standalone category="admin" name="committee-email-logs-help" description="Email logs help"/>
            <hr/>
            <app-email-routing-log
              [roleEmail]="roleEmail()"
              [workerScriptName]="activeWorkerScriptName()"
              [routeType]="activeRouteType()"/>
          }
        }
      </div>
    }
    `,
    styleUrls: ["./committee-member.sass"],
  imports: [FormsModule, FontAwesomeModule, CommitteeMemberLookupComponent, CreateOrAmendSenderComponent, EmailRoutingStatusComponent, EmailRoutingLogComponent, CopyIconComponent, MarkdownComponent, MarkdownEditorComponent, SectionToggle, NgSelectComponent, NgTemplateOutlet]
})
export class CommitteeMemberEditor implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeMemberEditor", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  private fullNamePipe = inject(FullNamePipe);
  private urlService = inject(UrlService);
  private memberNamingService = inject(MemberNamingService);
  private committeeConfigService = inject(CommitteeConfigService);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private committeeQueryService = inject(CommitteeQueryService);
  public committeeMember: CommitteeMember;
  protected readonly CommitteeMemberTab = CommitteeMemberTab;
  protected readonly StoredValue = StoredValue;
  selectedTab: CommitteeMemberTab = CommitteeMemberTab.ROLE_DETAILS;
  private emailRoutingRules: EmailRoutingRule[] = [];

  get tabs(): CommitteeMemberTab[] {
    const baseTabs = [
      CommitteeMemberTab.ROLE_DETAILS,
      CommitteeMemberTab.OUTBOUND_EMAIL,
      CommitteeMemberTab.INBOUND_FORWARDING,
      CommitteeMemberTab.CONTACT_US
    ];
    if (this.cloudflareEmailRoutingService.emailForwardingAvailable()) {
      return [...baseTabs, CommitteeMemberTab.EMAIL_LOGS];
    }
    return baseTabs;
  }

  @Input("committeeMember") set committeeMemberValue(committeeMember: CommitteeMember) {
    this.committeeMember = committeeMember;
    if (this.committeeMember && !this.committeeMember.emailDerivation) {
      this.committeeMember.emailDerivation = EmailDerivation.ROLE;
    }
    this.syncEmailDerivationFromEmail();
  }
  @Input() roles!: CommitteeMember[];
  @Input() index!: number;
  roleTypes: KeyValue<string>[] = enumKeyValues(RoleType);
  builtInRoles: KeyValue<string>[] = enumKeyValues(BuiltInRole);
  protected readonly RoleType = RoleType;
  protected readonly ForwardEmailTarget = ForwardEmailTarget;
  protected readonly EmailDerivation = EmailDerivation;
  baseDomain = "";
  private subscriptions: Subscription[] = [];
  recipientEmailOptions: CommitteeRecipientOption[] = [];
  private destinationAddresses: DestinationAddress[] = [];
  private workers: EmailWorkerScript[] = [];
  private catchAllRule: EmailRoutingRule = null;
  importingRecipients = false;
  private recipientRegistrations = new Set<string>();
  forwardTargets = [
    {value: ForwardEmailTarget.MEMBER_EMAIL, label: "Member's personal email"},
    {value: ForwardEmailTarget.CUSTOM, label: "Custom address"},
    {value: ForwardEmailTarget.MULTIPLE, label: "Multiple recipients"},
    {value: ForwardEmailTarget.NONE, label: "No forwarding"}
  ];

  ngOnInit() {
    this.logger.info("ngOnInit", this.committeeMember);
    if (!this.committeeMember.forwardEmailTarget) {
      this.committeeMember.forwardEmailTarget = ForwardEmailTarget.MEMBER_EMAIL;
    }
    this.refreshRecipientEmailOptions();
    this.subscriptions.push(
      this.cloudflareEmailRoutingService.cloudflareConfigNotifications().subscribe((config: NonSensitiveCloudflareConfig) => {
        this.baseDomain = config?.baseDomain || "";
        this.syncEmailDerivationFromEmail();
      })
    );
    this.subscriptions.push(
      this.cloudflareEmailRoutingService.destinationAddressesNotifications().subscribe((addresses: DestinationAddress[]) => {
        this.destinationAddresses = addresses || [];
      })
    );
    this.subscriptions.push(
      this.cloudflareEmailRoutingService.workersNotifications().subscribe((workers: EmailWorkerScript[]) => {
        this.workers = workers || [];
      })
    );
    this.subscriptions.push(
      this.cloudflareEmailRoutingService.catchAllNotifications().subscribe((rule: EmailRoutingRule) => {
        this.catchAllRule = rule;
      })
    );
    this.subscriptions.push(
      this.cloudflareEmailRoutingService.rulesNotifications().subscribe((rules: EmailRoutingRule[]) => {
        this.emailRoutingRules = rules || [];
      })
    );
    this.cloudflareEmailRoutingService.queryDestinationAddresses();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  setOtherMemberFields(member: Member) {
    this.logger.debug("setOtherMemberFields:", member);
    this.committeeMember.fullName = this.fullNamePipe.transform(member);
    this.deriveRoleEmail();
    this.changeNameAndDescription();
  }

  roleChange() {
    if (this.committeeMember.vacant) {
      this.committeeMember.memberId = null;
      this.committeeMember.fullName = null;
      this.committeeMember.email = null;
    }
  }

  changeDescription() {
    this.committeeMember.type = this.stringUtils.kebabCase(this.committeeMember.description);
    this.deriveRoleEmail();
    this.changeNameAndDescription();
    this.syncEmailDerivationFromEmail();
  }

  changeNameAndDescription() {
    this.committeeMember.nameAndDescription = this.committeeConfigService.nameAndDescriptionFrom(this.committeeMember);
  }

  deriveRoleEmail() {
    const localPart = this.committeeMember.emailDerivation === EmailDerivation.FULL_NAME
      ? toDotCase(this.committeeMember.fullName)
      : this.committeeMember.type;
    if (localPart) {
      this.committeeMember.email = `${localPart}@${this.baseDomain}`;
    }
  }

  syncEmailDerivationFromEmail() {
    if (!this.committeeMember?.email || !this.emailOnDomain()) {
      return;
    }
    const emailLocalPart = this.committeeMember.email.split("@")[0]?.toLowerCase() || "";
    const roleLocalPart = (this.committeeMember.type || "").toLowerCase();
    const nameLocalPart = toDotCase(this.committeeMember.fullName).toLowerCase();
    if (emailLocalPart && roleLocalPart && emailLocalPart === roleLocalPart) {
      this.committeeMember.emailDerivation = EmailDerivation.ROLE;
    } else if (emailLocalPart && nameLocalPart && emailLocalPart === nameLocalPart) {
      this.committeeMember.emailDerivation = EmailDerivation.FULL_NAME;
    }
  }

  emailOnDomain(): boolean {
    return !this.baseDomain || this.committeeMember.email?.endsWith(`@${this.baseDomain}`);
  }

  protected readonly validEmail = validEmail;

  memberPersonalEmail(): string {
    if (!this.committeeMember.memberId) {
      return null;
    }
    const member = this.committeeQueryService.committeeMembers.find(m => m.id === this.committeeMember.memberId);
    return member?.email || null;
  }


  refreshRecipientEmailOptions(): void {
    const options = this.committeeQueryService.committeeMembers
      .map(member => this.recipientOptionFor(member))
      .filter((option): option is CommitteeRecipientOption => !!option);
    const selectedRecipients = this.committeeMember?.forwardEmailRecipients || [];
    const selectedOptions = selectedRecipients
      .filter(email => email)
      .map(email => this.tagRecipientEmail(email));
    this.recipientEmailOptions = options
      .concat(selectedOptions)
      .reduce((acc, option) => {
        const optionEmail = normaliseEmail(option.email);
        const exists = acc.find(item => normaliseEmail(item.email) === optionEmail);
        return exists ? acc : [...acc, option];
      }, [])
      .sort(sortBy("label"));
  }

  tagRecipientEmail = (value: string): CommitteeRecipientOption | null => {
    if (!validEmail(value)) {
      return null;
    }
    return {label: value, email: value};
  };

  private recipientOptionFor(member: Member): CommitteeRecipientOption | null {
    if (!member?.email) {
      return null;
    }
    return {
      email: member.email,
      label: `${this.fullNamePipe.transform(member)} — ${member.email}`
    };
  }

  recipientLabel(email: string): string {
    if (!email) {
      return "";
    }
    const match = this.recipientEmailOptions.find(option => option.email === email);
    return match?.label || email;
  }


  recipientStatusLabel(email: string): string {
    const status = this.recipientStatus(email);
    if (status === DestinationVerificationStatus.VERIFIED) {
      return "Verified";
    } else if (status === DestinationVerificationStatus.PENDING) {
      return "Pending";
    } else {
      return "Not Registered";
    }
  }

  recipientStatusBadgeClass(email: string): string {
    const status = this.recipientStatus(email);
    if (status === DestinationVerificationStatus.VERIFIED) {
      return "text-style-sunset";
    } else {
      return "bg-warning";
    }
  }

  private recipientStatus(email: string): DestinationVerificationStatus {
    const matchedAddress = this.destinationAddresses.find(addr => normaliseEmail(addr.email) === normaliseEmail(email));
    if (!matchedAddress) {
      return DestinationVerificationStatus.NOT_REGISTERED;
    }
    return matchedAddress.verified ? DestinationVerificationStatus.VERIFIED : DestinationVerificationStatus.PENDING;
  }


  recipientsChanged(recipients: string[]) {
    this.refreshRecipientEmailOptions();
    this.committeeMember.forwardEmailRecipients = [...(recipients || [])];
    const normalisedRecipients = (recipients || [])
      .map(email => normaliseEmail(email))
      .filter(email => email);
    this.ensureDestinationAddresses(normalisedRecipients.filter(email => validEmail(email)));
  }

  private async ensureDestinationAddresses(recipients: string[]) {
    const existingEmails = new Set(this.destinationAddresses.map(addr => normaliseEmail(addr.email)));
    const pending = this.recipientRegistrations;
    const toRegister = recipients
      .filter(email => !existingEmails.has(normaliseEmail(email)))
      .filter(email => !pending.has(email));
    await Promise.all(toRegister.map(email => this.registerRecipient(email)));
    await this.cloudflareEmailRoutingService.queryDestinationAddresses();
  }

  private async registerRecipient(email: string) {
    const normalised = normaliseEmail(email);
    this.recipientRegistrations.add(normalised);
    try {
      await this.cloudflareEmailRoutingService.createDestinationAddress(normalised);
    } catch (err) {
      this.logger.error("Failed to register destination address:", err);
    } finally {
      this.recipientRegistrations.delete(normalised);
    }
  }

  resolvedForwardEmail(): string {
    switch (this.committeeMember.forwardEmailTarget) {
      case ForwardEmailTarget.MEMBER_EMAIL:
        return this.memberPersonalEmail();
      case ForwardEmailTarget.CUSTOM:
        return this.committeeMember.forwardEmailCustom || null;
      case ForwardEmailTarget.MULTIPLE:
        return this.committeeMember.forwardEmailRecipients?.[0] || null;
      case ForwardEmailTarget.NONE:
        return null;
      default:
        return this.memberPersonalEmail();
    }
  }

  resolvedForwardEmails(): string[] {
    switch (this.committeeMember.forwardEmailTarget) {
      case ForwardEmailTarget.MEMBER_EMAIL: {
        const email = this.memberPersonalEmail();
        return email ? [email] : [];
      }
      case ForwardEmailTarget.CUSTOM: {
        const custom = this.committeeMember.forwardEmailCustom;
        return custom ? [custom] : [];
      }
      case ForwardEmailTarget.MULTIPLE:
        return this.committeeMember.forwardEmailRecipients || [];
      case ForwardEmailTarget.NONE:
        return [];
      default: {
        const defaultEmail = this.memberPersonalEmail();
        return defaultEmail ? [defaultEmail] : [];
      }
    }
  }

  forwardTargetLabel(target: ForwardEmailTarget): string {
    const base = this.forwardTargets.find(t => t.value === target);
    const label = base?.label || "";
    switch (target) {
      case ForwardEmailTarget.MEMBER_EMAIL: {
        const email = this.memberPersonalEmail();
        return email ? `${label} (${email})` : `${label} (not linked)`;
      }
      case ForwardEmailTarget.CUSTOM: {
        const email = this.committeeMember?.forwardEmailCustom;
        return email ? `${label} (${email})` : label;
      }
      default:
        return label;
    }
  }

  forwardTargetChanged() {
    if (this.committeeMember.forwardEmailTarget === ForwardEmailTarget.MULTIPLE && !this.committeeMember.forwardEmailRecipients?.length) {
      const currentEmail = this.memberPersonalEmail() || this.committeeMember.forwardEmailCustom;
      if (currentEmail) {
        this.committeeMember.forwardEmailRecipients = [currentEmail];
      }
    }
  }

  importableWorkerName(): string | null {
    if (!this.baseDomain || !this.committeeMember?.type) {
      return null;
    }
    const sanitisedDomain = this.baseDomain.replace(/\./g, "-");
    const expectedName = `email-fwd-${sanitisedDomain}-${this.committeeMember.type}`;
    const matched = this.workers.find(w => w.id === expectedName);
    if (matched) {
      return matched.id;
    }
    const catchAllWorkerAction = this.catchAllRule?.actions?.find(a => a.type === EmailRoutingActionType.WORKER);
    return catchAllWorkerAction?.value?.[0] || null;
  }

  async importRecipientsFromWorker() {
    const workerName = this.importableWorkerName();
    if (!workerName) {
      return;
    }
    this.importingRecipients = true;
    try {
      const recipients = await this.cloudflareEmailRoutingService.queryWorkerRecipients(workerName);
      this.logger.info("Imported recipients from worker:", workerName, recipients);
      this.committeeMember.forwardEmailRecipients = recipients;
      this.refreshRecipientEmailOptions();
    } catch (err) {
      this.logger.error("Failed to import recipients from worker:", err);
    } finally {
      this.importingRecipients = false;
    }
  }

  roleEmail(): string {
    if (!this.committeeMember?.type || !this.baseDomain) {
      return null;
    }
    return `${this.committeeMember.type}@${this.baseDomain}`;
  }

  activeWorkerScriptName(): string {
    const email = this.roleEmail();
    if (!email) {
      return null;
    }
    const matchingRule = this.emailRoutingRules.find(rule =>
      rule.matchers?.some(m => m.type === EmailRoutingMatcherType.LITERAL && m.field === EmailRoutingMatcherField.TO && m.value === email)
    );
    const workerAction = matchingRule?.actions?.find(a => a.type === EmailRoutingActionType.WORKER);
    return workerAction?.value?.[0] || null;
  }

  activeRouteType(): string {
    return this.activeWorkerScriptName() ? EmailRouteType.WORKER : EmailRouteType.NONE;
  }

  deleteRole() {
    this.logger.info("deleteRole:", this.committeeMember);
    this.roles.splice(this.index, 1);
  }

  markdownLink(committeeMember: CommitteeMember) {
    const name = this.memberNamingService.firstAndLastNameFrom(committeeMember?.fullName);
    const path = this.urlService.pathSegments().join("/");
    const editParam = committeeMember?.type ? "&edit=" + committeeMember.type : "";
    return name ? "[Contact " + name?.firstName + "](?contact-us&role=" + committeeMember?.type + "&redirect=" + path + editParam + ")" : null;
  }
}
