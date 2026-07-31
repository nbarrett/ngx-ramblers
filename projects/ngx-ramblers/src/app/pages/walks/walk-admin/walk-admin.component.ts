import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { BuiltInAnchor, PageContent, PageContentType } from "../../../models/content-text.model";
import { LoginResponse } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { PageService } from "../../../services/page.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";

@Component({
  selector: "app-walk-admin",
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
  styleUrls: ["../../admin/admin/admin.component.sass"],
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, LoginRequiredComponent, DynamicContentComponent]
})
export class WalkAdminComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkAdminComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private notifierService = inject(NotifierService);
  private authService = inject(AuthService);
  private pageService = inject(PageService);

  private subscriptions: Subscription[] = [];
  notify: AlertInstance;
  notifyTarget: AlertTarget = {};
  loggedIn = false;
  defaultPageContent: PageContent;

  protected readonly BuiltInAnchor = BuiltInAnchor;

  ngOnInit() {
    this.setPrivileges();
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
    this.defaultPageContent = {
      path: this.pageService.contentPath(BuiltInAnchor.ACTION_BUTTONS),
      rows: [{
        maxColumns: 3,
        showSwiper: false,
        type: PageContentType.ACTION_BUTTONS,
        columns: []
      }]
    };
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug(loginResponse, "setPrivileges:loggedIn", this.loggedIn);
  }
}
