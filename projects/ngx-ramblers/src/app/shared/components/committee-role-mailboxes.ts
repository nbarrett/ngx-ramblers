import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEnvelope, faTimes } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import {
  CommitteeAssignedMailboxGroup,
  CommitteeMailboxAddress,
  CommitteeMailboxDefaultChange,
  CommitteeMailboxKind
} from "../../models/committee.model";
import { AlertTarget } from "../../models/alert-target.model";
import { committeeOutboundEmailQueryParams } from "../../functions/committee-members";
import { extractErrorMessage } from "../../functions/strings";
import { AdminSettingsPath } from "../../models/admin-route-paths.model";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";

@Component({
  selector: "app-committee-role-mailboxes",
  imports: [FontAwesomeModule, TooltipDirective, RouterLink],
  styles: [`
    button.mailbox-chip
      cursor: pointer
      line-height: inherit
  `],
  template: `
    @for (group of groups; track group.roleType) {
      <div [class.mb-3]="!$last">
        @if (showRoleHeading) {
          <div class="d-flex align-items-baseline flex-wrap gap-2">
            <div class="fw-semibold">{{ group.roleDescription }}</div>
            @if (canChangeDefault()) {
              <a [routerLink]="'/' + committeeSettingsPath"
                 [queryParams]="outboundQueryParams(group.roleType)">Maintain email addresses</a>
            }
          </div>
        }
        <ul class="list-unstyled mb-0">
          @for (item of group.addresses; track item.email) {
            <li class="d-flex align-items-center flex-nowrap gap-2 pt-2">
              <fa-icon [icon]="faEnvelope" class="fa-fw colour-mintcake"/>
              <span>{{ item.email }}</span>
              @if (canChangeDefault() && item.kind !== defaultKind) {
                <button type="button" class="mailbox-chip text-nowrap badge-cloudy"
                        [disabled]="saving || selectionDisabled"
                        (click)="chooseDefault(group, item)">{{ caption(item) }}</button>
              } @else {
                <span class="text-nowrap"
                      [class.badge-mintcake]="item.kind === defaultKind"
                      [class.badge-cloudy]="item.kind !== defaultKind">{{ caption(item) }}</span>
              }
              @if (removable && !item.generated) {
                <button type="button" class="btn btn-quiet btn-icon"
                        tooltip="Remove address" container="body"
                        (click)="removeAddress(item)"
                        [disabled]="selectionDisabled">
                  <fa-icon [icon]="faTimes"/>
                </button>
              }
            </li>
          }
        </ul>
      </div>
    }
    @if (notifyTarget.showAlert) {
      <div class="alert {{notifyTarget.alertClass}} d-flex align-items-start mt-2 mb-0" role="alert">
        <fa-icon [icon]="notifyTarget.alert.icon" class="me-2 mt-1"/>
        <div>
          @if (notifyTarget.alertTitle) {
            <strong class="d-block">{{ notifyTarget.alertTitle }}</strong>
          }
          {{ notifyTarget.alertMessage }}
        </div>
      </div>
    }
  `,
  standalone: true
})
export class CommitteeRoleMailboxesComponent {
  @Input() groups: CommitteeAssignedMailboxGroup[] = [];
  @Output() defaultChange = new EventEmitter<CommitteeMailboxDefaultChange>();
  @Output() addressRemove = new EventEmitter<string>();
  protected readonly faEnvelope = faEnvelope;
  protected readonly faTimes = faTimes;
  protected readonly defaultKind = CommitteeMailboxKind.DEFAULT_SENDER;
  protected saving = false;
  protected persistChanges = true;
  protected showRoleHeading = true;
  protected removable = false;
  protected selectionDisabled = false;
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = inject(NotifierService).createAlertInstance(this.notifyTarget);
  private committeeConfigService = inject(CommitteeConfigService);
  private memberLoginService = inject(MemberLoginService);
  protected readonly committeeSettingsPath = AdminSettingsPath.COMMITTEE_SETTINGS;
  protected readonly outboundQueryParams = committeeOutboundEmailQueryParams;

  @Input()
  set persist(value: boolean) {
    this.persistChanges = coerceBooleanProperty(value);
  }

  @Input()
  set showHeading(value: boolean) {
    this.showRoleHeading = coerceBooleanProperty(value);
  }

  @Input()
  set allowRemove(value: boolean) {
    this.removable = coerceBooleanProperty(value);
  }

  @Input()
  set disabled(value: boolean) {
    this.selectionDisabled = coerceBooleanProperty(value);
  }

  protected caption(item: CommitteeMailboxAddress): string {
    return item.kind === this.defaultKind ? "Default" : "Alternative";
  }

  protected canChangeDefault(): boolean {
    return !this.selectionDisabled && this.memberLoginService.allowMemberAdminEdits();
  }

  protected chooseDefault(group: CommitteeAssignedMailboxGroup, item: CommitteeMailboxAddress): void {
    if (this.canChangeDefault() && item.kind !== this.defaultKind && !this.saving) {
      if (this.persistChanges) {
        this.saving = true;
        this.committeeConfigService.applyDefaultSender(group.roleType, item.email)
          .then(() => {
            this.notify.success({title: "Committee emails", message: `${item.email} is now the default sender`});
          })
          .catch(error => {
            this.notify.error({
              title: "Committee emails",
              message: extractErrorMessage(error),
              continue: true
            });
          })
          .finally(() => {
            this.saving = false;
          });
      } else {
        this.defaultChange.emit({roleType: group.roleType, email: item.email});
      }
    }
  }

  protected removeAddress(item: CommitteeMailboxAddress): void {
    if (this.removable && !item.generated && !this.selectionDisabled) {
      this.addressRemove.emit(item.email);
    }
  }
}
