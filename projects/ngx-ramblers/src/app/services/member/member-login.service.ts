import { Injectable } from "@angular/core";
import isEmpty from "lodash-es/isEmpty";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { MemberCookie } from "../../models/member.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";

@Injectable({
  providedIn: "root"
})

export class MemberLoginService {
  private logger: Logger;

  constructor(
    private authService: AuthService,
    private urlService: UrlService,
    loggerFactory: LoggerFactory) {
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
