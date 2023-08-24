import { Component, OnDestroy, OnInit } from "@angular/core";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { Member, ProfileUpdateType } from "../../../models/member.model";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MailchimpListSubscriptionService } from "../../../services/mailchimp/mailchimp-list-subscription.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpListUpdaterService } from "../../../services/mailchimp/mailchimp-list-updater.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ProfileConfirmationService } from "../../../services/profile-confirmation.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { ProfileService } from "./profile.service";
import { faEnvelopeOpenText, faCaretUp, faCashRegister } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-email-subscriptions",
  templateUrl: "./email-subscriptions.component.html",
  styleUrls: ["../admin/admin.component.sass"],
})
export class EmailSubscriptionsComponent implements OnInit, OnDestroy {
  public member: Member;
  private subscriptions: Subscription[] = [];
  faEnvelopeOpenText = faEnvelopeOpenText;

  constructor(private memberService: MemberService,
              private contentMetadata: ContentMetadataService,
              private searchFilterPipe: SearchFilterPipe,
              private modalService: BsModalService,
              private notifierService: NotifierService,
              private dateUtils: DateUtilsService,
              private urlService: UrlService,
              private profileConfirmationService: ProfileConfirmationService,
              private mailchimpListSubscriptionService: MailchimpListSubscriptionService,
              private mailchimpListUpdaterService: MailchimpListUpdaterService,
              private stringUtils: StringUtilsService,
              public profileService: ProfileService,
              private authService: AuthService,
              private mailchimpConfigService: MailchimpConfigService,
              private memberLoginService: MemberLoginService,
              private routerHistoryService: RouterHistoryService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(EmailSubscriptionsComponent, NgxLoggerLevel.OFF);
  }

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public mailchimpConfig: MailchimpConfig;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.subscriptions.push(this.profileService.subscribeToLogout(this.logger));
    this.mailchimpConfigService.getConfig().then(config => this.mailchimpConfig = config);
    this.profileService.queryMember(this.notify, ProfileUpdateType.CONTACT_PREFERENCES).then(member => {
      this.member = member;
      this.notify.clearBusy();
    });
  }

  undoContactPreferences() {
    this.profileService.undoChangesTo(this.notify, ProfileUpdateType.CONTACT_PREFERENCES, this.member).then(member => {
      this.member = member;
    });
  }

  saveContactPreferences() {
    this.profileConfirmationService.confirmProfile(this.member);
    this.profileService.saveMemberDetails(this.notify, ProfileUpdateType.CONTACT_PREFERENCES, this.member);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
