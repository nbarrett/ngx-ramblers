import { Component, Input, OnInit } from "@angular/core";
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { LoginResponse } from "../../../models/member.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalkDisplayService } from "../walk-display.service";

@Component({
  selector: "app-walk-leader",
  templateUrl: "./walk-leader.html",
})

export class WalkLeaderComponent implements OnInit {
  private logger: Logger;

  faEnvelope = faEnvelope;
  faPhone = faPhone;
  public loggedIn: boolean;
  private subscriptions: Subscription[] = [];

  @Input()
  public displayedWalk: DisplayedWalk;

  constructor(
    private memberLoginService: MemberLoginService,
    private authService: AuthService,
    public display: WalkDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkLeaderComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.loggedIn = this.memberLoginService.memberLoggedIn();
    this.logger.debug("initialised with walk", this.displayedWalk, "loggedIn:", this.loggedIn);
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.logger.debug("loginResponseObservable:", loginResponse);
      this.display.refreshCachedData();
      this.loggedIn = loginResponse.memberLoggedIn;
    }));
  }

}
