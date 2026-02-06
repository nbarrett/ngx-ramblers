import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { MailingPreferencesModalComponent } from "../../mailing-preferences/mailing-preferences-modal.component";
import { ForgotPasswordModalComponent } from "../forgot-password-modal/forgot-password-modal.component";
import { ResetPasswordModalComponent } from "../reset-password-modal/reset-password-modal.component";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Organisation } from "../../../models/system.model";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ContactUsComponent } from "../../../committee/contact-us/contact-us";

@Component({
    selector: "app-login-modal-component",
    template: `
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title" id="modal-title-heading">Login to <em>{{ group?.shortName }}</em> site</h4>
        <button type="button" class="close" data-bs-dismiss="modal" (click)="bsModalRef.hide()" aria-hidden="true">&times;
        </button>
      </div>
      <div class="modal-body">
        <form>
          <div class="row">
            <div class="col col-sm-12">
              <div class="form-group">
                <label for="user-name">Email address or username</label>
                <input #userNameInput [(ngModel)]="userName" type="text" (keyup.enter)="login()"
                  class="form-control input-sm" id="user-name" autocomplete="username" name="user-name"
                  placeholder="Enter your email address or username">
              </div>
              <div class="form-group">
                <label for="password">Password</label>
                <input #passwordInput [(ngModel)]="password" type="password" (keyup.enter)="login()"
                  class="form-control input-sm" id="password" autocomplete="current-password" name="password"
                  placeholder="Enter password">
              </div>
            </div>
          </div>
          <div class="row">
            @if (notifyTarget.showAlert) {
              <div class="col col-sm-12 mb-2">
                <div class="alert {{notifyTarget.alertClass}}">
                  <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                  @if (notifyTarget.alertTitle) {
                    <strong>
                    {{ notifyTarget.alertTitle }}: </strong>
                    } {{ notifyTarget.alertMessage }}
                    @if (notifyTarget.showContactUs) {
                      <span> contact our <app-contact-us class="alert-link"
                        roles="membership"
                      text="Membership Administrator"></app-contact-us>.
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        </form>
      </div>
      <div class="modal-footer flex-nowrap gap-1">
          <input type="submit" #loginButton [disabled]="notifyTarget.busy" value="Login"
            (click)="login()"
            title="Login"
            class="btn btn-primary btn-sm">
          <input type="reset" value="Cancel" (click)="close()" title="Cancel and don't login"
            [disabled]="notifyTarget.busy"
            class="btn btn-secondary btn-sm">
          <input type="reset" value="Forgot Password" (click)="forgotPassword()"
            title="I've forgotten my password"
            [disabled]="notifyTarget.busy"
            class="btn btn-warning btn-sm">
      </div>
    </div>`,
    styleUrls: ["./login-modal.component.sass"],
    imports: [FormsModule, FontAwesomeModule, ContactUsComponent]
})
export class LoginModalComponent implements OnInit, OnDestroy, AfterViewInit {
  private logger: Logger = inject(LoggerFactory).createLogger("LoginModalComponent", NgxLoggerLevel.ERROR);
  bsModalRef = inject(BsModalRef);
  private modalService = inject(BsModalService);
  private systemConfigService = inject(SystemConfigService);
  private authService = inject(AuthService);
  private memberLoginService = inject(MemberLoginService);
  private routerHistoryService = inject(RouterHistoryService);
  private notifierService = inject(NotifierService);

  @ViewChild("userNameInput") userNameInput: ElementRef;
  @ViewChild("passwordInput") passwordInput: ElementRef;
  @ViewChild("loginButton") loginButton: ElementRef;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  userName: string;
  password: string;
  private subscriptions: Subscription[] = [];
  public group: Organisation;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.debug("constructed");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse) => {
      this.logger.debug("subscribe:loginResponse", loginResponse);
      if (!loginResponse) {
        this.notify.error({
          continue: true,
          title: "Login failed",
          message: "Please try again"
        });
      } else if (loginResponse.memberLoggedIn) {
        if (!this.memberLoginService.loggedInMember().profileSettingsConfirmed) {
          this.modalService.show(MailingPreferencesModalComponent, {
            class: "modal-xl",
            animated: false,
            show: true,
            initialState: {
              memberId: this.memberLoginService.loggedInMember().memberId
            }
          });
        }
        this.bsModalRef.hide();
        return true;
      } else if (loginResponse.showResetPassword) {
        this.modalService.show(ResetPasswordModalComponent, {
          animated: false,
          backdrop: "static",
          keyboard: false,
          initialState: {
            userName: this.userName,
            message: "Your password has expired, therefore you need to reset it to a new one before continuing."
          }
        });
        this.close();
      } else {
        this.logger.debug("loginResponse", loginResponse);
        this.notify.showContactUs(true);
        this.notify.error({
          continue: true,
          title: "Login failed",
          message: loginResponse.alertMessage
        });
      }
    }));
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.userNameInput.nativeElement.focus();
    }, 0);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private syncFromAutofill() {
    if (this.userNameInput?.nativeElement?.value) {
      this.userName = this.userNameInput.nativeElement.value;
    }
    if (this.passwordInput?.nativeElement?.value) {
      this.password = this.passwordInput.nativeElement.value;
    }
  }

  fieldPopulated(object) {
    return (object || "").length > 0;
  }

  submittable() {
    return this.fieldPopulated(this.userName) && this.fieldPopulated(this.password);
  }

  forgotPassword() {
    this.close();
    this.modalService.show(ForgotPasswordModalComponent, {
      animated: false,
      backdrop: "static",
      keyboard: false
    });
  }

  close() {
    this.routerHistoryService.navigateBackToLastMainPage();
    this.bsModalRef.hide();
  }

  login() {
    this.syncFromAutofill();
    if (!this.submittable()) {
      this.notify.error({
        continue: true,
        title: "Login failed",
        message: "Please enter both a user name and password"
      });
    } else {
      this.notify.showContactUs(false);
      this.notify.setBusy();
      this.notify.progress({
        title: "Logging in",
        message: "using credentials for " + this.userName + " - please wait"
      });
      this.authService.login(this.userName, this.password);
    }
  }
}
