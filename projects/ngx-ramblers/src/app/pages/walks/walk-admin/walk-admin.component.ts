import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from "@angular/core";
import { faMeetup } from "@fortawesome/free-brands-svg-icons";
import { faCalendarPlus, faFileExport } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { LoginResponse } from "../../../models/member.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-walk-admin",
  templateUrl: "./walk-admin.component.html",
  styleUrls: ["./walk-admin.component.sass"],
  changeDetection: ChangeDetectionStrategy.Default
})
export class WalkAdminComponent implements OnInit, OnDestroy {
  allowAdminEdits: boolean;
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  faCalendarPlus = faCalendarPlus;
  faFileExport = faFileExport;
  faMeetup = faMeetup;

  constructor(private memberLoginService: MemberLoginService,
              private authService: AuthService,
              private urlService: UrlService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkAdminComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.setPrivileges();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.setPrivileges(loginResponse)));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private setPrivileges(loginResponse?: LoginResponse) {
    this.allowAdminEdits = this.memberLoginService.allowWalkAdminEdits();
    this.logger.debug("setPrivileges:allowAdminEdits", this.allowAdminEdits);
  }

  selectWalksForExport() {
    this.urlService.navigateTo("walks", "admin", "export");
  }

  addWalkSlots() {
    this.urlService.navigateTo("walks", "admin", "add-walk-slots");
  }

  meetupSettings() {
    this.urlService.navigateTo("walks", "admin", "meetup-settings");
  }
}
