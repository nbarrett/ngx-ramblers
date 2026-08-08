import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { BuiltInAnchor, PageContent, PageContentPath, PageContentType } from "../../../models/content-text.model";
import { AccessLevel } from "../../../models/member-resource.model";
import { LoginResponse } from "../../../models/member.model";
import { AdminPlatformPath } from "../../../models/admin-route-paths.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageContentService } from "../../../services/page-content.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";

@Component({
  selector: "app-environment-management-landing",
  template: `
    <app-page>
      <app-login-required/>
      @if (loggedIn) {
        @if (!platformAdminEnabled) {
          <div class="alert alert-warning" role="alert">
            Environment management is not available on this site. This feature is only enabled on platform admin environments.
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
export class EnvironmentManagementLandingComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger(EnvironmentManagementLandingComponent, NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private notifierService = inject(NotifierService);
  private pageContentService = inject(PageContentService);
  private siteEditService = inject(SiteEditService);
  private authService = inject(AuthService);
  private environmentSetupService = inject(EnvironmentSetupService);

  private subscriptions: Subscription[] = [];
  notify: AlertInstance;
  notifyTarget: AlertTarget = {};
  loggedIn = false;
  platformAdminEnabled = false;
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
      path: PageContentPath.ENVIRONMENT_MANAGEMENT_ACTION_BUTTONS,
      rows: [{
        maxColumns: 3,
        showSwiper: false,
        type: PageContentType.ACTION_BUTTONS,
        columns: [
          {
            href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP,
            title: "Environment Setup",
            icon: "faServer",
            contentText: "Provision new NGX-Ramblers environments for Ramblers groups",
            accessLevel: AccessLevel.ENVIRONMENT_ADMIN
          },
          {
            href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_BACKUP,
            title: "Backup & Restore",
            icon: "faDatabase",
            contentText: "Backup and restore MongoDB databases across environments",
            accessLevel: AccessLevel.ENVIRONMENT_ADMIN
          },
          {
            href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_HEALTH,
            title: "Environments Monitoring",
            icon: "faHeartbeat",
            contentText: "Monitor migration status and health across all environments",
            accessLevel: AccessLevel.ENVIRONMENT_ADMIN
          },
          {
            href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_MIGRATION,
            title: "Environment Migration",
            icon: "faExchangeAlt",
            contentText: "Move an environment to isolated MongoDB credentials with validation, restore verification, and explicit cutover",
            accessLevel: AccessLevel.ENVIRONMENT_ADMIN
          },
          {
            href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_ESTATE_REBUILD,
            title: "Estate Rebuild Capture",
            icon: "faClipboardList",
            contentText: "Generate the private credential inventory for every site (no secret values)",
            accessLevel: AccessLevel.ENVIRONMENT_ADMIN
          }
        ]
      }]
    };
    if (this.siteEditService.active()) {
      await this.loadPageContent();
    } else {
      this.subscriptions.push(this.siteEditService.events.subscribe(event => {
        if (event.data) {
          this.loadPageContent();
        }
      }));
    }
    try {
      const status = await this.environmentSetupService.status();
      this.platformAdminEnabled = status.platformAdminEnabled;
    } catch (error) {
      this.logger.error("Failed to check platform admin status:", error);
      this.platformAdminEnabled = false;
    }
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug(loginResponse, "setPrivileges:loggedIn", this.loggedIn);
  }

  private async loadPageContent(): Promise<void> {
    const response: PageContent = await this.pageContentService.findByPath(this.defaultPageContent.path);
    this.logger.info("found existing page content", response);
  }
}
