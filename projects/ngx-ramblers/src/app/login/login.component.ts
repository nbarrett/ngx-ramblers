import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { LoginModalComponent } from "../pages/login/login-modal/login-modal.component";
import { Logger, LoggerFactory } from "../services/logger-factory.service";

@Component({
    selector: "app-login",
    template: ""
})
export class LoginComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("LoginComponent", NgxLoggerLevel.ERROR);
  private modalService = inject(BsModalService);
  route = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.logger.debug("constructed");
    this.subscriptions.push(this.route.paramMap.subscribe(() => {
      this.modalService.show(LoginModalComponent);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
