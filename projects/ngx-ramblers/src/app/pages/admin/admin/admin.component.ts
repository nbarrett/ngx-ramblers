import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from "@angular/core";
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
import { PageContent } from "../../../models/content-text.model";
import { LoginResponse } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { DataPopulationService } from "../data-population.service";

@Component({
  selector: "app-admin",
  templateUrl: "./admin.component.html",
  styleUrls: ["./admin.component.sass"],
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: false
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

  constructor(private memberLoginService: MemberLoginService,
              private notifierService: NotifierService,
              public pageContentService: PageContentService,
              private siteEditService: SiteEditService,
              private dataPopulationService: DataPopulationService,
              private authService: AuthService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(AdminComponent, NgxLoggerLevel.OFF);
  }

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
      this.defaultPageContent = await this.dataPopulationService.defaultPageContentForAdminActionButtons();
    } catch (error) {
        this.logger.debug("error:", error);
    }
    const response: PageContent = await this.pageContentService.findByPath(this.defaultPageContent.path);
    this.logger.info("found existing page content", response);
  }
}
