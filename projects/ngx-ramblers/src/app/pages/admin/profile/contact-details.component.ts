import { Component, OnDestroy, OnInit } from "@angular/core";
import { faUnlockAlt, faIdCard } from "@fortawesome/free-solid-svg-icons";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { Member, ProfileUpdateType } from "../../../models/member.model";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpListSubscriptionService } from "../../../services/mailchimp/mailchimp-list-subscription.service";
import { MailchimpListUpdaterService } from "../../../services/mailchimp/mailchimp-list-updater.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ProfileConfirmationService } from "../../../services/profile-confirmation.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { ProfileService } from "./profile.service";

@Component({
  selector: "app-contact-details",
  templateUrl: "./contact-details.component.html",
  styleUrls: ["../admin/admin.component.sass"],
})
export class ContactDetailsComponent implements OnInit, OnDestroy {
  public member: Member;
  faUnlockAlt = faUnlockAlt;
  faIdCard = faIdCard;
  private subscriptions: Subscription[] = [];

  constructor(private authService: AuthService,
              private contentMetadata: ContentMetadataService,
              private dateUtils: DateUtilsService,
              private mailchimpListSubscriptionService: MailchimpListSubscriptionService,
              private mailchimpListUpdaterService: MailchimpListUpdaterService,
              private memberLoginService: MemberLoginService,
              private memberService: MemberService,
              private modalService: BsModalService,
              private notifierService: NotifierService,
              private profileConfirmationService: ProfileConfirmationService,
              private routerHistoryService: RouterHistoryService,
              private searchFilterPipe: SearchFilterPipe,
              private stringUtils: StringUtilsService,
              private urlService: UrlService,
              public profileService: ProfileService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ContactDetailsComponent, NgxLoggerLevel.OFF);
  }

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.notify.setBusy();
    this.profileService.queryMember(this.notify, ProfileUpdateType.PERSONAL_DETAILS).then(member => {
      this.member = member;
      this.notify.clearBusy();
    });
  }

  savePersonalDetails() {
    this.profileService.saveMemberDetails(this.notify, ProfileUpdateType.PERSONAL_DETAILS, this.member);
  }

  undoPersonalDetails() {
    this.profileService.undoChangesTo(this.notify, ProfileUpdateType.PERSONAL_DETAILS, this.member).then(member => {
      this.logger.debug("member:", member);
      this.member = member;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
