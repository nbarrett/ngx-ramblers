import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { BuiltInAnchor, PageContent, PageContentPath } from "../../../models/content-text.model";
import { LoginResponse } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { NgxLiteService } from "../../../services/ngx-lite.service";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";

@Component({
  selector: "app-platform-landing",
  template: `
    <app-page>
      <app-login-required/>
      @if (loggedIn) {
        @if (ngxLiteService.ngxLite) {
          <div class="alert alert-warning" role="alert">
            Platform administration is not available in NGX-Lite mode. Switch to full mode in Environment Management to manage environments, setup, and contributor tools.
          </div>
        } @else {
          <app-dynamic-content [anchor]="BuiltInAnchor.ACTION_BUTTONS" contentPathReadOnly
                               [defaultPageContent]="defaultPageContent"
                               [notifier]="notify">
          </app-dynamic-content>
        }
      }
    </app-page>
  `,
  styleUrls: ["../admin/admin.component.sass"],
  imports: [PageComponent, LoginRequiredComponent, DynamicContentComponent]
})
export class PlatformLandingComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger(PlatformLandingComponent, NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private notifierService = inject(NotifierService);
  private authService = inject(AuthService);
  ngxLiteService = inject(NgxLiteService);

  private subscriptions: Subscription[] = [];
  notify: AlertInstance;
  notifyTarget: AlertTarget = {};
  loggedIn = false;
  defaultPageContent: PageContent;

  protected readonly BuiltInAnchor = BuiltInAnchor;

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async ngOnInit() {
    this.setPrivileges();
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
    this.defaultPageContent = {
      path: PageContentPath.ADMIN_PLATFORM_ACTION_BUTTONS,
      rows: [{
        maxColumns: 3,
        showSwiper: false,
        type: "action-buttons" as any,
        columns: []
      }]
    };
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug(loginResponse, "setPrivileges:loggedIn", this.loggedIn);
  }
}
