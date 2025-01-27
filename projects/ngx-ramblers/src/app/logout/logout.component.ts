import { Component, inject, OnDestroy, OnInit } from "@angular/core";
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

  private logger: Logger = inject(LoggerFactory).createLogger("LogoutComponent", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.logger.info("created");
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
        this.authService.logout();
      }
    ));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
