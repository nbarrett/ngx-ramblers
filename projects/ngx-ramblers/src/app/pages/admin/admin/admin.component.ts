import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from "@angular/core";
import { faBook, faCashRegister, faEnvelopeOpenText, faIdCard, faMailBulk, faUnlockAlt, faUsersCog } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { PageContent, PageContentType } from "../../../models/content-text.model";
import { AccessLevel } from "../../../models/member-resource.model";
import { LoginResponse } from "../../../models/member.model";
import { ContentTextService } from "../../../services/content-text.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { PageService } from "../../../services/page.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-admin",
  templateUrl: "./admin.component.html",
  styleUrls: ["./admin.component.sass"],
  changeDetection: ChangeDetectionStrategy.Default
})
export class AdminComponent implements OnInit, OnDestroy, OnDestroy {
  faIdCard = faIdCard;
  faUnlockAlt = faUnlockAlt;
  faEnvelopeOpenText = faEnvelopeOpenText;
  faCashRegister = faCashRegister;
  faUsersCog = faUsersCog;
  faMailBulk = faMailBulk;
  faBook = faBook;
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public loggedIn: boolean;
  public allowAdminEdits: boolean;
  public defaultPageContent: PageContent;

  constructor(private pageService: PageService,
              private memberLoginService: MemberLoginService,
              private notifierService: NotifierService,
              public pageContentService: PageContentService,
              public contentTextService: ContentTextService,
              private authService: AuthService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(AdminComponent, NgxLoggerLevel.OFF);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngOnInit() {
    this.generateActionButtons();
    this.setPrivileges();
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.allowAdminEdits = this.memberLoginService.allowMemberAdminEdits();
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug(loginResponse, "setPrivileges:allowAdminEdits", this.allowAdminEdits, "this.loggedIn", this.loggedIn);
  }

  private async generateActionButtons() {
    const ADMIN_ACTION_BUTTONS = "admin#action-buttons";
    this.defaultPageContent = {
      path: ADMIN_ACTION_BUTTONS, rows: [
        {
          maxColumns: 3,
          showSwiper: false,
          type: PageContentType.ACTION_BUTTONS,
          columns: [
            {
              accessLevel: AccessLevel.loggedInMember,
              title: "Contact details",
              icon: "faIdCard",
              href: "admin/contact-details",
              contentTextId: (await this.contentTextService.findByNameAndCategory("personal-details-help", "admin"))?.id
            },
            {
              accessLevel: AccessLevel.loggedInMember,
              title: "Change Password",
              icon: "faUnlockAlt",
              href: "admin/change-password",
              contentTextId: (await this.contentTextService.findByNameAndCategory("member-login-audit-help", "admin"))?.id
            },
            {
              accessLevel: AccessLevel.loggedInMember,
              title: "Email subscriptions",
              icon: "faEnvelopeOpenText",
              href: "admin/email-subscriptions",
              contentTextId: (await this.contentTextService.findByNameAndCategory("contact-preferences-help", "admin"))?.id
            },
            {
              accessLevel: AccessLevel.loggedInMember,
              title: "Expenses",
              icon: "faCashRegister",
              href: "admin/expenses",
              contentTextId: (await this.contentTextService.findByNameAndCategory("expenses-help", "admin"))?.id
            },
            {
              accessLevel: AccessLevel.committee,
              title: "Member Admin",
              icon: "faUsersCog",
              href: "admin/member-admin",
              contentTextId: (await this.contentTextService.findByNameAndCategory("member-admin-help", "admin"))?.id
            },
            {
              accessLevel: AccessLevel.committee,
              title: "Member Bulk Load",
              icon: "faMailBulk",
              href: "admin/member-bulk-load",
              contentTextId: (await this.contentTextService.findByNameAndCategory("bulk-load-help", "admin"))?.id
            },
            {
              accessLevel: AccessLevel.committee,
              title: "Member Login Audit",
              icon: "faBook",
              href: "admin/member-login-audit",
              contentTextId: (await this.contentTextService.findByNameAndCategory("member-login-audit-help", "admin"))?.id
            },
            {
              accessLevel: AccessLevel.committee,
              title: "System Settings",
              icon: "faCogs",
              href: "admin/system-settings",
              contentTextId: null
            },
            {
              accessLevel: AccessLevel.committee,
              title: "Committee Settings",
              icon: "faUsersCog",
              href: "admin/committee-settings",
              contentTextId: null
            },
            {
              accessLevel: AccessLevel.committee,
              title: "Mailchimp Settings",
              icon: "faMailBulk",
              href: "admin/mailchimp-settings",
              contentTextId: null
            },
            {
              accessLevel: AccessLevel.committee,
              title: "Configure Banners",
              icon: "faImages",
              href: "admin/banners",
              contentTextId: null
            },
          ]
        }]
    };
    this.pageContentService.findByPath(ADMIN_ACTION_BUTTONS)
      .then((response: PageContent) => {
        this.logger.debug("found existing page content", response);
      })
      .catch(error => {
        this.logger.debug("error:", error);
      });
  }

}
