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
import { MemberLoginService } from "../../../services/member/member-login.service";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";

@Component({
    selector: "app-sender-replies-and-sign-off",
    template: `
    <div class="row" app-create-or-amend-sender (senderExists)="senderExists.emit($event)"
    [committeeRoleSender]="committeeRoleSender"></div>
    @if (notificationConfig) {
      @if (allowSelectAllAsMe) {
        <div class="row mb-2">
          <div class="col-sm-12">
            @if (loggedInMemberRoles().length > 1) {
              <div class="btn-group" dropdown>
                <button type="button" class="btn btn-quiet btn-sm dropdown-toggle" dropdownToggle
                  [disabled]="selectAllAsMeDisabled()">
                  Select All As Me <span class="caret"></span>
                </button>
                <ul *dropdownMenu class="dropdown-menu">
                  @for (role of loggedInMemberRoles(); track role.type) {
                    <li>
                      <a class="dropdown-item" href="javascript:void(0)" (click)="selectAllAsMe(role.type)">
                        {{ role.description || stringUtilsService.asTitle(role.roleType) }}
                        @if (role.fullName) {
                          <span class="text-muted small ms-1">- {{ role.fullName }}</span>
                        }
                      </a>
                    </li>
                  }
                </ul>
              </div>
            } @else {
              <button type="button" class="btn btn-quiet btn-sm"
                [disabled]="selectAllAsMeDisabled()"
                (click)="selectAllAsMe()">Select All As Me</button>
            }
          </div>
        </div>
      }
      <div class="row">
        <div class="col-sm-6">
          <div class="form-group">
            <label for="sender">Sender</label>
            <select [(ngModel)]="notificationConfig.senderRole" (ngModelChange)="senderRoleChanged(); rolesChanged.emit()"
              [class.is-invalid]="!notificationConfig.senderRole || !roleExists(notificationConfig.senderRole)"
              id="sender"
              class="form-control input-sm">
              @for (role of mailMessagingConfig.committeeReferenceData.committeeMembers(); track role.nameAndDescription) {
                <option
                  [ngValue]="role.type">{{ role.nameAndDescription }}
                </option>
              }
            </select>
            @if (notificationConfig.senderRole && !roleExists(notificationConfig.senderRole)) {
              <div class="text-danger">
                <small>
                  Role "{{ notificationConfig.senderRole }}" not found in committee
                  - <a style="cursor: pointer" (click)="clearSenderRole()">fix it for me</a>
                </small>
              </div>
            }
          </div>
        </div>
        @if (!omitBcc) {
          <div class="col-sm-6">
              <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                [label]="'BCC Roles'"
                [roles]="notificationConfig.bccRoles"
                (rolesChange)="this.notificationConfig.bccRoles = $event.roles; rolesChanged.emit()"/>
          </div>
        }
        <div class="col-sm-6">
          <div class="form-group">
            <label for="reply-to">Reply To</label>
            @if (notificationConfig) {
              <select [(ngModel)]="notificationConfig.replyToRole"
                (ngModelChange)="rolesChanged.emit()"
                [class.is-invalid]="!notificationConfig.replyToRole || !roleExists(notificationConfig.replyToRole)"
                id="reply-to"
                class="form-control input-sm">
                @for (role of mailMessagingConfig.committeeReferenceData.committeeMembers(); track role.nameAndDescription) {
                  <option
                    [ngValue]="role.type">{{ role.nameAndDescription }}
                  </option>
                }
              </select>
              @if (notificationConfig.replyToRole && !roleExists(notificationConfig.replyToRole)) {
                <div class="text-danger">
                  <small>
                    Role "{{ notificationConfig.replyToRole }}" not found in committee
                    - <a style="cursor: pointer" (click)="clearReplyToRole()">fix it for me</a>
                  </small>
                </div>
              }
            }
          </div>
        </div>
        @if (!omitSignOff) {
          @if (showSignOffText()) {
            <div class="col-sm-6">
              <div class="form-group">
                <label for="sign-off-text">Sign Off Text</label>
                <input [(ngModel)]="notificationConfig.signOffText"
                       (ngModelChange)="rolesChanged.emit()"
                       id="sign-off-text"
                       class="form-control input-sm"
                       placeholder="e.g. Kind regards">
                <small class="text-muted">Closing line shown above the sign-off names.</small>
              </div>
            </div>
          }
          <div class="col-sm-6">
              <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                [label]="'Sign Off Email With Roles'"
                [roles]="effectiveSignOffRoles()"
                (rolesChange)="onSignOffRolesUpdated($event.roles)"/>
              @if (invalidSignOffRoles().length > 0) {
                <div class="text-danger">
                  <small>
                    @for (role of invalidSignOffRoles(); track role; let last = $last) {
                      Sign-off role "{{ role }}" not found in committee@if (!last) { <span>; </span> }
                    }
                    - <a style="cursor: pointer" (click)="removeInvalidSignOffRoles()">fix it for me</a>
                  </small>
                </div>
              }
          </div>
        }
      </div>
    }`,
    imports: [CreateOrAmendSenderComponent, FormsModule, CommitteeRoleMultiSelectComponent, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective]
})

