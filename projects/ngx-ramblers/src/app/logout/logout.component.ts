import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../auth/auth.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";

@Component({
  selector: "app-logout",
  templateUrl: "./logout.component.html"
})
export class LogoutComponent implements OnInit, OnDestroy {
  private logger: Logger;
  private subscriptions: Subscription[] = [];

  constructor(private route: ActivatedRoute,
              private authService: AuthService,
              private loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(LogoutComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
        this.authService.logout();
      }
    ));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
