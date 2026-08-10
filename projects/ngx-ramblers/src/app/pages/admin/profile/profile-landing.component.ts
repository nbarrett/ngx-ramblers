import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faMap } from "@fortawesome/free-solid-svg-icons";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { BuiltInAnchor, PageContent, PageContentPath } from "../../../models/content-text.model";
import { LoginResponse } from "../../../models/member.model";
import { AdminMembersPath } from "../../../models/admin-route-paths.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { VolunteerManagementService } from "../../../services/volunteer-management.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageComponent } from "../../../page/page.component";
import { LoginRequiredComponent } from "../../../modules/common/login-required/login-required";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";

@Component({
  selector: "app-profile-landing",
  template: `
    <app-page>
      <app-login-required/>
      @if (loggedIn) {
        <app-dynamic-content [anchor]="BuiltInAnchor.ACTION_BUTTONS" contentPathReadOnly
                             [defaultPageContent]="defaultPageContent"
                             [notifier]="notify">
        </app-dynamic-content>
        @if (hasVolunteerAssignments) {
          <a class="btn btn-primary mt-3" [routerLink]="['/' + AdminMembersPath.MY_VOLUNTEER_INFORMATION]">
            <fa-icon [icon]="faMap" class="me-2"/>My volunteer information
          </a>
        }
      }
    </app-page>
  `,
  styleUrls: ["../admin/admin.component.sass"],
  imports: [PageComponent, LoginRequiredComponent, DynamicContentComponent, RouterLink, FontAwesomeModule]
})
export class ProfileLandingComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger(ProfileLandingComponent, NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private volunteerManagementService = inject(VolunteerManagementService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private authService = inject(AuthService);

  private subscriptions: Subscription[] = [];
  notify: AlertInstance;
  notifyTarget: AlertTarget = {};
  loggedIn = false;
  hasVolunteerAssignments = false;
  defaultPageContent: PageContent;

  protected readonly BuiltInAnchor = BuiltInAnchor;
  protected readonly AdminMembersPath = AdminMembersPath;
  protected readonly faMap = faMap;

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async ngOnInit() {
    this.setPrivileges();
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => this.checkVolunteerAssignments(systemConfig?.group?.groupCode ?? "")));
    this.defaultPageContent = {
      path: PageContentPath.ADMIN_PROFILE_ACTION_BUTTONS,
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

  private checkVolunteerAssignments(groupCode: string): void {
    if (this.memberLoginService.memberLoggedIn() && groupCode) {
      this.subscriptions.push(this.volunteerManagementService.myInformation(groupCode).subscribe({
        next: information => this.hasVolunteerAssignments = information.parishCount > 0,
        error: error => this.logger.debug("Failed to check volunteer assignments", error)
      }));
    } else {
      this.hasVolunteerAssignments = false;
    }
  }
}
