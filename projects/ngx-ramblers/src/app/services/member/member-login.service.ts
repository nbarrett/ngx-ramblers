import { inject, Injectable } from "@angular/core";
import { isEmpty } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../auth/auth.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";
import { MemberCookie } from "../../models/member.model";

@Injectable({
  providedIn: "root"
})

export class MemberLoginService {

  private logger: Logger = inject(LoggerFactory).createLogger("MemberLoginService", NgxLoggerLevel.ERROR);
  private authService = inject(AuthService);
  private urlService = inject(UrlService);

  loggedInMember(): MemberCookie {
    const loggedInMember = this.authService.parseAuthToken() as MemberCookie;
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

  isAdmin(): boolean {
    return this.allowCommittee() ||
      this.allowContentEdits() ||
      this.allowMemberAdminEdits() ||
      this.allowFinanceAdmin() ||
      this.allowTreasuryAdmin() ||
      this.allowFileAdmin() ||
      this.allowWalkAdminEdits() ||
      this.allowSocialAdminEdits();
  }

}
