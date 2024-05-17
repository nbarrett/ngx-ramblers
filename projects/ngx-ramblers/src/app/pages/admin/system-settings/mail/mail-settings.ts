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
  Account,
  FoldersListResponse,
  ListsResponse,
  MailMessagingConfig,
  NotificationConfig
} from "../../../../models/mail.model";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { Subscription } from "rxjs";
import { MailService } from "../../../../services/mail/mail.service";
import { MailLinkService } from "../../../../services/mail/mail-link.service";

@Component({
  selector: "app-mail-settings",
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <tabset class="custom-tabset" *ngIf="mailMessagingConfig?.mailConfig">
            <tab heading="Email Configurations">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-mail-notification-template-mapping-editor [notificationConfig]="notificationConfig"
                                                               (configDeleted)="deletedConfigs.push($event)"/>
              </div>
            </tab>
            <tab heading="Built-in Process Mappings">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-notification-config-to-process-mapping/>
              </div>
            </tab>
            <tab heading="Mail API Settings">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Global Settings</div>
                  <div class="row">
                    <div class="col-sm-12 mt-2 mb-2">
                      <app-markdown-editor category="admin" name="mail-settings-global-help"
                                           description="Mail Settings Global Configuration Help"></app-markdown-editor>
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
                <div *ngIf=account class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">Account Settings</div>
                  <div class="row">
                    <div class="col-sm-12 mt-2 mb-2">
                      <app-markdown-editor category="admin" name="mail-settings-account-help"
                                           description="Mail Settings Account Help"></app-markdown-editor>
                    </div>
                  </div>
                  <div class="col-sm-12">
                    <div class="form-group">
                      <label for="email">Email</label>
                      <div class="form-control input-sm"
                           id="email">{{ account.email }}
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="firstName">First Name</label>
                      <div class="form-control input-sm"
                           id="firstName">{{ account.firstName }}
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="lastName">Last Name</label>
                      <div class="form-control input-sm"
                           id="lastName">{{ account.lastName }}
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="companyName">Company Name</label>
                      <div class="form-control input-sm"
                           id="companyName">{{ account.companyName }}
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="street">Street</label>
                      <div class="form-control input-sm"
                           id="street">{{ account.address.street }}
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="postcode">Postcode</label>
                      <div class="form-control input-sm"
                           id="postcode">{{ account.address.zipCode }}
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="town">Town</label>
                      <div type="text" class="form-control input-sm"
                           id="town">{{ account.address.city }}
                      </div>
                    </div>
                    <div class="form-group">
                      <label for="country">Country</label>
                      <div class="form-control input-sm">{{ account.address.country }}</div>
                    </div>
                    <div class="form-group">
                      <label>Plan</label>
                      <pre>{{ account.plan|json }}</pre>
                    </div>
                    <div class="form-group">
                      <label>Marketing Automation</label>
                      <pre>{{ account.marketingAutomation|json }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab heading="Mail List Settings">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="img-thumbnail thumbnail-2">
                  <div class="thumbnail-heading">List Settings</div>
                  <app-mail-list-settings label="General"
                                          [listsResponse]="listsResponse"
                                          [foldersResponse]="foldersResponse"
                                          [notify]="notify"
                                          [notReady]="notReady()"
                                          [mailConfig]="mailMessagingConfig.mailConfig"
                                          [listType]="'general'">
                  </app-mail-list-settings>
                  <app-mail-list-settings label="Walks"
                                          [listsResponse]="listsResponse"
                                          [foldersResponse]="foldersResponse"
                                          [notify]="notify"
                                          [notReady]="notReady()"
                                          [mailConfig]="mailMessagingConfig.mailConfig"
                                          [listType]="'walks'">
                  </app-mail-list-settings>
                  <app-mail-list-settings label="Social Events"
                                          [listsResponse]="listsResponse"
                                          [foldersResponse]="foldersResponse"
                                          [notify]="notify"
                                          [notReady]="notReady()"
                                          [mailConfig]="mailMessagingConfig.mailConfig"
                                          [listType]="'socialEvents'">
                  </app-mail-list-settings>
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
  private mailService: MailService = inject(MailService);
  public mailMessagingConfig: MailMessagingConfig;
  private notifierService: NotifierService = inject(NotifierService);
  public mailLinkService: MailLinkService = inject(MailLinkService);
  private broadcastService: BroadcastService<any> = inject(BroadcastService);
  private urlService: UrlService = inject(UrlService);
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  public account: Account;
  private subscriptions: Subscription[] = [];
  protected dateUtils: DateUtilsService = inject(DateUtilsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("MailSettingsComponent", NgxLoggerLevel.OFF);
  public notificationConfig: NotificationConfig;
  public listsResponse: ListsResponse;
  public foldersResponse: FoldersListResponse;
  private error: any;

  ngOnInit() {
    this.logger.debug("constructed");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
    }));
    this.refreshListsAndFolders();
    this.broadcastService.on(NamedEventType.MAIL_LISTS_CHANGED, () => {
      this.logger.info("event received:", NamedEventType.MAIL_LISTS_CHANGED);
      this.refreshListsAndFolders();
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

  private refreshListsAndFolders() {
    this.error = null;
    Promise.all([this.mailService.queryAccount().then(account => this.account = account),
      this.mailService.queryLists().then(listsResponse => this.listsResponse = listsResponse),
      this.mailService.queryFolders().then(foldersResponse => this.foldersResponse = foldersResponse)])
      .then((all) => {
        this.logger.info("all received:", all);
      }).catch((error) => {
      this.error = error;
      this.notify.error(error);
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  notReady() {
    return !(this?.mailMessagingConfig?.mailConfig);
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
}
