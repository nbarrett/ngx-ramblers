import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../models/member.model";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { DateUtilsService } from "./date-utils.service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { MemberLoginService } from "./member/member-login.service";

@Injectable({
  providedIn: "root"
})
export class ProfileConfirmationService {
  private logger: Logger;

  constructor(private memberLoginService: MemberLoginService,
              private dateUtils: DateUtilsService,
              private fullName: FullNamePipe, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ProfileConfirmationService, NgxLoggerLevel.OFF);
  }

  confirmProfile(member: Member) {
    if (member) {
      member.profileSettingsConfirmed = true;
      member.profileSettingsConfirmedAt = this.dateUtils.nowAsValue();
      member.profileSettingsConfirmedBy = this.fullName.transform(this.memberLoginService.loggedInMember());
      this.logger.debug("confirmProfile:", member);
    }
  }

  unconfirmProfile(member: Member) {
    if (member) {
      member.profileSettingsConfirmed = false;
      member.profileSettingsConfirmedAt = null;
      member.profileSettingsConfirmedBy = null;
      this.logger.debug("unconfirmProfile:", member);
    }
  }

  processMember(member: Member, profileSettingsConfirmed: boolean) {
    this.logger.debug("processMember:", member, "profileSettingsConfirmed:", profileSettingsConfirmed);
    if (member) {
      if (profileSettingsConfirmed) {
        this.confirmProfile(member);
      } else {
        this.unconfirmProfile(member);
      }
    }
  }
}
