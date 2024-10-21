import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { ContactUsService } from "../../../contact-us/contact-us.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";

@Component({
  selector: "app-system-recaptcha-settings",
  template: `
    <div class="row img-thumbnail thumbnail-2">
      <div class="thumbnail-heading">reCAPTCHA</div>
      <div class="col-sm-12" *ngIf="config?.recaptcha">
        <div class="row">
          <div class="col-sm-6">
            <div class="row">
              <div class="col-md-12">
                <div class="form-group">
                  <label for="site-key">Site Key (v2)</label>
                  <input [(ngModel)]="config.recaptcha.siteKey"
                         id="site-key"
                         type="text" class="form-control input-sm"
                         placeholder="Enter reCAPTCHA Site Key">
                </div>
              </div>
              <div class="col-md-12">
                <div class="form-group">
                  <label for="recaptcha-secret-key">Secret Key (v2)</label>
                  <input [(ngModel)]="config.recaptcha.secretKey"
                         id="recaptcha-secret-key"
                         type="text" class="form-control input-sm"
                         placeholder="Enter reCAPTCHA Secret Key">
                </div>
              </div>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="form-group">
              Test site reCAPTCHA configuration by clicking the checkbox below:
            </div>
            <div class="form-group">
              <re-captcha *ngIf="config?.recaptcha?.siteKey" (resolved)="onCaptchaResolved($event)"
                          [siteKey]="config?.recaptcha?.siteKey"/>
            </div>
            <div>For more information on how to configure the Site Key and Secret Key, visit the
              <a href="https://www.google.com/recaptcha/about/" target="_blank">reCAPTCHA project site.</a>
            </div>
          </div>
        </div>
        <div *ngIf="notifyTarget.showAlert" class="mt-2 alert {{notifyTarget.alertClass}}">
          <fa-icon [icon]="notifyTarget.alert.icon"/>
          <strong *ngIf="notifyTarget.alertTitle">
            {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
        </div>
      </div>
    </div>`,
})
export class SystemRecaptchaSettingsComponent implements OnInit, OnDestroy {

  @Input({required: true}) public config: SystemConfig;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public contactUsService: ContactUsService = inject(ContactUsService);
  systemConfigService: SystemConfigService = inject(SystemConfigService);
  private notifierService: NotifierService = inject(NotifierService);
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private logger = this.loggerFactory.createLogger("SystemRecaptchaSettingsComponent", NgxLoggerLevel.ERROR);

  ngOnInit() {
    if (!this.config?.recaptcha) {
      this.config.recaptcha = this.systemConfigService.recaptchaDefaults();
    }
    this.logger.info("constructed:", this.config.recaptcha);
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy");
  }

  onCaptchaResolved(captchaToken: string) {
    this.logger.info("Captcha resolved with response:", captchaToken);
    this.contactUsService.validateToken({captchaToken})
      .then((response) => this.notify.success({title: "Captcha validation", message: "Validation was successful!"}))
      .catch((error) => this.notify.error({title: "Failed to send email", message: error}));
  }

}
