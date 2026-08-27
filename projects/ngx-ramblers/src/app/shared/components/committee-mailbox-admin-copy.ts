import { Component, inject, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { committeeMembersSettingsQueryParams } from "../../functions/committee-members";
import { AdminSettingsPath } from "../../models/admin-route-paths.model";
import { MemberLoginService } from "../../services/member/member-login.service";

@Component({
  selector: "app-committee-mailbox-admin-copy",
  imports: [RouterLink],
  template: `
    @if (canMaintain()) {
      Click Alternative to make that address the default sender.
      @if (roleType) {
        <a [routerLink]="'/' + committeeSettingsPath"
           [queryParams]="queryParams()">Maintain email addresses</a>.
      }
    } @else if (readOnlyMessage) {
      They are assigned in Committee Settings and cannot be changed here.
    }
  `,
  standalone: true
})
export class CommitteeMailboxAdminCopyComponent {
  @Input() roleType: string | null = null;
  protected readOnlyMessage = false;
  private memberLoginService = inject(MemberLoginService);
  protected readonly committeeSettingsPath = AdminSettingsPath.COMMITTEE_SETTINGS;

  @Input()
  set showReadOnly(value: boolean) {
    this.readOnlyMessage = coerceBooleanProperty(value);
  }

  protected canMaintain(): boolean {
    return this.memberLoginService.allowMemberAdminEdits();
  }

  protected queryParams(): Record<string, string> {
    return committeeMembersSettingsQueryParams(this.roleType);
  }
}
