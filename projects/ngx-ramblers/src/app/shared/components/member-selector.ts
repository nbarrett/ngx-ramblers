import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberService } from "../../services/member/member.service";
import { Member, MemberWithLabel } from "../../models/member.model";
import { sortBy } from "../../functions/arrays";
import { memberDisambiguatedLabel } from "../../functions/member-names";

@Component({
  selector: "app-member-selector",
    imports: [FormsModule, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective, FullNamePipe],
  template: `
    <ng-select
      [items]="membersWithLabel"
      bindLabel="ngSelectAttributes.label"
      [disabled]="disabled"
      [searchable]="true"
      [clearable]="true"
      [compareWith]="compareMembers"
      dropdownPosition="auto"
      [appendTo]="'body'"
      [placeholder]="placeholder"
      [(ngModel)]="selectedMember"
      (ngModelChange)="onMemberChange($event)">
      <ng-template ng-label-tmp let-item="item">
        {{ item | fullName }}
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        {{ item | fullName }}
      </ng-template>
    </ng-select>
  `
})
export class MemberSelector implements OnInit {
  private memberService = inject(MemberService);

  @Input() selectedMember: Member | null = null;
  @Input() placeholder = "Select member";
  @Input() disabled = false;
  @Input("members") set memberList(members: Member[]) {
    this.membersProvided = true;
    this.refreshMembers(members || []);
  }
  @Output() selectedMemberChange = new EventEmitter<Member | null>();

  public membersWithLabel: MemberWithLabel[] = [];
  private membersProvided = false;

  async ngOnInit() {
    if (!this.membersProvided) {
      this.refreshMembers(await this.memberService.all());
    }
  }

  private refreshMembers(members: Member[]): void {
    this.membersWithLabel = members.map(member => ({
      ...member,
      ngSelectAttributes: {label: memberDisambiguatedLabel(member)}
    })).sort(sortBy("ngSelectAttributes.label"));
  }

  compareMembers(first: Member, second: Member): boolean {
    return first?.id === second?.id;
  }

  onMemberChange(member: Member | null) {
    this.selectedMemberChange.emit(member);
  }
}
