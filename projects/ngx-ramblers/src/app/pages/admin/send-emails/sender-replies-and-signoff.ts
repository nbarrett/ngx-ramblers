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

@Component({
    selector: "app-sender-replies-and-sign-off",
    template: `
    <div class="row" app-create-or-amend-sender (senderExists)="senderExists.emit($event)"
    [committeeRoleSender]="committeeRoleSender"></div>
    @if (notificationConfig) {
      @if (allowSelectAllAsMe) {
        <div class="row mb-2">
          <div class="col-sm-12">
            <button type="button" class="btn btn-primary btn-sm"
              [disabled]="selectAllAsMeDisabled()"
              (click)="selectAllAsMe()">Select All As Me</button>
          </div>
        </div>
      }
      <div class="row">
        <div class="col-sm-6">
          <div class="form-group">
            <label for="sender">Sender</label>
            <select [(ngModel)]="notificationConfig.senderRole" (ngModelChange)="senderRoleChanged()"
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
              <div class="text-danger"><small>Role "{{ notificationConfig.senderRole }}" not found in committee</small></div>
            }
          </div>
        </div>
        @if (!omitCC) {
          <div class="col-sm-6">
              <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                [label]="'CC Roles'"
                [roles]="notificationConfig.ccRoles"
                (rolesChange)="this.notificationConfig.ccRoles = $event.roles;"/>
          </div>
        }
        <div class="col-sm-6">
          <div class="form-group">
            <label for="reply-to">Reply To</label>
            @if (notificationConfig) {
              <select [(ngModel)]="notificationConfig.replyToRole"
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
                <div class="text-danger"><small>Role "{{ notificationConfig.replyToRole }}" not found in committee</small></div>
              }
            }
          </div>
        </div>
        @if (!omitSignOff) {
          <div class="col-sm-6">
              <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                [label]="'Sign Off Email With Roles'"
                [roles]="notificationConfig.signOffRoles"
                (rolesChange)="this.notificationConfig.signOffRoles = $event.roles;"/>
              @if (invalidSignOffRoles().length > 0) {
                <div class="text-danger">
                  @for (role of invalidSignOffRoles(); track role) {
                    <small>Sign-off role "{{ role }}" not found in committee</small>
                  }
                </div>
              }
          </div>
        }
      </div>
    }`,
    imports: [CreateOrAmendSenderComponent, FormsModule, CommitteeRoleMultiSelectComponent]
})

export class SenderRepliesAndSignoff implements OnInit {

  @Input("omitSignOff") set omitSignOffValue(omitSignOff: boolean) {
    this.omitSignOff = coerceBooleanProperty(omitSignOff);
  }

  @Input("omitCC") set omitCCValue(omitCC: boolean) {
    this.omitCC = coerceBooleanProperty(omitCC);
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
  public omitCC: boolean;
  public allowSelectAllAsMe: boolean;
  @Output() senderExists: EventEmitter<boolean> = new EventEmitter();
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
    if (!this.notificationConfig?.signOffRoles || !this.mailMessagingConfig?.committeeReferenceData) return [];
    return this.notificationConfig.signOffRoles.filter(role => !this.roleExists(role));
  }

  private handleNotificationConfigChange() {
    this.senderRoleChanged();
  }

  selectAllAsMeDisabled(): boolean {
    const roles = this.rolesForLoggedInMember();
    return roles.length === 0;
  }

  selectAllAsMe() {
    const roles = this.rolesForLoggedInMember();
    const primaryRole = roles[0];
    this.logger.info("selectAllAsMe:roles:", roles, "primaryRole:", primaryRole);
    if (!primaryRole || !this.notificationConfig) {
      this.logger.info("selectAllAsMe:aborted due to missing primaryRole or notificationConfig");
      return;
    }
    this.notificationConfig.senderRole = primaryRole;
    this.notificationConfig.replyToRole = primaryRole;
    if (!this.omitSignOff) {
      this.notificationConfig.signOffRoles = roles;
    }
    this.senderRoleChanged();
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
