import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { ALERT_ERROR, AlertTarget } from "../../../../models/alert-target.model";
import { MailProvider, SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { MeetupService } from "../../../../services/meetup.service";
import { MeetupAuthToken, MeetupRequestAuthorisationResponse } from "../../../../models/meetup-authorisation.model";
import { HttpErrorResponse } from "@angular/common/http";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { UrlService } from "../../../../services/url.service";
import { cloneDeep } from "es-toolkit/compat";
import { isEqual } from "es-toolkit/compat";
import { FormsModule } from "@angular/forms";
import { MeetupButtonComponent } from "../../../../modules/common/third-parties/meetup-button";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-system-meetup-settings",
    template: `
    <div class="row img-thumbnail thumbnail-2">
      <div class="thumbnail-heading">Meetup</div>
      @if (config?.externalSystems.meetup) {
        <div class="col-sm-12">
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetup-group-url">Group Url</label>
                <input [(ngModel)]="config.externalSystems.meetup.groupUrl"
                  id="meetup-group-url"
                  type="text" class="form-control input-sm"
                  placeholder="Enter Meetup Group Url">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetup-group-name">Group Name</label>
                <input [(ngModel)]="config.externalSystems.meetup.groupName"
                  id="meetup-group-name"
                  type="text" class="form-control input-sm"
                  placeholder="Enter main site link">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetup-client-secret">Client Secret (Secret)</label>
                <input [(ngModel)]="config.externalSystems.meetup.clientSecret"
                  id="meetup-client-secret"
                  type="text" class="form-control input-sm"
                  placeholder="Enter Meetup OAuth Client 'Secret' value">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetup-client-id">Client Id (Your Key)</label>
                <input [(ngModel)]="config.externalSystems.meetup.clientId"
                  id="meetup-client-id"
                  type="text" class="form-control input-sm"
                  placeholder="Enter Meetup OAuth Client 'Your Key' value">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetup-client-redirect-url">Redirect URL</label>
                <input [(ngModel)]="config.externalSystems.meetup.clientRedirectUrl"
                  id="meetup-client-redirect-url"
                  type="text" class="form-control input-sm"
                  placeholder="Enter Meetup OAuth Redirect URL value">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetup-access-token">Access Token</label>
                <input [(ngModel)]="config.externalSystems.meetup.accessToken"
                  id="meetup-access-token"
                  type="text" class="form-control input-sm"
                  placeholder="Enter Meetup Access Token">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetup-api-key">Refresh Token</label>
                <input [(ngModel)]="config.externalSystems.meetup.refreshToken"
                  id="meetup-api-key"
                  type="text" class="form-control input-sm"
                  placeholder="Enter Refresh Token">
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label for="meetup-group-url">Api Url</label>
                <input [(ngModel)]="config.externalSystems.meetup.apiUrl"
                  id="meetup-api-url"
                  type="text" class="form-control input-sm"
                  placeholder="Enter Meetup API Url">
              </div>
            </div>
            <div class="col-md-12">
              <div class="d-inline-flex align-items-center flex-wrap">
                <app-meetup-button button (click)="viewOAuthClients()"
                  title="View OAuth Clients"/>
                <app-meetup-button class="ms-2" button (click)="requestMeetupAuthorisation()"
                  title="Initiate Request Authorisation"/>
              </div>
            </div>
            @if (notifyTarget.showAlert) {
              <div class="col-sm-12">
                <div class="form-group mt-3">
                  <alert [type]="notifyTarget.alert.type">
                    <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                    <strong class="ms-2">{{ notifyTarget.alertTitle }}</strong>
                    <div class="p-2">{{ notifyTarget.alertMessage }}</div>
                  </alert>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>`,
    imports: [FormsModule, MeetupButtonComponent, AlertComponent, FontAwesomeModule]
})
export class SystemMeetupSettingsComponent implements OnInit, OnDestroy {

