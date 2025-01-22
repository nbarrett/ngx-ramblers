import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember, RoleType } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { KEY_NULL_VALUE_NONE } from "../../../../functions/enums";

@Component({
  selector: "app-committee-member-lookup",
  template: `
    <div *ngIf="committeeMember" class="form-group">
      <label for="committee-member-lookup-{{committeeMember.type}}">
        Link to Committee Member</label>
      <select [(ngModel)]="committeeMember.memberId" [compareWith]="valueComparer"
              [disabled]="disabled"
              (ngModelChange)="publishMember($event)"
              class="form-control" id="committee-member-lookup-{{committeeMember.type}}">
        <option>{{ KEY_NULL_VALUE_NONE.value }}</option>
        <option *ngFor="let member of committeeQueryService?.committeeMembers"
                [ngValue]="member.id">{{member | fullNameWithAlias}}</option>
      </select>
    </div>
  `,
  standalone: false
})
export class CommitteeMemberLookupComponent implements OnInit {
  public committeeQueryService: CommitteeQueryService = inject(CommitteeQueryService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger: Logger = this.loggerFactory.createLogger("CommitteeMemberLookupComponent", NgxLoggerLevel.ERROR);
  @Input() committeeMember: CommitteeMember;
  @Input() disabled: boolean;
  @Output() memberChange: EventEmitter<Member> = new EventEmitter();
  protected readonly KEY_NULL_VALUE_NONE = KEY_NULL_VALUE_NONE;


  valueComparer(item1: string, item2: string): boolean {

    function replaceWithNull(item: string): string {
      return item === KEY_NULL_VALUE_NONE.value ? null : item;
    }

    return replaceWithNull(item1) === replaceWithNull(item2);
  }

  ngOnInit() {
    if (!this.committeeMember) {
      this.committeeMember = {
        fullName: null,
        email: null,
        type: null,
        description: null,
        roleType: RoleType.COMMITTEE_MEMBER
      };
    }
    this.logger.debug("ngOnInit", this.committeeMember);
  }

  publishMember(memberId: string) {
    this.logger.info("publishMember:", memberId);
    if (memberId === KEY_NULL_VALUE_NONE.value) {
      this.committeeMember.memberId = null;
    } else if (memberId) {
      const member = this.committeeQueryService?.committeeMembers?.find(item => item.id === memberId);
      this.memberChange.next(member);
    }
  }
}
