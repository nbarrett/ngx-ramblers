import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { LoginResponse } from "../../../models/member.model";
import { Organisation } from "../../../models/system.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { SystemConfigService } from "../../../services/system/system-config.service";

@Component({
    selector: "app-login-required",
    templateUrl: "./login-required.html",
    styleUrls: ["./login-required.sass"],
    changeDetection: ChangeDetectionStrategy.Default
})
export class LoginRequiredComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("LoginRequiredComponent", NgxLoggerLevel.ERROR);
  private memberLoginService = inject(MemberLoginService);
  private authService = inject(AuthService);
  private systemConfigService = inject(SystemConfigService);

  private subscriptions: Subscription[] = [];
  public loggedIn: boolean;
  public group: Organisation;

  ngOnInit() {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.subscriptions.push(this.authService.authResponse()
      .subscribe((loginResponse: LoginResponse) => this.loggedIn = this.memberLoginService.memberLoggedIn()));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
