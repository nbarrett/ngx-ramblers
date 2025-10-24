import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import {
  faBook,
  faCashRegister,
  faEnvelopeOpenText,
  faIdCard,
  faMailBulk,
  faUnlockAlt,
  faUsersCog
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { BuiltInAnchor, PageContent } from "../../../models/content-text.model";
import { LoginResponse } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { DataPopulationService } from "../data-population.service";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";

@Component({
    selector: "app-admin",
    template: `
      <app-page>
        <app-login-required/>
        @if (loggedIn) {
          <app-dynamic-content [anchor]="BuiltInAnchor.ACTION_BUTTONS" contentPathReadOnly
                               [defaultPageContent]="defaultPageContent"
                               [notifier]="notify">
          </app-dynamic-content>
        }
      </app-page>
    `,
    styleUrls: ["./admin.component.sass"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [PageComponent, LoginRequiredComponent, DynamicContentComponent]
})
export class AdminComponent implements OnInit, OnDestroy, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger(AdminComponent, NgxLoggerLevel.OFF);
  private memberLoginService = inject(MemberLoginService);
  private notifierService = inject(NotifierService);
  private pageContentService = inject(PageContentService);
  private siteEditService = inject(SiteEditService);
  private dataPopulationService = inject(DataPopulationService);
  private authService = inject(AuthService);
  faIdCard = faIdCard;
  faUnlockAlt = faUnlockAlt;
  faEnvelopeOpenText = faEnvelopeOpenText;
  faCashRegister = faCashRegister;
  faUsersCog = faUsersCog;
  faMailBulk = faMailBulk;
  faBook = faBook;
  private subscriptions: Subscription[] = [];
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public loggedIn: boolean;
  public allowAdminEdits: boolean;
  public defaultPageContent: PageContent;

  protected readonly BuiltInAnchor = BuiltInAnchor;

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
  ngOnInit() {
    this.setPrivileges();
    if (this.siteEditService.active()) {
      this.generateDefaultPageContent();
    } else {
      this.subscriptions.push(this.siteEditService.events.subscribe(event => {
        if (event.data) {
          this.generateDefaultPageContent();
        }
      }));
    }
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.allowAdminEdits = this.memberLoginService.allowMemberAdminEdits();
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug(loginResponse, "setPrivileges:allowAdminEdits", this.allowAdminEdits, "this.loggedIn", this.loggedIn);
  }

  private async generateDefaultPageContent(): Promise<void> {
    const content = await this.dataPopulationService.generateDefaultContentTextItems();
    this.logger.info("generated default content text items:", content);
    try {
      this.defaultPageContent = this.dataPopulationService.defaultPageContentForAdminActionButtons();
    } catch (error) {
        this.logger.debug("error:", error);
    }
    const response: PageContent = await this.pageContentService.findByPath(this.defaultPageContent.path);
    this.logger.info("found existing page content", response);
  }
}
