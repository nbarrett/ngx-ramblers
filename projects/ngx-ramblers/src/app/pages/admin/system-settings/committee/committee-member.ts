import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeMember } from "../../../../models/committee.model";
import { Member } from "../../../../models/member.model";
import { FullNamePipe } from "../../../../pipes/full-name.pipe";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";

@Component({
  selector: "app-committee-member",
  templateUrl: "./committee-member.html"
})
export class CommitteeMemberComponent implements OnInit {

  @Input()
  public committeeMember: CommitteeMember;

  private logger: Logger;

  constructor(private urlService: UrlService,
              public stringUtils: StringUtilsService,
              private fullNamePipe: FullNamePipe,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeMemberComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit", this.committeeMember);
  }

  setOtherMemberFields(member: Member) {
    this.logger.debug("setOtherMemberFields:", member);
    this.committeeMember.fullName = this.fullNamePipe.transform(member);
    this.committeeMember.email = member.email;
  }
}
