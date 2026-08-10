import { Component, EventEmitter, HostListener, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { NgSelectComponent } from "@ng-select/ng-select";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { Member, MemberWithLabel } from "../../models/member.model";
import { ParishFeatureProperties } from "../../models/parish-map.model";
import { AdminMembersPath } from "../../models/admin-route-paths.model";
import { StoredValue } from "../../models/ui-actions";
import { VolunteerAssignmentStatus, VolunteerMapAssignment, VolunteerWorkspaceView } from "../../models/volunteer-management.model";

@Component({
  selector: "app-parish-popup",
  imports: [FormsModule, NgSelectComponent, FullNamePipe],
  template: `
    <div class="parish-popup">
      <div class="parish-popup-header">
        <div class="parish-popup-name">{{ props?.PARNCP24NM }}</div>
        <div class="parish-popup-status">
          <span class="parish-popup-dot" [style.background]="statusColor"></span>
          <span [style.color]="statusColor">{{ covered ? "Parish Footpath Observer covered" : "Parish Footpath Observer vacant" }}</span>
        </div>
        <div class="parish-popup-code">{{ props?.PARNCP24CD }}</div>
      </div>
      @if (!isAdmin && assignedMember) {
        <div class="parish-popup-assignee">{{ assignedMember | fullName }}</div>
      } @else if (!isAdmin && assignment?.unresolvedName) {
        <div class="parish-popup-assignee">{{ assignment?.unresolvedName }}</div>
      }
      @if (isAdmin) {
        <label class="parish-popup-label">Parish Footpath Observer</label>
        <ng-select
          [items]="membersWithLabel"
          bindLabel="ngSelectAttributes.label"
          [compareWith]="compareMember"
          [searchable]="true"
          [clearable]="true"
          dropdownPosition="bottom"
          placeholder="Assign a member"
          [(ngModel)]="selectedMember"
          (ngModelChange)="onMemberChange($event)"
          [appendTo]="'body'"
          class="parish-popup-select">
        </ng-select>
        <div class="parish-popup-actions">
          @if (covered) {
            <button type="button" class="parish-popup-btn parish-popup-btn-secondary" (click)="onToggleStatus()">
              Mark as vacant
            </button>
          }
          <button type="button" class="parish-popup-btn parish-popup-btn-primary" (click)="onManageInWorkspace()">
            Open in volunteer workspace
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .parish-popup
      min-width: 244px
      max-width: 300px
      color: #1d3557
    .parish-popup-header
      text-align: center
      padding-bottom: 8px
      border-bottom: 1px solid rgba(29, 53, 87, 0.1)
      margin-bottom: 8px
    .parish-popup-name
      font-size: 16px
      font-weight: 700
      line-height: 1.25
    .parish-popup-status
      display: inline-flex
      align-items: center
      gap: 6px
      margin-top: 4px
      font-size: 12.5px
      font-weight: 600
    .parish-popup-dot
      width: 8px
      height: 8px
      border-radius: 50%
      flex-shrink: 0
    .parish-popup-code
      font-size: 11px
      color: #98a2b3
      font-family: var(--bs-font-monospace, monospace)
      letter-spacing: 0.03em
      margin-top: 3px
    .parish-popup-assignee
      text-align: center
      font-size: 13px
      color: #475467
    .parish-popup-label
      display: block
      font-size: 11px
      font-weight: 600
      text-transform: uppercase
      letter-spacing: 0.04em
      color: #667085
      margin-bottom: 4px
    .parish-popup-select
      font-size: 13px
      text-align: left
      display: block
    .parish-popup-actions
      display: flex
      flex-direction: column
      gap: 6px
      margin-top: 12px
    .parish-popup-btn
      border: none
      border-radius: 7px
      padding: 9px 14px
      font-size: 13px
      font-weight: 600
      cursor: pointer
      transition: filter 0.15s ease, background 0.15s ease
      width: 100%
    .parish-popup-btn-primary
      background: var(--ramblers-colour-sunrise, #e2a100)
      color: #1d3557
    .parish-popup-btn-primary:hover
      filter: brightness(0.95)
    .parish-popup-btn-secondary
      background: #fff
      color: #b42318
      border: 1px solid rgba(180, 35, 24, 0.35)
    .parish-popup-btn-secondary:hover
      background: rgba(180, 35, 24, 0.06)
  `]
})
export class ParishPopup implements OnInit {
  private router = inject(Router);
  @Input() props: ParishFeatureProperties | null = null;
  @Input() assignment: VolunteerMapAssignment | null = null;
  @Input() isAdmin = false;
  @Input() allocatedColor = "#4a8c3f";
  @Input() vacantColor = "#cc0000";
  @Input() membersWithLabel: MemberWithLabel[] = [];
  @Output() memberAssigned = new EventEmitter<Member | null>();
  @Output() statusToggled = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  selectedMember: MemberWithLabel | null = null;
  assignedMember: Member | null = null;

  get covered(): boolean {
    return this.assignment?.status === VolunteerAssignmentStatus.ACTIVE;
  }

  get statusColor(): string {
    return this.covered ? this.allocatedColor : this.vacantColor;
  }

  @HostListener("document:keydown.escape")
  onEscapeKey() {
    this.closed.emit();
  }

  ngOnInit() {
    if (this.assignment?.supporterId) {
      this.selectedMember = this.membersWithLabel.find(m => m.id === this.assignment?.supporterId) || null;
      this.assignedMember = this.selectedMember;
    }
  }

  compareMember(a: MemberWithLabel, b: MemberWithLabel): boolean {
    return a?.id === b?.id;
  }

  onMemberChange(member: MemberWithLabel | null) {
    this.assignedMember = member;
    this.memberAssigned.emit(member);
  }

  onToggleStatus() {
    this.statusToggled.emit();
  }

  onManageInWorkspace() {
    this.closed.emit();
    const person = this.selectedMember ?? this.assignedMember;
    const personName = person ? (person.displayName || [person.firstName, person.lastName].filter(part => !!part).join(" ")) : "";
    if (personName) {
      this.router.navigate([AdminMembersPath.VOLUNTEERS], {
        queryParams: {[StoredValue.TAB]: VolunteerWorkspaceView.VOLUNTEERS, [StoredValue.SEARCH]: personName}
      });
    } else {
      this.router.navigate([AdminMembersPath.VOLUNTEERS], {
        queryParams: {[StoredValue.TAB]: VolunteerWorkspaceView.PARISHES, [StoredValue.SEARCH]: this.props?.PARNCP24NM}
      });
    }
  }
}
