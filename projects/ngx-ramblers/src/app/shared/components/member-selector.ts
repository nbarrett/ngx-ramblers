import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberService } from "../../services/member/member.service";
import { Member, MemberWithLabel } from "../../models/member.model";
import { sortBy } from "../../functions/arrays";

@Component({
  selector: "app-member-selector",
  standalone: true,
  imports: [FormsModule, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective, FullNamePipe],
  template: `
    <ng-select
      [items]="membersWithLabel"
      bindLabel="ngSelectAttributes.label"
      [searchable]="true"
      [clearable]="true"
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
  private fullNamePipe = inject(FullNamePipe);

  @Input() selectedMember: Member | null = null;
  @Input() placeholder = "Select member";
  @Output() selectedMemberChange = new EventEmitter<Member | null>();

  public membersWithLabel: MemberWithLabel[] = [];

  async ngOnInit() {
    const members = await this.memberService.all();
    this.membersWithLabel = members.map(member => ({
      ...member,
      ngSelectAttributes: {label: this.fullNamePipe.transform(member)}
    })).sort(sortBy("ngSelectAttributes.label"));
  }

  onMemberChange(member: Member | null) {
    this.selectedMemberChange.emit(member);
  }
}
