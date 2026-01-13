import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { NamedEventType } from "../../../../models/broadcast.model";
import {
  MailchimpCampaignListResponse,
  MailchimpConfig,
  MailchimpListingResponse
} from "../../../../models/mailchimp.model";
import { BroadcastService } from "../../../../services/broadcast-service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../../services/mailchimp-config.service";
import { MailchimpLinkService } from "../../../../services/mailchimp/mailchimp-link.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { UrlService } from "../../../../services/url.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { Organisation } from "../../../../models/system.model";
import { Subscription } from "rxjs";
import { MailchimpListService } from "../../../../services/mailchimp/mailchimp-list.service";
import { MailchimpCampaignService } from "projects/ngx-ramblers/src/app/services/mailchimp/mailchimp-campaign.service";
import { PageComponent } from "../../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { MailchimpListSettingsComponent } from "./mailchimp-list-settings";
import { MailchimpSegmentEditorComponent } from "./mailchimp-segment-editor";
import { MailchimpContactComponent } from "./mailchimp-contact";
import { MailchimpCampaignDefaultsComponent } from "./mailchimp-campaign-defaults";
import { NgClass } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { InputSize } from "../../../../models/ui-size.model";

@Component({
    selector: "app-mailchimp-settings",
    template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          @if (mailchimpConfig) {
            <tabset class="custom-tabset">
              <tab heading="General">
                <div class="img-thumbnail thumbnail-admin-edit">
                  @if (mailchimpConfig) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Global Settings</div>
                      <div class="col-sm-12">
                        <div class="form-check">
                          <input [(ngModel)]="mailchimpConfig.mailchimpEnabled"
                            type="checkbox" class="form-check-input" id="mailchimp-enabled">
                          <label class="form-check-label"
                            for="mailchimp-enabled">Enable Mailchimp Integration
                          </label>
                        </div>
                        <div class="form-check mt-2">
                          <input [(ngModel)]="mailchimpConfig.allowSendCampaign"
                            type="checkbox" class="form-check-input" id="allow-send-campaign">
                          <label class="form-check-label"
                            for="allow-send-campaign">Allow Send Campaign
                          </label>
                        </div>
                        <div class="form-group">
                          <label for="api-url">API Url</label>
                          <input [(ngModel)]="mailchimpConfig.apiUrl" type="text" class="form-control input-sm"
                            id="api-url"
                            placeholder="The Url endpoint for the mailchimp api">
                        </div>
                        <div class="form-group">
                          <label for="api-key">API Key</label>
                          <app-secret-input
                            [(ngModel)]="mailchimpConfig.apiKey"
                            id="api-key"
                            name="apiKey"
                            [size]="InputSize.SM"
                            placeholder="The API key for the mailchimp api">
                          </app-secret-input>
                        </div>
                      </div>
                    </div>
                  }
                  <div class="thumbnail-heading-frame">
                    <div class="thumbnail-heading">List Settings</div>
                    <app-mailchimp-list-settings label="General"
                      [mailchimpListingResponse]="mailchimpListingResponse"
                      [notify]="notify"
                      [notReady]="notReady()"
                      [mailchimpConfig]="mailchimpConfig"
                      [listType]="'general'">
                    </app-mailchimp-list-settings>
                    <app-mailchimp-list-settings label="Walks"
                      [mailchimpListingResponse]="mailchimpListingResponse"
                      [notify]="notify"
                      [notReady]="notReady()"
                      [mailchimpConfig]="mailchimpConfig"
                      [listType]="'walks'">
                    </app-mailchimp-list-settings>
                    <app-mailchimp-list-settings label="Social Events"
                      [mailchimpListingResponse]="mailchimpListingResponse"
                      [notify]="notify"
                      [notReady]="notReady()"
                      [mailchimpConfig]="mailchimpConfig"
                      [listType]="'socialEvents'">
                    </app-mailchimp-list-settings>
                  </div>
                  @if (mailchimpConfig) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Mailchimp Segments</div>
                      <app-mailchimp-segment-editor [segments]="mailchimpConfig.segments.general">
                      </app-mailchimp-segment-editor>
                    </div>
                  }
                </div>
              </tab>
              <tab heading="Defaults">
                <div class="img-thumbnail thumbnail-admin-edit">
                  @if (mailchimpConfig.contactDefaults) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Contact Defaults</div>
                      <app-mailchimp-contact [mailchimpContact]="mailchimpConfig.contactDefaults"></app-mailchimp-contact>
                    </div>
                  }
                  <div class="thumbnail-heading-frame">
                    <div class="thumbnail-heading">Campaign Defaults</div>
                    <app-mailchimp-campaign-defaults [campaignDefaults]="mailchimpConfig.campaignDefaults">
                    </app-mailchimp-campaign-defaults>
                  </div>
                </div>
              </tab>
              <tab [heading]="'Walks'">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Walk Leader</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="walks-campaign">Campaign Master</label>
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <select id="walks-campaign"
                            [(ngModel)]="mailchimpConfig.campaigns.walkNotification.campaignId"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.walkNotification?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="walks-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.walkNotification.name"
                          id="walks-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                </div>
              </tab>
              <tab [heading]="'Social Events'">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Social Events</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="social-events-campaign">Campaign Master</label>
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <select [(ngModel)]="mailchimpConfig.campaigns.socialEvents.campaignId"
                            id="social-events-campaign"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.socialEvents?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="social-events-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.socialEvents.name"
                          id="social-events-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                </div>
              </tab>
              <tab [heading]="'Committee'">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">AGM and Committee</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="committee-campaign-master">Campaign Master</label>
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <select [(ngModel)]="mailchimpConfig.campaigns.committee.campaignId"
                            id="committee-campaign-master"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.committee?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="committee-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.committee.name"
                          id="committee-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Newsletter</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="newsletter-campaign">Campaign Master</label>
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <select [(ngModel)]="mailchimpConfig.campaigns.newsletter.campaignId"
                            id="newsletter-campaign"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.newsletter?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="newsletter-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.newsletter.name"
                          id="newsletter-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                </div>
              </tab>
              <tab [heading]="'Expenses'">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Expenses</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="expenses-campaign">Campaign Master</label>
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <select
                            [(ngModel)]="mailchimpConfig.campaigns.expenseNotification.campaignId"
                            id="expenses-campaign"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.expenseNotification?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="expenses-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.expenseNotification.name"
                          id="expenses-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                </div>
              </tab>
              <tab [heading]="'Passwords'">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Password Reset</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="password-reset-campaign">Campaign Master</label>
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <select [(ngModel)]="mailchimpConfig.campaigns.passwordReset.campaignId"
                            id="password-reset-campaign"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.passwordReset?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-8">
                      <div class="form-group">
                        <label for="password-reset-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.passwordReset.name"
                          id="password-reset-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="password-reset-campaign-months-in-past-filter">Months In Past</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.passwordReset.monthsInPast"
                          type="number" id="password-reset-campaign-months-in-past-filter"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Forgotten Password</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="forgot-password-campaign">Campaign Master</label>
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <select
                            [(ngModel)]="mailchimpConfig.campaigns.forgottenPassword.campaignId"
                            id="forgot-password-campaign"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.forgottenPassword?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="forgot-password-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.forgottenPassword.name"
                          id="forgot-password-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                </div>
              </tab>
              <tab [heading]="'Membership'">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Welcome to {{ group?.shortName }}</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="welcome-campaign">Campaign Master</label>
                        <div class="d-inline-flex align-items-center flex-wrap">
                          <select [(ngModel)]="mailchimpConfig.campaigns.welcome.campaignId"
                            id="welcome-campaign"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.welcome?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-8">
                      <div class="form-group">
                        <label for="welcome-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.welcome.name"
                          id="welcome-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="welcome-campaign-months-in-past-filter">Months In Past</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.welcome.monthsInPast"
                          type="number" id="welcome-campaign-months-in-past-filter"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Expired Members - initial notification</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="expired-members-campaign-initial">Campaign Master</label>
                        <div class="d-flex flex-wrap align-items-center gap-2">
                          <select [(ngModel)]="mailchimpConfig.campaigns.expiredMembersWarning.campaignId"
                            id="expired-members-campaign-initial"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.expiredMembersWarning?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-8">
                      <div class="form-group">
                        <label for="expired-members-warning-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.expiredMembersWarning.name"
                          id="expired-members-warning-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="expired-members-warning-campaign-months-in-past-filter">Months In Past</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.expiredMembersWarning.monthsInPast"
                          type="number" id="expired-members-warning-campaign-months-in-past-filter"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                  <div class="row thumbnail-heading-frame">
                    <div class="thumbnail-heading">Expired Members - final notification</div>
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label for="expired-members-campaign">Campaign Master</label>
                        <div class="d-flex flex-wrap align-items-center gap-2">
                          <select [(ngModel)]="mailchimpConfig.campaigns.expiredMembers.campaignId"
                            id="expired-members-campaign"
                            class="form-control input-sm flex-grow-1 me-2">
                            @for (campaign of mailchimpCampaignListResponse?.campaigns; track campaign.id) {
                              <option
                                [ngValue]="campaign.id"
                              [textContent]="campaign.settings.title"></option>
                            }
                          </select>
                          <input type="submit" value="Edit"
                            (click)="editCampaign(mailchimpConfig?.campaigns?.expiredMembers?.campaignId)"
                            title="Edit"
                            [ngClass]="notReady() ? 'btn btn-secondary': 'btn btn-info'" [disabled]="notReady()">
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-8">
                      <div class="form-group">
                        <label for="expired-members-campaign-name">Email Title</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.expiredMembers.name"
                          id="expired-members-campaign-name"
                          class="form-control input-sm">
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="expired-members-campaign-months-in-past-filter">Months In Past</label>
                        <input [(ngModel)]="mailchimpConfig.campaigns.expiredMembers.monthsInPast"
                          type="number" id="expired-members-campaign-months-in-past-filter"
                          class="form-control input-sm">
                      </div>
                    </div>
                  </div>
                </div>
              </tab>
            </tabset>
          }
          @if (notifyTarget.showAlert) {
            <div class="row">
              <div class="col-sm-12 mb-10">
                <div class="alert {{notifyTarget.alert.class}}">
                  <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                  @if (notifyTarget.alertTitle) {
                    <strong>
                    {{ notifyTarget.alertTitle }}: </strong>
                    } {{ notifyTarget.alertMessage }}
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="col-sm-12">
            <input type="submit" value="Save" (click)="save()"
              title="Save notification settings"
              [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
            <input type="submit" value="Cancel" (click)="cancel()"
              title="Cancel without saving"
              [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
          </div>
        </div>
      </app-page>
    `,
    imports: [PageComponent, TabsetComponent, TabDirective, FormsModule, MailchimpListSettingsComponent, MailchimpSegmentEditorComponent, MailchimpContactComponent, MailchimpCampaignDefaultsComponent, NgClass, FontAwesomeModule, SecretInputComponent]
})
export class MailchimpSettingsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("MailchimpSettingsComponent", NgxLoggerLevel.ERROR);
  private mailchimpConfigService = inject(MailchimpConfigService);
  protected readonly InputSize = InputSize;
  private mailchimpCampaignService = inject(MailchimpCampaignService);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private mailchimpLinkService = inject(MailchimpLinkService);
  private mailchimpListService = inject(MailchimpListService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private urlService = inject(UrlService);
  protected dateUtils = inject(DateUtilsService);
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public mailchimpCampaignListResponse: MailchimpCampaignListResponse;
  public campaignSearchTerm: string;
  public mailchimpConfig: MailchimpConfig;
  public mailchimpListingResponse: MailchimpListingResponse;
  public group: Organisation;
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    this.logger.debug("constructed");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.campaignSearchTerm = "Master";
    this.notify.setBusy();
    this.notify.progress({
      title: "Mailchimp Campaigns",
      message: "Getting campaign information matching " + this.campaignSearchTerm
    });
    this.mailchimpConfigService.getConfig()
      .then(mailchimpConfig => {
        this.mailchimpConfig = mailchimpConfig;
        this.logger.info("retrieved mailchimpConfig (pre-validation)", this.mailchimpConfig);
        if (!this.mailchimpConfig.campaignDefaults) {
          this.mailchimpConfigService.setCampaignDefaults(this.mailchimpConfig);
        }
        if (!this.mailchimpConfig.lists) {
          this.mailchimpConfig.lists = {};
        }
        if (!this.mailchimpConfig?.segments?.general) {
          this.mailchimpConfig.segments = {general: this.mailchimpConfigService.SegmentDefaults};
        }
        this.logger.info("retrieved mailchimpConfig (post-validation)", this.mailchimpConfig);
        if (this.mailchimpConfig?.mailchimpEnabled) {
          this.refreshMailchimpCampaigns();
          this.refreshMailchimpLists();
        } else {
          this.notifyMailchimpIntegrationNotEnabled();
        }
      })
      .catch(error => this.notify.error({title: "Failed to query Mailchimp config", message: error}));
    this.broadcastService.on(NamedEventType.MAILCHIMP_LISTS_CHANGED, () => {
      this.logger.info("event received:", NamedEventType.MAILCHIMP_LISTS_CHANGED);
      if (this.mailchimpConfig?.mailchimpEnabled) {
        this.refreshMailchimpLists().then(() => this.notify.hide());
      } else {
        this.notifyMailchimpIntegrationNotEnabled();
      }
    });
    this.broadcastService.on(NamedEventType.ERROR, (error) => {
      this.logger.info("event received:", NamedEventType.ERROR);
      this.notify.error({title: "Unexpected Error Occurred", message: error});
    });
  }

  private notifyMailchimpIntegrationNotEnabled() {
    this.notify.warning({
      title: "Mailchimp Integration not enabled",
      message: "List and campaign dropdowns will not be populated"
    });
  }

  private refreshMailchimpCampaigns() {
    this.mailchimpCampaignService.list({
      concise: true,
      limit: 1000,
      start: 0,
      status: "save",
      query: this.campaignSearchTerm
    }).then((mailchimpCampaignListResponse: MailchimpCampaignListResponse) => {
      this.mailchimpCampaignListResponse = mailchimpCampaignListResponse;
      this.logger.debug("mailchimpCampaignService list mailchimpCampaignListResponse:", mailchimpCampaignListResponse);
      this.notify.success({
        title: "Mailchimp Campaigns",
        message: "Found " + this.mailchimpCampaignListResponse.campaigns.length + " draft campaigns matching " + this.campaignSearchTerm
      });
      this.notify.clearBusy();
    }).catch(error => this.notify.error({title: "Failed to query Mailchimp config", message: error}));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private refreshMailchimpLists(): Promise<void> {
    return this.mailchimpListService.lists(this.notify).then((response: MailchimpListingResponse) => {
      this.mailchimpListingResponse = response;
      this.logger.debug("mailchimpListService lists response:", response);
    });
  }

  notReady() {
    if (this.mailchimpConfig && !this.mailchimpConfig.mailchimpEnabled) {
      return false;
    } else {
      return !this.mailchimpCampaignListResponse;
    }
  }

  editCampaign(campaignId) {
    if (this.mailchimpConfig?.mailchimpEnabled) {
      if (!campaignId) {
        this.notify.error({
          title: "Edit Mailchimp Campaign",
          message: "Please select a campaign from the drop-down before choosing edit"
        });
      } else {
        this.notify.hide();
        const webId = this.mailchimpCampaignListResponse.campaigns.find(campaign => campaign.id === campaignId).web_id;
        this.logger.debug("editCampaign:campaignId", campaignId, "web_id", webId);
        return window.open(`${this.mailchimpLinkService.campaignEdit(webId)}`, "_blank");
      }
    } else {
      this.notifyMailchimpIntegrationNotEnabled();
    }
  }

  save() {
    this.logger.debug("saving config", this.mailchimpConfig);
    this.mailchimpConfigService.saveConfig(this.mailchimpConfig)
      .then(() => this.urlService.navigateTo(["admin"]))
      .catch((error) => this.notify.error(error));
  }

  cancel() {
    this.urlService.navigateTo(["admin"]);
  }

}
