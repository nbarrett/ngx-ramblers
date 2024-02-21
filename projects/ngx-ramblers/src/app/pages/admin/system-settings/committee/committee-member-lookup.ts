import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";

@Component({
  selector: "app-committee-member-lookup",
  template: `
    <div *ngIf="committeeMember" class="form-group">
      <label [for]="stringUtils.kebabCase('committee-member-lookup',committeeMember?.memberId)">
        Link to Committee Member</label>
      <select [(ngModel)]="committeeMember.memberId"
              [disabled]="disabled"
              (ngModelChange)="publishMember($event)"
              class="form-control" [id]="stringUtils.kebabCase('committee-member-lookup',committeeMember?.memberId)">
        <option *ngFor="let member of committeeQueryService?.committeeMembers"
                [ngValue]="member.id"
                [textContent]="member | fullNameWithAlias">
        </option>
      </select>
    </div>
  `
})
export class CommitteeMemberLookupComponent implements OnInit {

  @Input() committeeMember: CommitteeMember;
  @Input() disabled: boolean;
  @Output() memberChange: EventEmitter<Member> = new EventEmitter();
  @Output() committeeMemberChange: EventEmitter<Member> = new EventEmitter();

  private logger: Logger;

  constructor(public committeeQueryService: CommitteeQueryService,
              public stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CommitteeMemberLookupComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    if (!this.committeeMember) {
      this.committeeMember = {fullName: null, email: null, type: null, description: null};
    }
    this.logger.debug("ngOnInit", this.committeeMember);
  }

  publishMember(memberId: string) {
    const member = this.committeeQueryService?.committeeMembers?.find(item => item.id === memberId);
    this.memberChange.next(member);
  }
}
