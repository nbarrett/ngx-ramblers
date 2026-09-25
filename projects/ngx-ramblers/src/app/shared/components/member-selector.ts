import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { concat, from, Observable, of, Subject } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from "rxjs/operators";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { MemberService } from "../../services/member/member.service";
import { Member, MemberWithLabel } from "../../models/member.model";
import { sortBy } from "../../functions/arrays";
import { memberDisambiguatedLabel } from "../../functions/member-names";
import { limitedMemberMatches, MEMBER_TYPEAHEAD_LIMIT, memberMatchesSearch } from "../../functions/member-search";

@Component({
  selector: "app-member-selector",
    imports: [FormsModule, NgSelectComponent, NgLabelTemplateDirective, NgOptionTemplateDirective, FullNamePipe, AsyncPipe],
  template: `
    <ng-select
      [items]="members$ | async"
      bindLabel="ngSelectAttributes.label"
      [disabled]="disabled"
      [searchable]="true"
      [clearable]="true"
      [loading]="loading"
      [typeahead]="searchInput$"
      [minTermLength]="0"
      [compareWith]="compareMembers"
      dropdownPosition="bottom"
      [appendTo]="'body'"
      [placeholder]="placeholder"
      [(ngModel)]="selectedMember"
      (open)="onOpen()"
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
    this.providedMembers = members || [];
    this.searchInput$.next(this.lastTerm);
  }
  @Output() selectedMemberChange = new EventEmitter<Member | null>();

  public members$: Observable<MemberWithLabel[]>;
  public searchInput$ = new Subject<string>();
  public loading = false;
  private membersProvided = false;
  private providedMembers: Member[] = [];
  private lastTerm = "";

  ngOnInit() {
    this.members$ = concat(
      this.loadMembers(""),
      this.searchInput$.pipe(
        debounceTime(200),
        distinctUntilChanged(),
        tap(term => this.lastTerm = term || ""),
        switchMap(term => this.loadMembers(term || ""))
      )
    );
  }

  protected onOpen(): void {
    this.searchInput$.next(this.lastTerm);
  }

  private loadMembers(term: string): Observable<MemberWithLabel[]> {
    this.loading = true;
    const selectedId = this.selectedMember?.id;
    if (this.membersProvided) {
      const matches = limitedMemberMatches(
        this.providedMembers,
        term,
        selectedId ? [selectedId] : [],
        member => memberMatchesSearch(member, term),
        MEMBER_TYPEAHEAD_LIMIT
      );
      this.loading = false;
      return of(this.withLabels(matches));
    } else {
      return from(this.memberService.search(term, {groupMember: true})).pipe(
        map(members => {
          const withSelected = this.selectedMember && !members.some(item => item.id === this.selectedMember.id)
            ? [this.selectedMember, ...members]
            : members;
          return this.withLabels(withSelected);
        }),
        tap(() => this.loading = false),
        catchError(() => {
          this.loading = false;
          return of(this.withLabels(this.selectedMember ? [this.selectedMember] : []));
        })
      );
    }
  }

  private withLabels(members: Member[]): MemberWithLabel[] {
    return members.map(member => ({
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