  public config: SystemConfig;
  private subscriptions: Subscription[] = [];
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private meetupService: MeetupService = inject(MeetupService);
  protected stringUtils: StringUtilsService = inject(StringUtilsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MeetupSettingsComponent", NgxLoggerLevel.ERROR);
  protected meetupAccessToken: MeetupAuthToken;
  private notifierService: NotifierService = inject(NotifierService);
  protected meetupAccessCode: string;
  public notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  protected readonly ALERT_ERROR = ALERT_ERROR;
  private urlService: UrlService = inject(UrlService);

  protected readonly MailProvider = MailProvider;
  private configInitialValue: SystemConfig;

  ngOnInit() {
    this.logger.info("constructed");
    this.subscriptions.push(this.activatedRoute.fragment.subscribe(fragment => {
      const params = new URLSearchParams(fragment);
      if (fragment) {
        const accessToken = params.get("access_token");
        const tokenType = params.get("token_type");
        const expiresIn = +params.get("expires_in");
        const meetupAccessToken: MeetupAuthToken = {
          access_token: accessToken,
          token_type: tokenType,
          expires_in: expiresIn
        };
        if (meetupAccessToken?.access_token) {
          this.meetupAccessToken = meetupAccessToken;
          this.notify.progress({
            title: `Meetup Access Token received`,
            message: `Access ${meetupAccessToken.token_type} Token: ${meetupAccessToken.access_token}`,
          });
        }
        this.logger.info("Extracted fragment values:", meetupAccessToken);
      }
    }));
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe((paramMap: ParamMap) => {
      const code = paramMap["code"];
      if (code) {
        this.meetupAccessCode = code;
        this.logger.info("received meetupAccessCode:", this.meetupAccessCode);
        this.notify.warning({
          title: `Requesting Meetup Access Token`,
          message: `Using Access Code ${this.meetupAccessCode}`,
        });
        return this.meetupService.requestAccess(this.meetupAccessCode)
          .then(requestAccessResponse => {
            this.urlService.removeQueryParameter("code");
            this.logger.info("requestAccess requestAccessResponse", requestAccessResponse);
            this.notify.warning({
              title: `Meetup Access Response received`,
              message: `About to refresh ${requestAccessResponse.refresh_token}`,
            });
            return this.meetupService.refreshToken(requestAccessResponse.refresh_token)
              .then(refreshTokenResponse => {
                this.logger.info("refresh token requestAccessResponse", refreshTokenResponse);
                this.notify.success({
                  title: `Meetup Access Token refresh was successful`,
                  message: `Capturing access token value ${refreshTokenResponse.access_token} and refresh token value ${refreshTokenResponse.refresh_token}. Click Save to permanently store these values.`,
                });
                this.config.externalSystems.meetup.accessToken = refreshTokenResponse.access_token;
                this.config.externalSystems.meetup.refreshToken = refreshTokenResponse.refresh_token;
              });
          }).catch(error => {
            this.logger.error("requestAccess error", error);
            this.notify.error({
              title: `Unexpected Error Occurred In Meetup Authentication`,
              message: error,
            });
          });
      }
    }));
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.configInitialValue = cloneDeep(config);
        this.logger.info("retrieved config", config);
      }));
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy");
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async requestMeetupAuthorisation() {
    if (!isEqual(this.configInitialValue, this.config)) {
      this.logger.info("saveConfig started");
      await this.systemConfigService.saveConfig(this.config);
      this.logger.info("saveConfig completed");
    } else {
      this.logger.info("config not changed");
    }
    this.meetupService.requestAuthorisation()
      .then((authorisationResponse: MeetupRequestAuthorisationResponse) => {
        this.notify.progress({
          title: `Meetup Access Request Authorisation`,
          message: `Navigating to  ${authorisationResponse.requestAuthorisationUrl}`,
        });
        this.logger.info("requestMeetupAuthorisation:", authorisationResponse);
        window.open(authorisationResponse.requestAuthorisationUrl);
      })
      .catch((error: HttpErrorResponse) => {
        this.notify.error({
          title: `Unexpected Error Occurred In Meetup Authorisation`,
          message: error,
        });
      });
  }

  viewOAuthClients() {
    window.open("https://www.meetup.com/api/oauth/list/", "_blank");
  }
}
