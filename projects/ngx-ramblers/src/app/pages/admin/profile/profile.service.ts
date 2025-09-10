import { inject, Injectable } from "@angular/core";
import { isEmpty } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { LoginResponse, Member, ProfileUpdateType } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpListService } from "../../../services/mailchimp/mailchimp-list.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";

@Injectable({
  providedIn: "root"
})

export class ProfileService  {

  private logger: Logger = inject(LoggerFactory).createLogger("ProfileService", NgxLoggerLevel.ERROR);
  private memberService = inject(MemberService);
  private urlService = inject(UrlService);
  private mailchimpListService = inject(MailchimpListService);
  private authService = inject(AuthService);
  private memberLoginService = inject(MemberLoginService);
  filters: any;

  public subscribeToLogout(logger: Logger): Subscription {
    return this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      logger.debug("authService:subscription", loginResponse);
      if (this.memberLoginService.memberLoggedIn()) {
        logger.debug("authService:subscription - member logged in", this.memberLoginService.loggedInMember());
      } else {
        logger.debug("authService:subscription - member not logged in - navigating back", this.memberLoginService.loggedInMember());
        this.urlService.navigateTo(["admin"]);
      }
    });
  }

  backToAdmin() {
    this.urlService.navigateTo(["admin"]);
  }

  queryMember(notify: AlertInstance, profileUpdateType: ProfileUpdateType): Promise<Member> {
    return this.memberService.getById(this.memberLoginService.loggedInMember().memberId)
      .catch(error => {
        notify.error({title: `Error querying ${profileUpdateType}`, message: error});
        return {} as Member;
      });
  }

  undoChangesTo(notify: AlertInstance, profileUpdateType: ProfileUpdateType, member: Member): Promise<any> {
    return this.memberService.getById(this.memberLoginService.loggedInMember().memberId)
      .then(member => {
        if (!isEmpty(member)) {
          notify.showContactUs(false);
          notify.success({title: "Profile", message: `Changes to your ${profileUpdateType} were reverted`});
          return member;
        } else {
          this.saveOrUpdateUnsuccessful(notify, profileUpdateType, "Could not refresh member");
        }
      })
      .catch(error => notify.error({title: "Profile", message: error}));
  }

  saveMemberDetails(notify: AlertInstance, profileUpdateType: ProfileUpdateType, member: Member) {
    this.logger.debug("saveMemberDetails:", profileUpdateType);
    this.mailchimpListService.resetUpdateStatusForMember(member);
    return this.memberService.update(member)
      .then(() => this.saveOrUpdateSuccessful(notify, profileUpdateType))
      .catch((error) => this.saveOrUpdateUnsuccessful(notify, profileUpdateType, error));
  }

  saveOrUpdateSuccessful(notify: AlertInstance, profileUpdateType: ProfileUpdateType) {
    notify.success({title: "Profile updates", message: `Your ${profileUpdateType} were saved successfully and will be effective on your next login`});
  }

  saveOrUpdateUnsuccessful(notify: AlertInstance, profileUpdateType: ProfileUpdateType, errorMessage) {
    const messageDefaulted = errorMessage || "Please try again later.";
    notify.error({title: `${profileUpdateType} update error`, message: `Changes to your ${profileUpdateType} could not be saved. ${messageDefaulted}`});
  }

}