export class SenderRepliesAndSignoff implements OnInit {

  @Input("omitSignOff") set omitSignOffValue(omitSignOff: boolean) {
    this.omitSignOff = coerceBooleanProperty(omitSignOff);
  }

  @Input("omitBcc") set omitBccValue(omitBcc: boolean) {
    this.omitBcc = coerceBooleanProperty(omitBcc);
  }

  @Input("allowSelectAllAsMe") set allowSelectAllAsMeValue(allowSelectAllAsMe: boolean) {
    this.allowSelectAllAsMe = coerceBooleanProperty(allowSelectAllAsMe);
  }

  public error: any;
  public committeeRoleSender: CommitteeMember;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private logger = this.loggerFactory.createLogger("SenderRepliesAndSignoff", NgxLoggerLevel.ERROR );
  public omitSignOff: boolean;
  public omitBcc: boolean;
  public allowSelectAllAsMe: boolean;
  @Output() senderExists: EventEmitter<boolean> = new EventEmitter();
  @Output() rolesChanged: EventEmitter<void> = new EventEmitter();
  @Input() signOffRolesOverride: string[] | null = null;
  @Output() signOffRolesOverrideChange: EventEmitter<string[]> = new EventEmitter();
  private memberLoginService = inject(MemberLoginService);

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
  }

  senderRoleChanged() {
    this.committeeRoleSender = this.mailMessagingConfig.committeeReferenceData.committeeMemberForRole(this.notificationConfig.senderRole);
  }

  roleExists(role: string): boolean {
    if (!role || !this.mailMessagingConfig?.committeeReferenceData) return false;
    return this.mailMessagingConfig.committeeReferenceData.committeeMembers().some(m => m.type === role);
  }

  invalidSignOffRoles(): string[] {
    const source = this.signOffRolesSource();
    if (!source || !this.mailMessagingConfig?.committeeReferenceData) return [];
    return source.filter(role => !this.roleExists(role));
  }

  effectiveSignOffRoles(): string[] {
    const source = this.signOffRolesSource() ?? [];
    return this.overrideMode() ? this.stripVacantRoles(source) : source;
  }

  onSignOffRolesUpdated(roles: string[]): void {
    const next = this.overrideMode() ? this.stripVacantRoles(roles ?? []) : (roles ?? []);
    this.assignSignOffRoles(next);
    this.rolesChanged.emit();
  }

  private overrideMode(): boolean {
    return this.signOffRolesOverride !== null && this.signOffRolesOverride !== undefined;
  }

  showSignOffText(): boolean {
    return !!this.notificationConfig && !this.overrideMode();
  }

  private signOffRolesSource(): string[] | null {
    if (this.signOffRolesOverride !== null && this.signOffRolesOverride !== undefined) {
      return this.signOffRolesOverride;
    }
    return this.notificationConfig?.signOffRoles ?? null;
  }

  private assignSignOffRoles(roles: string[]): void {
    if (this.signOffRolesOverride !== null && this.signOffRolesOverride !== undefined) {
      this.signOffRolesOverride = roles;
      this.signOffRolesOverrideChange.emit(roles);
    } else if (this.notificationConfig) {
      this.notificationConfig.signOffRoles = roles;
    }
  }

  private stripVacantRoles(roles: string[]): string[] {
    if (!roles?.length) return [];
    const committeeMembers = this.mailMessagingConfig?.committeeReferenceData?.committeeMembers() ?? [];
    return roles.filter(role => {
      const member = committeeMembers.find(candidate => candidate.type === role);
      if (!member) return true;
      return this.isAssignableRole(member);
    });
  }

  clearSenderRole(): void {
    if (!this.notificationConfig) return;
    this.notificationConfig.senderRole = this.bestRoleMatch(this.notificationConfig.senderRole);
    this.senderRoleChanged();
    this.rolesChanged.emit();
  }

  clearReplyToRole(): void {
    if (!this.notificationConfig) return;
    this.notificationConfig.replyToRole = this.bestRoleMatch(this.notificationConfig.replyToRole);
    this.rolesChanged.emit();
  }

  private bestRoleMatch(badRole: string): string {
    const committeeMembers = this.mailMessagingConfig?.committeeReferenceData?.committeeMembers() ?? [];
    const needle = (badRole || "").toLowerCase().trim();
    if (needle) {
      const typeMatch = committeeMembers.find(member => {
        const type = member.type?.toLowerCase() ?? "";
        return type && (type.includes(needle) || needle.includes(type));
      });
      if (typeMatch) return typeMatch.type;
      const descriptionMatch = committeeMembers.find(member => {
        const description = member.description?.toLowerCase() ?? "";
        return description && (description.includes(needle) || needle.includes(description));
      });
      if (descriptionMatch) return descriptionMatch.type;
    }
    return committeeMembers.find(member => this.isAssignableRole(member))?.type
      ?? committeeMembers[0]?.type
      ?? "";
  }

  removeInvalidSignOffRoles(): void {
    const source = this.signOffRolesSource();
    if (!source) return;
    const replaced = source
      .map(role => this.roleExists(role) ? role : this.bestRoleMatch(role))
      .filter(role => !!role);
    const seen = new Set<string>();
    const deduped = replaced.filter(role => {
      if (seen.has(role)) return false;
      seen.add(role);
      return true;
    });
    this.assignSignOffRoles(this.overrideMode() ? this.stripVacantRoles(deduped) : deduped);
    this.rolesChanged.emit();
  }

  private handleNotificationConfigChange() {
    this.senderRoleChanged();
  }

  selectAllAsMeDisabled(): boolean {
    const roles = this.rolesForLoggedInMember();
    return roles.length === 0;
  }

  loggedInMemberRoles(): CommitteeMember[] {
    const roleTypes = this.rolesForLoggedInMember();
    if (!roleTypes.length || !this.mailMessagingConfig?.committeeReferenceData) return [];
    const committeeMembers = this.mailMessagingConfig.committeeReferenceData.committeeMembers();
    return roleTypes
      .map(type => committeeMembers.find(member => member.type === type))
      .filter((member): member is CommitteeMember => !!member);
  }

  selectAllAsMe(preferredPrimaryRole?: string) {
    const roles = this.rolesForLoggedInMember();
    const primaryRole = preferredPrimaryRole && roles.includes(preferredPrimaryRole)
      ? preferredPrimaryRole
      : roles[0];
    this.logger.info("selectAllAsMe:roles:", roles, "primaryRole:", primaryRole);
    if (!primaryRole || !this.notificationConfig) {
      this.logger.info("selectAllAsMe:aborted due to missing primaryRole or notificationConfig");
      return;
    }
    this.notificationConfig.senderRole = primaryRole;
    this.notificationConfig.replyToRole = primaryRole;
    if (!this.omitSignOff) {
      const signOffRoles = [primaryRole];
      this.assignSignOffRoles(this.overrideMode() ? this.stripVacantRoles(signOffRoles) : signOffRoles);
    }
    this.senderRoleChanged();
    this.rolesChanged.emit();
  }

  private rolesForLoggedInMember(): string[] {
    const loggedInMember = this.memberLoginService.loggedInMember();
    const memberId = loggedInMember?.memberId;
    const memberEmail = loggedInMember?.userName?.toLowerCase();
    const loggedInFullName = `${loggedInMember?.firstName || ""} ${loggedInMember?.lastName || ""}`.trim().toLowerCase();
    if (!this.mailMessagingConfig?.committeeReferenceData) {
      return [];
    }
    const committeeMembers = this.mailMessagingConfig.committeeReferenceData.committeeMembers();
    const memberRoles = committeeMembers
      .filter(member => {
        if (memberId && member.memberId === memberId) {
          return true;
        }
        const roleEmail = member.email?.toLowerCase();
        if (!!memberEmail && !!roleEmail && roleEmail === memberEmail) {
          return true;
        }
        const roleFullName = member.fullName?.toLowerCase()?.trim() || "";
        return !!loggedInFullName && !!roleFullName && roleFullName === loggedInFullName;
      })
      .map(member => member.type);
    if (memberRoles.length > 0) {
      return this.uniqueRoles(memberRoles);
    }
    const configuredRoles = [this.notificationConfig?.senderRole, this.notificationConfig?.replyToRole]
      .filter(role => !!role)
      .map(role => this.resolvedRoleType(role))
      .filter(role => !!role);
    if (configuredRoles.length > 0) {
      return this.uniqueRoles(configuredRoles);
    }
    const senderCommitteeRole = this.notificationConfig?.senderRole
      ? this.mailMessagingConfig.committeeReferenceData.committeeMemberForRole(this.notificationConfig.senderRole)
      : null;
    if (senderCommitteeRole?.type) {
      return [senderCommitteeRole.type];
    }
    const replyToCommitteeRole = this.notificationConfig?.replyToRole
      ? this.mailMessagingConfig.committeeReferenceData.committeeMemberForRole(this.notificationConfig.replyToRole)
      : null;
    if (replyToCommitteeRole?.type) {
      return [replyToCommitteeRole.type];
    }
    const firstAssignableRole = committeeMembers
      .find(member => this.isAssignableRole(member));
    return firstAssignableRole ? [firstAssignableRole.type] : [];
  }

  private resolvedRoleType(role: string): string | null {
    if (!role || !this.mailMessagingConfig?.committeeReferenceData) {
      return null;
    }
    const committeeRole = this.mailMessagingConfig.committeeReferenceData.committeeMemberForRole(role);
    return committeeRole?.type || null;
  }

  private uniqueRoles(roles: string[]): string[] {
    return roles.filter((role, index, allRoles) => allRoles.indexOf(role) === index);
  }

  private isAssignableRole(role: CommitteeMember | null): boolean {
    if (!role?.type) {
      return false;
    }
    const fullNameText = role.fullName?.toLowerCase() || "";
    const nameAndDescriptionText = role.nameAndDescription?.toLowerCase() || "";
    const isVacantByText = fullNameText.includes("vacant") || nameAndDescriptionText.includes("vacant");
    return !role.vacant && !isVacantByText;
  }
}
