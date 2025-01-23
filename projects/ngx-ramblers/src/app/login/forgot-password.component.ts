import { Component, OnInit } from "@angular/core";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../auth/auth.service";
import { ForgotPasswordModalComponent } from "../pages/login/forgot-password-modal/forgot-password-modal.component";
import { Logger, LoggerFactory } from "../services/logger-factory.service";

@Component({
    selector: "app-forgot-password",
    template: ""
})

export class ForgotPasswordComponent implements OnInit {
  private logger: Logger;

  constructor(private authService: AuthService,
              private modalService: BsModalService,
              private loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ForgotPasswordComponent, NgxLoggerLevel.OFF);
    this.logger.debug("constructed");
  }

  ngOnInit() {
    this.authService.logout();
    this.modalService.show(ForgotPasswordModalComponent, {
      animated: false
    });
  }

}
