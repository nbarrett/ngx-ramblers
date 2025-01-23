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
      @if (systemConfigInternal?.recaptcha) {
        <div class="col-sm-12">
          <div class="row">
            <div class="col-sm-6">
              <div class="row">
                <div class="col-md-12">
                  <div class="form-group">
                    <label for="site-key">Site Key (v2)</label>
                    <input [(ngModel)]="systemConfigInternal.recaptcha.siteKey"
                      id="site-key"
                      type="text" class="form-control input-sm"
                      placeholder="Enter reCAPTCHA Site Key">
                    @if (!systemConfigInternal?.recaptcha?.siteKey) {
                      <div class="mt-1 small text-danger">
                        Site Key is required
                      </div>
                    }
                  </div>
                </div>
                <div class="col-md-12">
                  <div class="form-group">
                    <label for="recaptcha-secret-key">Secret Key (v2)</label>
                    <input [(ngModel)]="systemConfigInternal.recaptcha.secretKey"
                      id="recaptcha-secret-key"
                      type="text" class="form-control input-sm"
                      placeholder="Enter reCAPTCHA Secret Key">
                    @if (!systemConfigInternal?.recaptcha?.secretKey) {
                      <div class="mt-1 small text-danger">
                        Secret Key is required
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                Test site reCAPTCHA configuration by clicking the checkbox below:
              </div>
              <div class="form-group">
                @if (systemConfigInternal?.recaptcha?.siteKey) {
                  <re-captcha (resolved)="onCaptchaResolved($event)"
                    (errored)="onCaptchaErrored($event)"
                    [siteKey]="systemConfigInternal?.recaptcha?.siteKey"/>
                }
              </div>
              <div>For more information on how to configure the Site Key and Secret Key, visit the
                <a href="https://www.google.com/recaptcha/about/" target="_blank">reCAPTCHA project site.</a>
              </div>
            </div>
          </div>
          @if (notifyTarget.showAlert) {
            <div class="mt-2 alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"/>
              @if (notifyTarget.alertTitle) {
                <strong>
                {{ notifyTarget.alertTitle }}: </strong>
                } {{ notifyTarget.alertMessage }}
              </div>
            }
          </div>
        }
      </div>`,
  standalone: false
})
export class SystemRecaptchaSettingsComponent implements OnInit, OnDestroy {

  protected systemConfigInternal: SystemConfig;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public contactUsService: ContactUsService = inject(ContactUsService);
  systemConfigService: SystemConfigService = inject(SystemConfigService);
  private notifierService: NotifierService = inject(NotifierService);
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private logger = this.loggerFactory.createLogger("SystemRecaptchaSettingsComponent", NgxLoggerLevel.ERROR);

  @Input({
    alias: "config",
    required: true
  }) set configValue(systemConfig: SystemConfig) {
    this.handleConfigChange(systemConfig);
  }

  ngOnInit() {
    this.logger.info("constructed:", this.systemConfigInternal.recaptcha);
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy");
  }

  handleConfigChange(systemConfig: SystemConfig) {
    this.systemConfigInternal = systemConfig;
    if (!this.systemConfigInternal?.recaptcha) {
      this.systemConfigInternal.recaptcha = this.systemConfigService.recaptchaDefaults();
    }
    this.logger.info("handleConfigChange:recaptcha:", this.systemConfigInternal.recaptcha);
  }

  onCaptchaResolved(captchaToken: string) {
    this.logger.info("Captcha resolved with response:", captchaToken);
    this.contactUsService.validateToken({captchaToken})
      .then((response) => this.notify.success({
        title: "Captcha validation",
        message: "Validation was successful!"
      }))
      .catch((error) => this.notify.error({title: "Captcha validation", message: error}));
  }

  onCaptchaErrored($event: any[]) {
    this.logger.error("Captcha errored with $event:", $event);
  }
}
