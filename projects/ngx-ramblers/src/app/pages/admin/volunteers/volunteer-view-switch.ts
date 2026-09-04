import { Component, inject, Input } from "@angular/core";
import { Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faUserGear, faUser } from "@fortawesome/free-solid-svg-icons";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { volunteerAdminAllowed } from "../../../functions/volunteer-management";
import { AdminMembersPath } from "../../../models/admin-route-paths.model";

@Component({
  selector: "app-volunteer-view-switch",
  imports: [FontAwesomeModule],
  template: `
    @if (showSwitch) {
      <div class="control-pill" role="group" aria-label="Volunteer view controls">
        <button type="button" class="control-pill-btn" [class.active]="!adminView"
                [attr.aria-pressed]="!adminView" (click)="goTo(false)">
          <fa-icon [icon]="faUser"/> My view
        </button>
        <button type="button" class="control-pill-btn" [class.active]="adminView"
                [attr.aria-pressed]="adminView" (click)="goTo(true)">
          <fa-icon [icon]="faUserGear"/> Admin view
        </button>
        <ng-content/>
      </div>
    }
  `,
})
export class VolunteerViewSwitch {
  private router = inject(Router);
  private memberLoginService = inject(MemberLoginService);
  protected readonly faUserGear = faUserGear;
  protected readonly faUser = faUser;

  @Input() adminView = false;

  protected get showSwitch(): boolean {
    return volunteerAdminAllowed(this.memberLoginService.loggedInMember() ?? {});
  }

  protected goTo(adminView: boolean): void {
    if (adminView !== this.adminView) {
      this.router.navigate([adminView ? AdminMembersPath.VOLUNTEERS : AdminMembersPath.MY_VOLUNTEER_INFORMATION]);
    }
  }
}
