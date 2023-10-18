import { Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { MemberCookie } from "../../models/member.model";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NumberUtilsService } from "../number-utils.service";
import { UrlService } from "../url.service";

@Injectable({
  providedIn: "root"
})

export class MemberLoginService {
  private logger: Logger;

  constructor(
    private fullNamePipe: FullNamePipe,
    private authService: AuthService,
    private numberUtils: NumberUtilsService,
    private urlService: UrlService,
    private dateUtils: DateUtilsService,
    private loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberLoginService, NgxLoggerLevel.OFF);
  }

  loggedInMember(): MemberCookie {
    const loggedInMember = this.authService.parseAuthPayload() as MemberCookie;
    this.logger.debug("loggedInMember", loggedInMember);
    return loggedInMember;
  }

  allowContentEdits() {
    return this.loggedInMember().contentAdmin;
  }

  allowMemberAdminEdits() {
    return this.loggedInMember().memberAdmin;
  }

  allowFinanceAdmin() {
    return this.loggedInMember().financeAdmin;
  }

  allowCommittee() {
    return this.loggedInMember().committee;
  }

  allowTreasuryAdmin() {
    return this.loggedInMember().treasuryAdmin;
  }

  allowFileAdmin() {
    return this.loggedInMember().fileAdmin;
  }

  memberLoggedIn() {
    return !isEmpty(this.loggedInMember());
  }

  showLoginPromptWithRouteParameter(routeParameter) {
    if (this.urlService.hasRouteParameter(routeParameter) && !this.memberLoggedIn()) {
      this.urlService.navigateTo(["login"]);
    }
  }

  allowWalkAdminEdits(): boolean {
    return this.loggedInMember().walkAdmin;
  }

  allowSocialAdminEdits() {
    return this.loggedInMember().socialAdmin;
  }

  allowSocialDetailView() {
    return this.loggedInMember().socialMember;
  }

}
