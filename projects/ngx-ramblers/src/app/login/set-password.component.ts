import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../auth/auth.service";
import { AlertTarget } from "../models/alert-target.model";
import { ResetPasswordModalComponent } from "../pages/login/reset-password-modal/reset-password-modal.component";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { MemberService } from "../services/member/member.service";
import { AlertInstance, NotifierService } from "../services/notifier.service";

@Component({
  selector: "app-set-password",
  template: ""
})

export class SetPasswordComponent implements OnInit, OnDestroy {
  private logger: Logger;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private subscriptions: Subscription[] = [];

  constructor(private modalService: BsModalService,
              private notifierService: NotifierService,
              private memberService: MemberService,
              private authService: AuthService,
              private route: ActivatedRoute, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SetPasswordComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.debug("constructed");
    this.authService.logout();
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const passwordResetId = paramMap.get("password-reset-id");
      this.memberService.getMemberByPasswordResetId(passwordResetId)
        .then(member => {
          this.logger.debug("for password-reset-id", passwordResetId, "member", member);
          this.modalService.show(ResetPasswordModalComponent, {
            animated: false,
            initialState: {userName: member.userName, invalidPasswordLink: false}
          });
        })
        .catch((error) => {
          this.logger.debug("error", error);
          this.modalService.show(ResetPasswordModalComponent, {
            animated: false,
            initialState: {invalidPasswordLink: true}
          });
        });
    }, (error) => {
      this.logger.debug("error", error);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
