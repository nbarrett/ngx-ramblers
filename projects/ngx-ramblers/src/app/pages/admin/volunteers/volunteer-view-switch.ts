import { Component, inject, Input, ViewEncapsulation } from "@angular/core";
import { Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faUserGear, faUser } from "@fortawesome/free-solid-svg-icons";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { volunteerAdminAllowed } from "../../../functions/volunteer-management";
import { AdminMembersPath } from "../../../models/admin-route-paths.model";

@Component({
  selector: "app-volunteer-view-switch",
  imports: [FontAwesomeModule],
  encapsulation: ViewEncapsulation.None,
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
  styles: [`
    .control-pill
      display: inline-flex
      align-items: center
      padding: 3px
      gap: 3px
      border: 1px solid var(--rsm-border)
      border-radius: 999px
      background: var(--rsm-panel-bg)
    .control-pill-btn
      display: inline-flex
      align-items: center
      gap: var(--space-2)
      border: none
      background: transparent
      color: var(--rsm-text)
      font-weight: 600
      font-size: 0.9rem
      padding: 6px 16px
      border-radius: 999px
      cursor: pointer
      white-space: nowrap
    .control-pill-btn:disabled
      cursor: default
      opacity: 0.55
    .control-pill-btn fa-icon
      color: var(--rsm-muted)
    .control-pill-btn.active
      background: var(--ramblers-colour-sunrise)
      color: #1d3557
    .control-pill-btn.active fa-icon
      color: #1d3557
    .control-pill-btn:not(.active):not(:disabled):hover
      background: var(--rsm-border)
    .control-pill-icon
      padding: 6px 12px
    .control-pill-divider
      width: 1px
      align-self: stretch
      margin: 3px 2px
      background: var(--rsm-border)
  `]
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
