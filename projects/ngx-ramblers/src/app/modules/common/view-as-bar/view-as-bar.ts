import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { Subscription } from "rxjs";
import { Member, MemberCookie } from "../../../models/member.model";
import { CommitteeConfig, CommitteeMember } from "../../../models/committee.model";
import { ViewAsMode } from "../../../models/view-as.model";
import { ViewAsService } from "../../../services/member/view-as.service";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { MemberSelector } from "../../../shared/components/member-selector";
import { AuthService } from "../../../auth/auth.service";
import { MemberService } from "../../../services/member/member.service";

import { TooltipModule } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-view-as-bar",
  imports: [FormsModule, MemberSelector, NgSelectComponent, TooltipModule, AsyncPipe],
  template: `
    @if ((viewAs.availableChanges | async) && optedIn && chromeVisible) {
      <div class="view-as-bar d-flex flex-wrap align-items-center gap-3 px-3 py-2">
        <span class="view-as-label">View as</span>
        <div class="form-check form-check-inline mb-0">
          <input id="view-as-mode-person" class="form-check-input" type="radio" name="view-as-mode" [value]="ViewAsMode.PERSON" [ngModel]="mode" (ngModelChange)="onMode($event)">
          <label class="form-check-label" for="view-as-mode-person">Person</label>
        </div>
        <div class="form-check form-check-inline mb-0">
          <input id="view-as-mode-role" class="form-check-input" type="radio" name="view-as-mode" [value]="ViewAsMode.ROLE" [ngModel]="mode" (ngModelChange)="onMode($event)">
          <label class="form-check-label" for="view-as-mode-role">Role</label>
        </div>
        @if (mode === ViewAsMode.PERSON) {
          <div class="view-as-field">
            <app-member-selector [selectedMember]="selectedMember"
                                 placeholder="Select member"
                                 (selectedMemberChange)="onMember($event)"/>
          </div>
        }
        @if (mode === ViewAsMode.ROLE) {
          <div class="view-as-field">
            <ng-select class="view-as-role"
                       [items]="roles"
                       bindLabel="nameAndDescription"
                       bindValue="type"
                       [clearable]="true"
                       [searchable]="true"
                       placeholder="Select role"
                       [ngModel]="selectedRoleType"
                       (ngModelChange)="onRoleType($event)"/>
          </div>
        }
        @if (impersonating()) {
          <button type="button" class="btn btn-quiet" (click)="viewAs.clear()">Clear</button>
        }
        <button type="button" class="btn btn-quiet" tooltip="Hide this bar for a screenshot. Option-Shift-V toggles it." (click)="viewAs.setChromeVisible(false)">Hide</button>
      </div>
    }
  `,
  styles: [`
    .view-as-bar
      background: var(--bs-body-bg, #fff)
      border: 1px solid var(--bs-border-color, #dee2e6)
      border-radius: 6px
      margin: 0.75rem 0
    .view-as-label
      font-weight: 600
      font-size: 0.875rem
      white-space: nowrap
    .view-as-field
      min-width: 14rem
      flex: 1 1 14rem
      max-width: 24rem
  `]
})
export class ViewAsBar implements OnInit, OnDestroy {
  protected viewAs = inject(ViewAsService);
  private committeeConfigService = inject(CommitteeConfigService);
  private authService = inject(AuthService);
  private memberService = inject(MemberService);
  protected readonly ViewAsMode = ViewAsMode;
  protected optedIn = false;
  protected chromeVisible = true;
  protected mode = ViewAsMode.PERSON;
  protected selectedMember: Member | null = null;
  protected selectedRoleType: string | null = null;
  protected roles: CommitteeMember[] = [];
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(this.viewAs.optedInChanges.subscribe(on => {
      this.optedIn = on;
      if (on) {
        void this.viewAs.hydrateFromLocation().then(() => this.showCurrentSelection());
      }
    }));
    this.subscriptions.push(this.viewAs.chromeVisibleChanges.subscribe(on => this.chromeVisible = on));
    this.subscriptions.push(this.committeeConfigService.committeeConfigEvents().subscribe((config: CommitteeConfig) => {
      this.roles = (config?.roles ?? []).filter(role => !!role.type);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  impersonating(): boolean {
    return !!(this.viewAs.memberIdFromLocation() || this.viewAs.roleTypeFromLocation());
  }

  onMode(mode: ViewAsMode): void {
    this.mode = mode;
  }

  onMember(member: Member | null): void {
    const real = this.authService.parseAuthToken() as MemberCookie;
    if (!member || member.id === real?.memberId) {
      if (this.impersonating()) {
        this.viewAs.clear();
      } else {
        this.selectedMember = member;
      }
    } else {
      this.viewAs.applyMember(member);
    }
  }

  onRoleType(roleType: string | null): void {
    const role = this.roles.find(item => item.type === roleType) ?? null;
    this.viewAs.applyRole(role);
  }

  private async showCurrentSelection(): Promise<void> {
    this.selectedRoleType = this.viewAs.roleTypeFromLocation();
    this.mode = this.selectedRoleType ? ViewAsMode.ROLE : ViewAsMode.PERSON;
    const viewed = this.viewAs.currentMember();
    if (viewed) {
      this.selectedMember = viewed;
    } else {
      const real = this.authService.parseAuthToken() as MemberCookie;
      this.selectedMember = real?.memberId ? await this.memberService.getById(real.memberId) : null;
    }
  }
}
