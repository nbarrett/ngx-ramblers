import { Component, EventEmitter, HostListener, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { Member, MemberWithLabel } from "../../models/member.model";
import { ParishAllocation, ParishFeatureProperties, ParishStatus } from "../../models/parish-map.model";

@Component({
  selector: "app-parish-popup",
  imports: [FormsModule, NgSelectComponent, FullNamePipe],
  template: `
    <div style="text-align: center; min-width: 200px;">
      <div style="font-weight: 600; margin-bottom: 4px;">{{ props?.PARNCP24NM }}</div>
      <div [style.color]="statusColor" style="font-size: 11px; font-weight: 600;">{{ allocation?.status }}</div>
      @if (!isAdmin && assignedMember) {
        <div style="font-size: 11px; margin-top: 2px;">{{ assignedMember | fullName }}</div>
      } @else if (!isAdmin && allocation?.assignee) {
        <div style="font-size: 11px; margin-top: 2px;">{{ allocation.assignee }}</div>
      }
      <div style="font-size: 10px; color: #999; margin-top: 2px;">{{ props?.PARNCP24CD }}</div>
      @if (isAdmin) {
        <div style="margin-top: 8px;">
          <ng-select
            [items]="membersWithLabel"
            bindLabel="ngSelectAttributes.label"
            [compareWith]="compareMember"
            [searchable]="true"
            [clearable]="true"
            dropdownPosition="bottom"
            placeholder="Assign member"
            [(ngModel)]="selectedMember"
            (ngModelChange)="onMemberChange($event)"
            [appendTo]="'body'"
            style="font-size: 12px; text-align: left;">
          </ng-select>
        </div>
        @if (allocation?.status !== ParishStatus.VACANT) {
          <div style="margin-top: 6px;">
            <button
              (click)="onToggleStatus()"
              [style.background]="vacantColor"
              style="cursor: pointer; border: none; border-radius: 3px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: white;">
              Mark Vacant
            </button>
          </div>
        }
      }
    </div>
  `
})
export class ParishPopup implements OnInit {
  protected readonly ParishStatus = ParishStatus;

  @Input() props: ParishFeatureProperties | null = null;
  @Input() allocation: ParishAllocation | null = null;
  @Input() isAdmin = false;
  @Input() allocatedColor = "#4a8c3f";
  @Input() vacantColor = "#cc0000";
  @Input() membersWithLabel: MemberWithLabel[] = [];
  @Output() memberAssigned = new EventEmitter<Member | null>();
  @Output() statusToggled = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  selectedMember: MemberWithLabel | null = null;
  assignedMember: Member | null = null;

  get statusColor(): string {
    return this.allocation?.status === ParishStatus.VACANT ? this.vacantColor : this.allocatedColor;
  }

  @HostListener("document:keydown.escape")
  onEscapeKey() {
    this.closed.emit();
  }

  ngOnInit() {
    if (this.allocation?.assigneeMemberId) {
      this.selectedMember = this.membersWithLabel.find(m => m.id === this.allocation?.assigneeMemberId) || null;
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
}
