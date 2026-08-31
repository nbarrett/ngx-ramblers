import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertLevel, AlertMessageAndType, AlertTarget } from "../../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { BroadcastService } from "../../../../services/broadcast-service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { UrlService } from "../../../../services/url.service";
import {
  ListCreateRequest,
  ListCreateResponse,
  MailMessagingConfig,
  MailSettingsTab,
  MAIL_SETTINGS_TAB_REDIRECTS
} from "../../../../models/mail.model";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { Subscription } from "rxjs";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { MailService } from "../../../../services/mail/mail.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { MemberService } from "../../../../services/member/member.service";
import { MemberDefaultsService } from "../../../../services/member/member-defaults.service";
import { Member } from "../../../../models/member.model";
import { Confirm, StoredValue } from "../../../../models/ui-actions";
import { ActivatedRoute, Router } from "@angular/router";
import { kebabCase } from "es-toolkit/compat";
import { NumberUtilsService } from "../../../../services/number-utils.service";
import { first } from "es-toolkit/compat";
import { isEmpty } from "es-toolkit/compat";
import { PageComponent } from "../../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { MailNotificationTemplateEditor } from "./mail-notification-template-editor";
import { NotificationConfigToProcessMappingComponent } from "./notification-config-to-process-mappings";
import { ContentTextEditor } from "../../../../modules/common/tiptap-editor/content-text-editor";
import { FormsModule } from "@angular/forms";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { NgStyle } from "@angular/common";
import { MailListEditorComponent } from "./list-editor";
import { MailListSettingsComponent } from "./mail-list-settings";
import { ListSubscriptionImportExportComponent } from "./list-subscription-import-export";
import { MailSendersListComponent } from "./mail-senders-list";
import { MailDomainsListComponent } from "./mail-domains-list";
import { MailUnsubscribesListComponent } from "./mail-unsubscribes-list";
import { faCircleExclamation, faExclamationTriangle, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { booleanOf } from "../../../../functions/strings";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { InputSize } from "../../../../models/ui-size.model";
import { brevoEmailsSentToday, brevoRemainingDailyEmailCredits } from "../../../../functions/brevo-campaigns";
import { SystemConfig } from "../../../../models/system.model";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { MailProviderSettingsComponent } from "../mail-provider/mail-provider-settings";
import { SystemGmailInboxSettingsComponent } from "../external/system-gmail-inbox-settings";
import { FormSaveActionsComponent } from "../../../../modules/common/form-save-actions/form-save-actions";
import { FormSaveActions } from "../../../../models/form-save-actions.model";
import { ramblersRegisteredOfficeAddress } from "../../../../models/ramblers-legal.model";

@Component({
    selector: "app-mail-settings",
    template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
            <tabset class="custom-tabset">
              <tab [active]="tabActive(MailSettingsTab.EMAIL_CONFIGURATIONS)"
                (selectTab)="selectTab(MailSettingsTab.EMAIL_CONFIGURATIONS)"
                [heading]="MailSettingsTab.EMAIL_CONFIGURATIONS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  @if (mailMessagingConfig?.mailConfig) {
                    <app-mail-notification-template-mapping-editor (tabSelected)="selectTab($event)"
                    (configDeleted)="deletedConfigs.push($event)"></app-mail-notification-template-mapping-editor>
                    @if (notifyTarget.showAlert) {
                      <div class="row mt-3">
                        <div class="col-sm-12">
                          <div class="alert {{notifyTarget.alert.class}}">
                            <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                            @if (notifyTarget.alertTitle) {
                              <strong class="ms-2">{{ notifyTarget.alertTitle }}: </strong>
                            } {{ notifyTarget.alertMessage }}
                          </div>
                        </div>
                      </div>
                    }
                  } @else {
                    <div class="text-center py-4"><fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading...</div>
                  }
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS)"
                (selectTab)="selectTab(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS)"
                [heading]="MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  @if (mailMessagingConfig?.mailConfig) {
                    <app-notification-config-to-process-mapping></app-notification-config-to-process-mapping>
                  } @else {
                    <div class="text-center py-4"><fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading...</div>
                  }
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.MAIL_LIST_SETTINGS)"
                (selectTab)="selectTab(MailSettingsTab.MAIL_LIST_SETTINGS)"
                [heading]="MailSettingsTab.MAIL_LIST_SETTINGS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  @if (mailMessagingConfig?.mailConfig) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">List Settings</div>
                      <div class="col-sm-12 mb-3">
                        <app-content-text-editor standalone category="admin" name="mail-settings-list-settings"/>
                      </div>
                      @if (respectHeadOfficeConsent()) {
                        <div class="col-sm-12 mb-3 px-3">
                          <div class="alert alert-warning mb-0 d-flex align-items-start">
                            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
                            <div>
                              <strong class="d-block">Per-list marketing consent option unavailable</strong>
                              <span>
                                <a href="#" (click)="$event.preventDefault(); selectTab(MailSettingsTab.MAIL_API_SETTINGS)">Respect Head office marketing consent</a>
                                is on (API tab), so it already enforces Head office consent site-wide.
                                The &ldquo;Only auto-subscribe members that have given email marketing consent&rdquo; checkbox on each list is disabled and has no effect.
                                Turn Respect off if you want granular control per list.
                              </span>
                            </div>
                          </div>
                        </div>
                      }
                      <div class="px-3">
                        <div class="row">
                          <div class="col">
                            <h5>{{ stringUtilsService.pluraliseWithCount(mailMessagingConfig?.brevo?.lists?.count, "list") }} {{ stringUtilsService.pluralise(mailMessagingConfig?.brevo?.lists?.count, "exists", "exist") }} in Brevo</h5>
                          </div>
                          @if (!listCreateRequest) {
                            <div class="col-auto">
                              <div class="float-end d-flex gap-2">
                                <app-brevo-button button [title]="updateListsTitle()"
                                                  [disabled]="syncingLists" [loading]="syncingLists"
                                                  (click)="updateLists()"/>
                                <app-brevo-button button title="Create New List" [disabled]="createNewListDisabled()" (click)="createNewList()"/>
                              </div>
                            </div>
                          }
                        </div>
                        @if (notifyTarget.showAlert) {
                          <div class="row mt-3">
                            <div class="col-sm-12">
                              <div class="alert {{ notifyTarget.alertClass }} mb-0">
                                <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                                @if (notifyTarget.alertTitle) {
                                  <strong class="ms-2">{{ notifyTarget.alertTitle }}: </strong>
                                }
                                {{ notifyTarget.alertMessage }}
                              </div>
                              @if (notifyTarget.showProgress) {
                                <div class="progress mt-2" style="height: 24px;">
                                  <div class="progress-bar progress-bar-striped progress-bar-animated"
                                       role="progressbar"
                                       [style.width.%]="notifyTarget.progressPercent || 0"
                                       [attr.aria-valuenow]="notifyTarget.progressPercent || 0"
                                       aria-valuemin="0"
                                       aria-valuemax="100">
                                    @if (notifyTarget.progressPercent) {
                                      {{ notifyTarget.progressPercent }}%
                                    }
                                  </div>
                                </div>
                              }
                            </div>
                          </div>
                        }
                        @if (listCreateRequest) {
                          <app-list-editor [listCreateRequest]="listCreateRequest"></app-list-editor>
                          <div class="row">
                            <div class="col-sm-12">
                              <app-brevo-button button title="Confirm Create List" (click)="confirmCreateList()" [disabled]="listCreateDisabled()"/>
                              <app-brevo-button button title="Cancel Create List" class="ms-2" (click)="listCreateRequest=null"/>
                            </div>
                          </div>
                        }
                        @for (list of mailMessagingConfig?.brevo?.lists?.lists; track list.id) {
                          <app-mail-list-settings [mailMessagingConfig]="mailMessagingConfig" [notify]="notify" [notifyTarget]="notifyTarget" [list]="list" [members]="members"></app-mail-list-settings>
                        }
                        <app-list-subscription-import-export [mailMessagingConfig]="mailMessagingConfig"
                                                             [members]="members" [notify]="notify"
                                                             [notifyTarget]="notifyTarget"/>
                      </div>
                    </div>
                  } @else {
                    <div class="text-center py-4"><fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading...</div>
                  }
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.MAIL_PROVIDER)"
                (selectTab)="selectTab(MailSettingsTab.MAIL_PROVIDER)"
                [heading]="MailSettingsTab.MAIL_PROVIDER">
                <div class="img-thumbnail thumbnail-admin-edit">
                  @if (systemConfig) {
                    <app-mail-provider-settings [config]="systemConfig"
                                                (membersPendingSave)="membersPendingSave = $event"/>
                  } @else {
                    <div class="text-center py-4"><fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading...</div>
                  }
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.GMAIL_INBOX)"
                (selectTab)="selectTab(MailSettingsTab.GMAIL_INBOX)"
                [heading]="MailSettingsTab.GMAIL_INBOX">
                <div class="img-thumbnail thumbnail-admin-edit">
                  @if (systemConfig) {
                    <app-system-gmail-inbox-settings [config]="systemConfig"/>
                  } @else {
                    <div class="text-center py-4"><fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading...</div>
                  }
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.SENDERS)"
                (selectTab)="selectTab(MailSettingsTab.SENDERS)"
                [heading]="MailSettingsTab.SENDERS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <app-mail-senders-list/>
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.DOMAINS)"
                (selectTab)="selectTab(MailSettingsTab.DOMAINS)"
                [heading]="MailSettingsTab.DOMAINS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <app-mail-domains-list/>
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.MAIL_API_SETTINGS)"
                (selectTab)="selectTab(MailSettingsTab.MAIL_API_SETTINGS)"
                [heading]="MailSettingsTab.MAIL_API_SETTINGS">
                <div class="img-thumbnail thumbnail-admin-edit">
                @if (mailMessagingConfig?.mailConfig) {
                  <div class="thumbnail-heading-frame">
                    <div class="thumbnail-heading">Global Settings</div>
                    <div class="row">
                      <div class="col-sm-12 mx-2">
                        <app-content-text-editor standalone category="admin" name="mail-settings-global-help"
                        description="Mail Settings Global Configuration Help"/>
                      </div>
                    </div>
                    <div class="col-sm-12">
                      <div class="p-3 my-3">
                        <div class="form-check">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.allowSendTransactional"
                            type="checkbox" class="form-check-input" id="mail-enabled">
                          <label class="form-check-label" for="mail-enabled">Allow Send Transactional</label>
                        </div>
                        <div class="form-check mt-2">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.allowSendCampaign"
                            type="checkbox" class="form-check-input" id="allow-send-campaign">
                          <label class="form-check-label" for="allow-send-campaign">Allow Send Campaign</label>
                        </div>
                        <div class="form-check mt-2">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.respectHeadOfficeConsent"
                            type="checkbox" class="form-check-input" id="respect-head-office-consent">
                          <label class="form-check-label" for="respect-head-office-consent">Respect Head Office marketing consent</label>
                          <div class="form-text">
                            On by default. When on, members without Head office marketing consent are removed from all lists on bulk load, disabled in the email composer, and skipped when mail is sent.
                            When off, those site-wide rules are not applied, and the per-list option on the
                            <a href="#" (click)="$event.preventDefault(); selectTab(MailSettingsTab.MAIL_LIST_SETTINGS)">Lists</a> tab
                            (&ldquo;Only auto-subscribe members that have given email marketing consent&rdquo;) can give finer control of who is auto-ticked onto each list.
                            While Respect is on, that list option is disabled because it has no effect.
                          </div>
                        </div>
                        <div class="form-check mt-2">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.respectEmailBlocks"
                            type="checkbox" class="form-check-input" id="respect-email-blocks">
                          <label class="form-check-label" for="respect-email-blocks">Respect unsubscribes and blocks</label>
                          <div class="form-text">
                            Off by default. When on, unsubscribed or blocked members are disabled in the composer and skipped at send. Run Update Brevo Mailing Lists first if list changes may not have synced.
                          </div>
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="base-url">Base Url</label>
                        <div class="input-group">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.baseUrl" type="text"
                            class="form-control input-sm" id="base-url"
                            placeholder="The Base Url for the Mail Application">
                          @if (mailLinkService.canNavigateToBrevo) {
                            <app-brevo-button button [disabled]="!mailMessagingConfig?.mailConfig.baseUrl"
                              (click)="mailLinkService.openUrl(mailLinkService.appUrl())"
                            [title]="'View'"/>
                          }
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="my-base-url">My Base Url</label>
                        <div class="input-group">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.myBaseUrl" type="text"
                            class="form-control input-sm" id="my-base-url"
                            placeholder="The Base Url for My Mail Application">
                          @if (mailLinkService.canNavigateToBrevo) {
                            <app-brevo-button button [disabled]="!mailMessagingConfig?.mailConfig.myBaseUrl"
                              (click)="mailLinkService.openUrl(mailLinkService.myBaseUrl())"
                            [title]="'View'"/>
                          }
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="editor-url">Editor Url</label>
                        <div class="input-group">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.editorUrl" type="text"
                            class="form-control input-sm" id="editor-url"
                            autocomplete="off"
                            placeholder="The Base Url for editor of The Mail Application">
                          @if (mailLinkService.canNavigateToBrevo) {
                            <app-brevo-button button [disabled]="!mailMessagingConfig?.mailConfig.editorUrl"
                              (click)="mailLinkService.openUrl(mailLinkService.editorUrl())"
                            [title]="'View'"/>
                          }
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="api-key">API Key</label>
                        <div class="d-flex gap-2 align-items-center">
                          <app-secret-input
                            class="flex-grow-1"
                            [(ngModel)]="mailMessagingConfig.mailConfig.apiKey"
                            (ngModelChange)="apiKeyChanged($event)"
                            id="api-key"
                            [size]="InputSize.SM"
                            autocomplete="off"
                            [ignorePasswordManagers]="true"
                            placeholder="The API key for the mail api"/>
                          @if (mailLinkService.canNavigateToBrevo) {
                            <app-brevo-button class="flex-shrink-0" button [disabled]="!mailMessagingConfig?.mailConfig.baseUrl"
                              (click)="mailLinkService.openUrl(mailLinkService.apiKeysView())"
                            [title]="'View'"/>
                          }
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="smtp-user">SMTP Login</label>
                        <div class="input-group">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.smtpUser" type="text"
                            class="form-control input-sm" id="smtp-user"
                            autocomplete="off"
                            placeholder="Brevo SMTP login (your Brevo account email, used to relay raw MIME for shared-inbox forwarding)">
                          @if (mailLinkService.canNavigateToBrevo) {
                            <app-brevo-button button [disabled]="!mailMessagingConfig?.mailConfig.baseUrl"
                              (click)="mailLinkService.openUrl(mailLinkService.smtpKeysView())"
                            [title]="'View'"/>
                          }
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="smtp-password">SMTP Key</label>
                        <div class="d-flex gap-2 align-items-center">
                          <app-secret-input
                            class="flex-grow-1"
                            [(ngModel)]="mailMessagingConfig.mailConfig.smtpPassword"
                            id="smtp-password"
                            [size]="InputSize.SM"
                            autocomplete="off"
                            [ignorePasswordManagers]="true"
                            placeholder="Brevo SMTP key (separate from the API Key above)"/>
                          @if (mailLinkService.canNavigateToBrevo) {
                            <app-brevo-button class="flex-shrink-0" button [disabled]="!mailMessagingConfig?.mailConfig.baseUrl"
                              (click)="mailLinkService.openUrl(mailLinkService.smtpKeysView())"
                            [title]="'View'"/>
                          }
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="smtp-keepalive-recipient">SMTP Keepalive Recipient</label>
                        <input [(ngModel)]="mailMessagingConfig.mailConfig.smtpKeepaliveRecipient" type="email"
                          class="form-control input-sm" id="smtp-keepalive-recipient"
                          autocomplete="off"
                          [placeholder]="'Defaults to ' + (mailMessagingConfig.mailConfig.smtpUser || 'the SMTP Login above')">
                        <small class="form-text text-muted">Brevo marks an SMTP key inactive after three months without a send. A monthly probe message goes to this address to keep the key alive and to prove the inbound relay still works.</small>
                      </div>
                    </div>
                  </div>
                  @if (pendingApiKeyValidation) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Account Profile</div>
                      <div class="row">
                        <div class="col-sm-12 mb-2">
                          <div class="alert alert-warning mb-0 p-4">
                            <h5><fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>Brevo account needs revalidation</h5>
                            <p class="mb-0">Save settings to validate the API key currently entered above.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  } @else if (mailMessagingConfig.brevo.accountError) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Account Profile</div>
                      <div class="row">
                        <div class="col-sm-12 mb-2">
                          <div class="alert alert-danger mb-0 p-4">
                            <h5><fa-icon [icon]="faExclamationTriangle" class="me-2"></fa-icon>Failed to load Brevo account</h5>
                            <p class="mb-2"><strong>Error:</strong> {{ mailMessagingConfig.brevo.accountError }}</p>
                            @if (mailLinkService.canNavigateToBrevo) {
                              <app-brevo-button button title="Open Brevo Account"
                                (click)="mailLinkService.openUrl(mailLinkService.appUrl())"/>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  } @else if (mailMessagingConfig.brevo.account?.email) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Account Profile</div>
                      <div class="row">
                        <div class="col-sm-12 mt-2 mb-2">
                          <app-content-text-editor standalone category="admin" name="mail-settings-account-help"
                          description="Mail Settings Account Help"/>
                        </div>
                      </div>
                      <div class="row align-items-end">
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="email">Email</label>
                            <div class="form-control-plaintext" id="email">{{ mailMessagingConfig.brevo.account?.email }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="firstName">First Name</label>
                            <div class="form-control-plaintext" id="firstName">{{ mailMessagingConfig.brevo.account?.firstName }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="lastName">Last Name</label>
                            <div class="form-control-plaintext" id="lastName">{{ mailMessagingConfig.brevo.account?.lastName }}</div>
                          </div>
                        </div>
                      </div>
                      <div class="row align-items-end">
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="companyName">Company Name</label>
                            <div class="form-control-plaintext" id="companyName">{{ mailMessagingConfig.brevo.account?.companyName }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="street">Street</label>
                            <div class="form-control-plaintext" id="street">{{ registeredOffice.street }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="postcode">Postcode</label>
                            <div class="form-control-plaintext" id="postcode">{{ registeredOffice.zipCode }}</div>
                          </div>
                        </div>
                      </div>
                      <div class="row align-items-end">
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="town">Town</label>
                            <div class="form-control-plaintext" id="town">{{ registeredOffice.city }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="country">Country</label>
                            <div class="form-control-plaintext">{{ registeredOffice.country }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                  @if (remainingDailyEmailCredits() !== null) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Free Email Plan Usage</div>
                      <div class="row">
                        <div class="col-sm-12">
                          <p>Credits are renewed each day - {{ remainingDailyEmailCredits() }} available out of {{ CREDITS_AVAILABLE }} emails/day ({{ percentageCreditsUsed() }}% used)</p>
                          <div class="progress">
                            <div class="progress-bar" role="progressbar" [ngStyle]="{ 'width': percentageCreditsUsed() + '%' }"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                } @else {
                  <div class="text-center py-4"><fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Loading...</div>
                }
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.UNSUBSCRIBES)"
                (selectTab)="selectTab(MailSettingsTab.UNSUBSCRIBES)"
                [heading]="MailSettingsTab.UNSUBSCRIBES">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <app-mail-unsubscribes-list/>
                </div>
              </tab>
            </tabset>
          </div>
          <div class="col-sm-12">
            <app-form-save-actions
              [disabled]="notReady()"
              [actions]="formSaveActions"/>
          </div>
        </div>
      </app-page>
    `,
    imports: [PageComponent, TabsetComponent, TabDirective, MailNotificationTemplateEditor, NotificationConfigToProcessMappingComponent, ContentTextEditor, FormsModule, BrevoButtonComponent, NgStyle, MailListEditorComponent, MailListSettingsComponent, MailSendersListComponent, MailDomainsListComponent, MailUnsubscribesListComponent, FontAwesomeModule, SecretInputComponent, MailProviderSettingsComponent, SystemGmailInboxSettingsComponent, ListSubscriptionImportExportComponent, FormSaveActionsComponent]
})
export class MailSettingsComponent implements OnInit, OnDestroy {
  public deletedConfigs: string[] = [];
  private acceptNextConfigEmission = false;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public formSaveActions: FormSaveActions = {
    save: () => this.save(),
    saveAndExit: () => this.saveAndExit(),
    undo: () => this.undoChanges(),
    cancel: () => this.cancel()
  };
  public mailMessagingConfig: MailMessagingConfig;
  public pendingApiKeyValidation = false;
  private notifierService: NotifierService = inject(NotifierService);
  public mailLinkService: MailLinkService = inject(MailLinkService);
  private broadcastService: BroadcastService<any> = inject(BroadcastService);
  protected stringUtilsService: StringUtilsService = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);
  private numberUtilsService: NumberUtilsService = inject(NumberUtilsService);
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  private subscriptions: Subscription[] = [];
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  protected mailService: MailService = inject(MailService);
  private memberService: MemberService = inject(MemberService);
  private memberDefaultsService: MemberDefaultsService = inject(MemberDefaultsService);
  protected members: Member[] = [];
  protected membersPendingSave: Member[] = [];
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailSettingsComponent", NgxLoggerLevel.ERROR);
  private error: any;
  public CREDITS_AVAILABLE = 300;
  public confirm: Confirm = new Confirm();
  private tab = kebabCase(MailSettingsTab.EMAIL_CONFIGURATIONS);
  public listCreateRequest: ListCreateRequest;
  public listCreateResponse: ListCreateResponse;
  protected readonly MailSettingsTab = MailSettingsTab;
  protected readonly InputSize = InputSize;
  protected readonly faSpinner = faSpinner;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly registeredOffice = ramblersRegisteredOfficeAddress();

  respectHeadOfficeConsent(): boolean {
    return booleanOf(this.mailMessagingConfig?.mailConfig?.respectHeadOfficeConsent, true);
  }
  private readonly tabRedirects: Record<string, string> = {
    "built-in-process-mappings": kebabCase(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS),
    "mail-api-settings": kebabCase(MailSettingsTab.MAIL_API_SETTINGS),
    "mail-list-settings": kebabCase(MailSettingsTab.MAIL_LIST_SETTINGS),
    "notifications": kebabCase(MailSettingsTab.EMAIL_CONFIGURATIONS)
  };

  public systemConfig: SystemConfig;
  public syncingLists = false;
  private systemConfigService = inject(SystemConfigService);

  ngOnInit() {
    this.logger.debug("constructed");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.refreshMembers();
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(MailSettingsTab.EMAIL_CONFIGURATIONS);
      let tabParameter = params[StoredValue.TAB];
      this.logger.info("received tab value of:", tabParameter, "defaultValue:", defaultValue);
      if (tabParameter) {
        const redirect = this.tabRedirects[tabParameter];
        if (redirect) {
          this.logger.info("redirecting old tab value:", tabParameter, "to:", redirect);
          tabParameter = redirect;
          this.router.navigate([], {
            queryParams: {[StoredValue.TAB]: redirect},
            queryParamsHandling: "merge"
          });
        }
        this.tab = tabParameter;
      } else {
        this.tab = defaultValue;
        this.router.navigate([], {
          queryParams: {[StoredValue.TAB]: defaultValue},
          queryParamsHandling: "merge"
        });
      }
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
    }));
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      if (!this.mailMessagingConfig || this.acceptNextConfigEmission) {
        this.mailMessagingConfig = mailMessagingConfig;
        this.acceptNextConfigEmission = false;
        this.pendingApiKeyValidation = false;
      } else if (mailMessagingConfig?.brevo?.lists && this.mailMessagingConfig.brevo) {
        this.mailMessagingConfig = {
          ...this.mailMessagingConfig,
          brevo: {
            ...this.mailMessagingConfig.brevo,
            lists: mailMessagingConfig.brevo.lists
          }
        };
      }
    }));
    this.broadcastService.on(NamedEventType.MAIL_LISTS_CHANGED, () => {
      this.logger.info("event received:", NamedEventType.MAIL_LISTS_CHANGED);
      this.refreshMailListData();
    });
    this.broadcastService.on(NamedEventType.MAIL_SUBSCRIPTION_CHANGED, () => {
      this.logger.info("event received:", NamedEventType.MAIL_SUBSCRIPTION_CHANGED);
      this.refreshMailListData();
    });
    this.broadcastService.on(NamedEventType.NOTIFY_MESSAGE, (namedEvent: NamedEvent<AlertMessageAndType>) => {
      this.logger.info("event received:", namedEvent);
      if (!this.error) {
        switch (namedEvent.data.type) {
        case AlertLevel.ALERT_ERROR:
          this.error = namedEvent.data.message;
          this.notify.error(namedEvent.data.message);
          break;
        case AlertLevel.ALERT_WARNING:
          this.notify.warning(namedEvent.data.message);
          break;
        case AlertLevel.ALERT_INFO:
          this.notify.warning(namedEvent.data.message);
          break;
        case AlertLevel.ALERT_SUCCESS:
          this.notify.success(namedEvent.data.message);
          break;
        }
      }
    });
    this.broadcastService.on(NamedEventType.ERROR, (error) => {
      this.logger.error("event received:", error);
      this.notify.error({title: "Unexpected Error Occurred", message: error.data});
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private async refreshMembers(): Promise<void> {
    this.members = await this.memberService.all();
  }

  private async refreshMailListData(): Promise<void> {
    await this.refreshMembers();
    await this.mailMessagingService.refreshBrevoLists();
  }

  confirmCreateList() {
    if (!this.listCreateDisabled()) {
      this.mailService.createList(this.listCreateRequest)
        .then(response => {
          this.listCreateResponse = response;
          this.logger.info("createList response:", this.listCreateResponse);
          this.listCreateRequest = null;
          this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MAIL_LISTS_CHANGED, response));
        })
        .catch(error => this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.ERROR, error)));
    }
  }

  listCreateDisabled() {
    return isEmpty(this.listCreateRequest?.name) || !this.listCreateRequest?.folderId;
  }

  createNewList() {
    if (!this.createNewListDisabled()) {
      this.listCreateRequest = {name: "", folderId: first(this.mailMessagingConfig?.brevo?.folders?.folders)?.id};
    }
  }

  updateListsTitle(): string {
    return this.memberDefaultsService.updateListsTitle(this.systemConfig);
  }

  async updateLists() {
    this.syncingLists = true;
    try {
      await this.memberDefaultsService.updateLists(this.systemConfig, this.notify, this.members);
      await this.refreshMailListData();
    } finally {
      this.syncingLists = false;
    }
  }

  createNewListDisabled() {
    return !!this.listCreateRequest || this.confirm.deleteConfirmOutstanding();
  }

  notReady() {
    return !(this?.mailMessagingConfig?.mailConfig);
  }

  save() {
    this.logger.info("saving config", this.mailMessagingConfig?.mailConfig);
    this.acceptNextConfigEmission = true;
    this.notify.setBusy();
    return this.savePendingMembers()
      .then(() => this.systemConfig ? this.systemConfigService.saveConfig(this.systemConfig) : undefined)
      .then(() => this.mailMessagingService.saveConfig(this.mailMessagingConfig, this.deletedConfigs))
      .then(response => {
        this.pendingApiKeyValidation = false;
        this.notify.success({title: "Mail settings", message: "Settings saved"});
        return response;
      })
      .catch((error) => {
        this.notify.error(error);
        return Promise.reject(error);
      })
      .finally(() => this.notify.clearBusy());
  }

  private async savePendingMembers(): Promise<void> {
    if (this.membersPendingSave.length > 0) {
      this.logger.info("saving", this.stringUtilsService.pluraliseWithCount(this.membersPendingSave.length, "pending member"));
      await this.memberService.createOrUpdateAll(this.membersPendingSave);
      this.membersPendingSave = [];
    }
  }

  saveAndExit() {
    this.logger.info("saving config", this.mailMessagingConfig?.mailConfig);
    return this.save()
      .then((response) => {
        this.logger.info("config response:", response);
        this.urlService.navigateTo(["admin"]);
        return response;
      });
  }

  cancel() {
    this.urlService.navigateTo(["admin"]);
  }

  undoChanges() {
    this.acceptNextConfigEmission = true;
    this.pendingApiKeyValidation = false;
    this.mailMessagingService.refresh();
  }

  apiKeyChanged(apiKey: string) {
    if (this.mailMessagingConfig?.mailConfig) {
      this.mailMessagingConfig.mailConfig.apiKey = apiKey;
      this.pendingApiKeyValidation = true;
    }
  }

  remainingDailyEmailCredits(): number | null {
    return brevoRemainingDailyEmailCredits(this.mailMessagingConfig?.brevo?.account);
  }

  percentageCreditsUsed(): number {
    return this.numberUtilsService.asNumber((brevoEmailsSentToday(this.mailMessagingConfig?.brevo?.account) ?? 0) / this.CREDITS_AVAILABLE * 100, 0);
  }

  public selectTab(tab: MailSettingsTab) {
    if (kebabCase(this.tab) === kebabCase(tab)) {
      return;
    }
    this.tab = tab;
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
  }

  tabActive(tab: MailSettingsTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  protected readonly faExclamationTriangle = faExclamationTriangle;

}
