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
  NotificationConfig
} from "../../../../models/mail.model";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { Subscription } from "rxjs";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import isEmpty from "lodash-es/isEmpty";
import { MailService } from "../../../../services/mail/mail.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { Confirm, StoredValue } from "../../../../models/ui-actions";
import first from "lodash-es/first";
import { ActivatedRoute, Router } from "@angular/router";
import kebabCase from "lodash-es/kebabCase";
import { NumberUtilsService } from "../../../../services/number-utils.service";

@Component({
  selector: "app-mail-settings",
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <tabset class="custom-tabset" *ngIf="mailMessagingConfig?.mailConfig">
            <tab [active]="tabActive(MailSettingsTab.EMAIL_CONFIGURATIONS)"
                 (selectTab)="selectTab(MailSettingsTab.EMAIL_CONFIGURATIONS)"
                 [heading]="MailSettingsTab.EMAIL_CONFIGURATIONS">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-mail-notification-template-mapping-editor [notificationConfig]="notificationConfig"
                                                               (tabSelected)="selectTab($event)"
                                                               (configDeleted)="deletedConfigs.push($event)"/>
              </div>
            </tab>
            <tab [active]="tabActive(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS)"
                 (selectTab)="selectTab(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS)"
                 [heading]="MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-notification-config-to-process-mapping/>
              </div>
            </tab>
            <tab [active]="tabActive(MailSettingsTab.MAIL_API_SETTINGS)"
                 (selectTab)="selectTab(MailSettingsTab.MAIL_API_SETTINGS)"
                 [heading]="MailSettingsTab.MAIL_API_SETTINGS">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Global Settings</div>
                  <div class="row">
                    <div class="col-sm-12 mb-3 mx-2">
                      <app-markdown-editor category="admin" name="mail-settings-global-help"
                                           description="Mail Settings Global Configuration Help"/>
                    </div>
                  </div>
                  <div class="col-sm-12">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="mailMessagingConfig.mailConfig.allowSendTransactional"
                             type="checkbox" class="custom-control-input" id="mail-enabled">
                      <label class="custom-control-label"
                             for="mail-enabled">Allow Send Transactional
                      </label>
                    </div>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="mailMessagingConfig.mailConfig.allowSendCampaign"
                             type="checkbox" class="custom-control-input" id="allow-send-campaign">
                      <label class="custom-control-label"
                             for="allow-send-campaign">Allow Send Campaign
                      </label>
                    </div>
                    <div class="form-group">
                      <label for="base-url">Base Url</label>
                      <div class="input-group">
                        <input [(ngModel)]="mailMessagingConfig.mailConfig.baseUrl" type="text"
                               class="form-control input-sm"
                               id="base-url"
                               placeholder="The Base Url for the Mail Application">
                        <div class="input-group-append">
                          <div class="input-group-text">
                            <app-brevo-button [disabled]="!mailMessagingConfig.mailConfig.baseUrl"
                                              (click)="mailLinkService.openUrl(mailLinkService.appUrl())"
                                              [title]="'View'"/>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="my-base-url">My Base Url</label>
                      <div class="input-group">
                        <input [(ngModel)]="mailMessagingConfig.mailConfig.myBaseUrl" type="text"
                               class="form-control input-sm"
                               id="my-base-url"
                               placeholder="The Base Url for My Mail Application">
                        <div class="input-group-append">
                          <div class="input-group-text">
                            <app-brevo-button [disabled]="!mailMessagingConfig.mailConfig.myBaseUrl"
                                              (click)="mailLinkService.openUrl(mailLinkService.myBaseUrl())"
                                              [title]="'View'"/>

                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="editor-url">Editor Url</label>
                      <div class="input-group">
                        <input [(ngModel)]="mailMessagingConfig.mailConfig.editorUrl" type="text"
                               class="form-control input-sm"
                               id="editor-url"
                               placeholder="The Base Url for editor of The Mail Application">
                        <div class="input-group-append">
                          <div class="input-group-text">
                            <app-brevo-button [disabled]="!mailMessagingConfig.mailConfig.editorUrl"
                                              (click)="mailLinkService.openUrl(mailLinkService.editorUrl())"
                                              [title]="'View'"/>

                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="api-key">API Key</label>
                      <div class="input-group">
                        <input [(ngModel)]="mailMessagingConfig.mailConfig.apiKey" type="text"
                               class="form-control input-sm"
                               id="api-key"
                               placeholder="The API key for the mail api">
                        <div class="input-group-append">
                          <div class="input-group-text">
                            <app-brevo-button [disabled]="!mailMessagingConfig.mailConfig.baseUrl"
                                              (click)="mailLinkService.openUrl(mailLinkService.apiKeysView())"
                                              [title]="'View'"/>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div *ngIf="mailMessagingConfig.brevo.account" class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Account Settings</div>
                  <div class="row">
                    <div class="col-sm-12 mt-2 mb-2">
                      <app-markdown-editor category="admin" name="mail-settings-account-help"
                                           description="Mail Settings Account Help"></app-markdown-editor>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="email">Email</label>
                        <div class="form-control input-sm"
                             id="email">{{ mailMessagingConfig.brevo.account.email }}
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="firstName">First Name</label>
                        <div class="form-control input-sm"
                             id="firstName">{{ mailMessagingConfig.brevo.account.firstName }}
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="lastName">Last Name</label>
                        <div class="form-control input-sm"
                             id="lastName">{{ mailMessagingConfig.brevo.account.lastName }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="companyName">Company Name</label>
                        <div class="form-control input-sm"
                             id="companyName">{{ mailMessagingConfig.brevo.account.companyName }}
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="street">Street</label>
                        <div class="form-control input-sm"
                             id="street">{{ mailMessagingConfig.brevo.account.address.street }}
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="postcode">Postcode</label>
                        <div class="form-control input-sm"
                             id="postcode">{{ mailMessagingConfig.brevo.account.address.zipCode }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="town">Town</label>
                        <div type="text" class="form-control input-sm"
                             id="town">{{ mailMessagingConfig.brevo.account.address.city }}
                        </div>
                      </div>
                    </div>
                    <div class="col-sm-4">
                      <div class="form-group">
                        <label for="country">Country</label>
                        <div class="form-control input-sm">{{ mailMessagingConfig.brevo.account.address.country }}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div *ngIf=mailMessagingConfig.brevo.account class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Free Email Plan</div>
                  <div class="row">
                    <div class="col-sm-12">
                      <p>Credits are renewed each day - {{ freeCreditsUsed() }} available out of {{ CREDITS_AVAILABLE }}
                        emails/day ({{ percentageCreditsUsed() }}% used)
                      </p>
                      <div class="progress">
                        <div class="progress-bar" role="progressbar"
                             [ngStyle]="{ 'width': percentageCreditsUsed() + '%' }"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab [active]="tabActive(MailSettingsTab.MAIL_LIST_SETTINGS)"
                 (selectTab)="selectTab(MailSettingsTab.MAIL_LIST_SETTINGS)"
                 [heading]="MailSettingsTab.MAIL_LIST_SETTINGS">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">List Settings</div>
                  <div class="col-sm-12 mb-3">
                    <app-markdown-editor category="admin" name="mail-settings-list-settings"/>
                  </div>
                  <div class="row">
                    <div class="col-sm-8">
                      <h5>{{ stringUtilsService.pluraliseWithCount(mailMessagingConfig?.brevo?.lists?.count, "list") }}
                        {{ stringUtilsService.pluralise(mailMessagingConfig?.brevo?.lists?.count, "exists", "exist") }}
                        in Brevo
                      </h5>
                    </div>
                    <div class="col justify-content-end">
                      <app-brevo-button button title="Create New List"
                                        [disabled]="createNewListDisabled()"
                                        (click)="createNewList()"/>
                    </div>
                  </div>
                  <hr/>
                  <ng-container *ngIf="listCreateRequest">
                    <app-list-editor [listCreateRequest]="listCreateRequest"/>
                    <div class="row">
                      <div class="col-sm-12">
                        <app-brevo-button button title="Confirm Create List"
                                          (click)="confirmCreateList()"
                                          [disabled]="listCreateDisabled()"/>
                        <app-brevo-button button title="Cancel Create List"
                                          class="ml-2" (click)="listCreateRequest=null"/>
                      </div>
                    </div>
                  </ng-container>
                  <ng-container *ngFor="let list of mailMessagingConfig?.brevo?.lists?.lists">
                    <app-mail-list-settings [mailMessagingConfig]="mailMessagingConfig"
                                            [notify]="notify"
                                            [confirm]="confirm"
                                            [notReady]="notReady()"
                                            [list]="list">
                    </app-mail-list-settings>
                  </ng-container>
                </div>
              </div>
            </tab>
          </tabset>
          <div *ngIf="notifyTarget.showAlert" class="row">
            <div class="col-sm-12 mb-10">
              <div class="alert {{notifyTarget.alert.class}}">
                <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                <strong *ngIf="notifyTarget.alertTitle">
                  {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
              </div>
            </div>
          </div>
        </div>
        <div class="col-sm-12">
          <input type="submit" value="Save settings and exit" (click)="saveAndExit()"
                 [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm green-confirm button-form-left'">
          <input type="submit" value="Save" (click)="save()"
                 [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm green-confirm button-form-left'">
          <input type="submit" value="Undo Changs" (click)="undoChanges()"
                 [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm button-form-left'">
          <input type="submit" value="Exit Without Saving" (click)="cancel()"
                 [ngClass]="notReady() ? 'disabled-button-form button-form-left': 'button-form button-confirm button-form-left'">
        </div>
      </div>
    </app-page>
  `,
})
export class MailSettingsComponent implements OnInit, OnDestroy {
  public deletedConfigs: string[] = [];
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public mailMessagingConfig: MailMessagingConfig;
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
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailSettingsComponent", NgxLoggerLevel.OFF);
  public notificationConfig: NotificationConfig;
  public listCreateRequest: ListCreateRequest;
  public listCreateResponse: ListCreateResponse;
  private error: any;
  public CREDITS_AVAILABLE = 300;
  public confirm: Confirm = new Confirm();
  private tab: any;

  protected readonly MailSettingsTab = MailSettingsTab;

  ngOnInit() {
    this.logger.debug("constructed");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const defaultValue = kebabCase(MailSettingsTab.EMAIL_CONFIGURATIONS);
      const tabParameter = params[StoredValue.TAB];
      this.tab = tabParameter || defaultValue;
      this.logger.info("received tab value of:", tabParameter, "defaultValue:", defaultValue);
      this.selectTab(this.tab);
    }));
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
    }));
    this.broadcastService.on(NamedEventType.MAIL_LISTS_CHANGED, () => {
      this.logger.info("event received:", NamedEventType.MAIL_LISTS_CHANGED);
      this.mailMessagingService.initialise();
    });
    this.broadcastService.on(NamedEventType.NOTIFY_MESSAGE, (namedEvent: NamedEvent<AlertMessageAndType>) => {
      this.logger.info("event received:", namedEvent);
      if (!this.error) {
        switch (namedEvent.data.type) {
        case AlertLevel.ALERT_ERROR:
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

  notReady() {
    return !!this.listCreateRequest || !(this?.mailMessagingConfig?.mailConfig);
  }

  save() {
    this.logger.info("saving config", this.mailMessagingConfig.mailConfig);
    return this.mailMessagingService.saveConfig(this.mailMessagingConfig, this.deletedConfigs)
      .catch((error) => this.notify.error(error));
  }

  saveAndExit() {
    this.logger.info("saving config", this.mailMessagingConfig.mailConfig);
    this.save()
      .then((response) => {
        this.logger.info("config response:", response);
        this.urlService.navigateTo(["admin"]);
      });
  }

  cancel() {
    this.urlService.navigateTo(["admin"]);
  }

  undoChanges() {
    this.mailMessagingService.refresh();
  }

  freeCreditsUsed(): number {
    return this.mailMessagingConfig?.brevo?.account?.plan?.find(item => item.type === "free")?.credits || 0;
  }

  percentageCreditsUsed(): number {
    return this.numberUtilsService.asNumber((this.CREDITS_AVAILABLE - this.freeCreditsUsed()) / this.CREDITS_AVAILABLE * 100, 0);
  }

  listCreateDisabled() {
    return isEmpty(this.listCreateRequest?.name) || !this.listCreateRequest?.folderId;
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

  createNewList() {
    if (!this.createNewListDisabled()) {
      this.listCreateRequest = {name: "", folderId: first(this.mailMessagingConfig?.brevo?.folders?.folders)?.id};
    }
  }

  createNewListDisabled() {
    return !!this.listCreateRequest || this.confirm.deleteConfirmOutstanding();
  }

  public selectTab(tab: MailSettingsTab) {
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
  }

  tabActive(tab: MailSettingsTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }
}
