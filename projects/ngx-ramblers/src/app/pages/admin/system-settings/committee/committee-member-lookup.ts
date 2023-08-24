import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { FullNamePipe } from "../../../../pipes/full-name.pipe";
import { CommitteeQueryService } from "../../../../services/committee/committee-query.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";

@Component({
  selector: "app-committee-member-lookup",
  templateUrl: "./committee-member-lookup.html"
})
export class CommitteeMemberLookupComponent implements OnInit {

  @Input() committeeMember: CommitteeMember;

  @Output() memberChange: EventEmitter<Member> = new EventEmitter();
  @Output() committeeMemberChange: EventEmitter<Member> = new EventEmitter();

  private logger: Logger;

  constructor(private urlService: UrlService,
              public committeeQueryService: CommitteeQueryService,
              public stringUtils: StringUtilsService,
              private fullNamePipe: FullNamePipe,
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
