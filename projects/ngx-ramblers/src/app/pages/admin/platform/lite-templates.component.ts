import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { BuiltInAnchor } from "../../../models/content-text.model";
import { liteHomeTemplatePageContent } from "../../../models/home-content.model";
import { LoginResponse } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-lite-templates",
  template: `
    <app-page>
      <app-login-required/>
      @if (loggedIn) {
        <div class="alert alert-warning" role="alert">
          <fa-icon [icon]="faTriangleExclamation"/>
          Edit the default NGX-Lite home page here. Use {{ placeholderHint }} where the group name should appear.
          Saving environment configuration pushes this template to each lite environment, where it can be applied from the home page.
        </div>
        <app-dynamic-content [anchor]="BuiltInAnchor.HOME_CONTENT" contentPathReadOnly
                             [defaultPageContent]="defaultPageContent"
                             [notifier]="notify">
        </app-dynamic-content>
      }
    </app-page>
  `,
  imports: [PageComponent, LoginRequiredComponent, DynamicContentComponent, FontAwesomeModule]
})
export class LiteTemplatesComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger(LiteTemplatesComponent, NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private notifierService = inject(NotifierService);
  private authService = inject(AuthService);

  private subscriptions: Subscription[] = [];
  notify: AlertInstance;
  notifyTarget: AlertTarget = {};
  loggedIn = false;
  defaultPageContent = liteHomeTemplatePageContent();
  placeholderHint = "{{groupName}}";
  faTriangleExclamation = faTriangleExclamation;

  protected readonly BuiltInAnchor = BuiltInAnchor;

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngOnInit() {
    this.setPrivileges();
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug(loginResponse, "setPrivileges:loggedIn", this.loggedIn);
  }
}
