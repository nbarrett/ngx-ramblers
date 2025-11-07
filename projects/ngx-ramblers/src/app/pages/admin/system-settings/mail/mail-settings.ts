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
  MailSettingsTab
} from "../../../../models/mail.model";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { Subscription } from "rxjs";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { MailService } from "../../../../services/mail/mail.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { Confirm, StoredValue } from "../../../../models/ui-actions";
import { ActivatedRoute, Router } from "@angular/router";
import { kebabCase } from "es-toolkit/compat";
import { NumberUtilsService } from "../../../../services/number-utils.service";
import { first } from "es-toolkit/compat";
import { isEmpty } from "es-toolkit/compat";
import { PageComponent } from "../../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { MailNotificationTemplateMappingComponent } from "./mail-notification-template-editor";
import { NotificationConfigToProcessMappingComponent } from "./notification-config-to-process-mappings";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { FormsModule } from "@angular/forms";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { NgClass, NgStyle } from "@angular/common";
import { MailListEditorComponent } from "./list-editor";
import { MailListSettingsComponent } from "./mail-list-settings";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";

@Component({
    selector: "app-mail-settings",
    template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          @if (mailMessagingConfig?.mailConfig) {
            <tabset class="custom-tabset">
              <tab [active]="tabActive(MailSettingsTab.EMAIL_CONFIGURATIONS)"
                (selectTab)="selectTab(MailSettingsTab.EMAIL_CONFIGURATIONS)"
                [heading]="MailSettingsTab.EMAIL_CONFIGURATIONS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <app-mail-notification-template-mapping-editor (tabSelected)="selectTab($event)"
                  (configDeleted)="deletedConfigs.push($event)"></app-mail-notification-template-mapping-editor>
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS)"
                (selectTab)="selectTab(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS)"
                [heading]="MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <app-notification-config-to-process-mapping></app-notification-config-to-process-mapping>
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.MAIL_API_SETTINGS)"
                (selectTab)="selectTab(MailSettingsTab.MAIL_API_SETTINGS)"
                [heading]="MailSettingsTab.MAIL_API_SETTINGS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="thumbnail-heading-frame">
                    <div class="thumbnail-heading">Global Settings</div>
                    <div class="row">
                      <div class="col-sm-12 mb-3 mx-2">
                        <app-markdown-editor standalone category="admin" name="mail-settings-global-help"
                        description="Mail Settings Global Configuration Help"/>
                      </div>
                    </div>
                    <div class="col-sm-12">
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
                      <div class="form-group">
                        <label for="base-url">Base Url</label>
                        <div class="input-group">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.baseUrl" type="text"
                            class="form-control input-sm" id="base-url"
                            placeholder="The Base Url for the Mail Application">
                          <app-brevo-button button [disabled]="!mailMessagingConfig?.mailConfig.baseUrl"
                            (click)="mailLinkService.openUrl(mailLinkService.appUrl())"
                          [title]="'View'"></app-brevo-button>
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="my-base-url">My Base Url</label>
                        <div class="input-group">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.myBaseUrl" type="text"
                            class="form-control input-sm" id="my-base-url"
                            placeholder="The Base Url for My Mail Application">
                          <app-brevo-button button [disabled]="!mailMessagingConfig?.mailConfig.myBaseUrl"
                            (click)="mailLinkService.openUrl(mailLinkService.myBaseUrl())"
                          [title]="'View'"></app-brevo-button>
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="editor-url">Editor Url</label>
                        <div class="input-group">
                          <input [(ngModel)]="mailMessagingConfig.mailConfig.editorUrl" type="text"
                            class="form-control input-sm" id="editor-url"
                            placeholder="The Base Url for editor of The Mail Application">
                          <app-brevo-button button [disabled]="!mailMessagingConfig?.mailConfig.editorUrl"
                            (click)="mailLinkService.openUrl(mailLinkService.editorUrl())"
                          [title]="'View'"></app-brevo-button>
                        </div>
                      </div>
                      <div class="form-group">
                        <label for="api-key">API Key</label>
                        <div class="input-group">
                          <app-secret-input
                            [(ngModel)]="mailMessagingConfig.mailConfig.apiKey"
                            id="api-key"
                            size="sm"
                            placeholder="The API key for the mail api"/>
                          <app-brevo-button button [disabled]="!mailMessagingConfig?.mailConfig.baseUrl"
                            (click)="mailLinkService.openUrl(mailLinkService.apiKeysView())"
                          [title]="'View'"></app-brevo-button>
                        </div>
                      </div>
                    </div>
                  </div>
                  @if (mailMessagingConfig.brevo.account) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Account Profile</div>
                      <div class="row">
                        <div class="col-sm-12 mt-2 mb-2">
                          <app-markdown-editor standalone category="admin" name="mail-settings-account-help"
                          description="Mail Settings Account Help"/>
                        </div>
                      </div>
                      <div class="row align-items-end">
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="email">Email</label>
                            <div class="form-control input-sm" id="email">{{ mailMessagingConfig.brevo.account?.email }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="firstName">First Name</label>
                            <div class="form-control input-sm" id="firstName">{{ mailMessagingConfig.brevo.account?.firstName }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="lastName">Last Name</label>
                            <div class="form-control input-sm" id="lastName">{{ mailMessagingConfig.brevo.account?.lastName }}</div>
                          </div>
                        </div>
                      </div>
                      <div class="row align-items-end">
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="companyName">Company Name</label>
                            <div class="form-control input-sm" id="companyName">{{ mailMessagingConfig.brevo.account?.companyName }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="street">Street</label>
                            <div class="form-control input-sm" id="street">{{ mailMessagingConfig.brevo.account?.address?.street }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="postcode">Postcode</label>
                            <div class="form-control input-sm" id="postcode">{{ mailMessagingConfig.brevo.account?.address?.zipCode }}</div>
                          </div>
                        </div>
                      </div>
                      <div class="row align-items-end">
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="town">Town</label>
                            <div type="text" class="form-control input-sm" id="town">{{ mailMessagingConfig.brevo.account?.address?.city }}</div>
                          </div>
                        </div>
                        <div class="col-sm-4">
                          <div class="form-group">
                            <label for="country">Country</label>
                            <div class="form-control input-sm">{{ mailMessagingConfig.brevo.account?.address?.country }}</div>
                          </div>
                        </div>
                        <div class="col">
                          <div class="form-group">
                            <app-brevo-button button title="Edit Account Profile Information"
                            (click)="editAccountProfileInformation()"></app-brevo-button>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                  @if (mailMessagingConfig.brevo.account) {
                    <div class="thumbnail-heading-frame">
                      <div class="thumbnail-heading">Free Email Plan Usage</div>
                      <div class="row">
                        <div class="col-sm-12">
                          <p>Credits are renewed each day - {{ freeCreditsUsed() }} available out of {{ CREDITS_AVAILABLE }} emails/day ({{ percentageCreditsUsed() }}% used)</p>
                          <div class="progress">
                            <div class="progress-bar" role="progressbar" [ngStyle]="{ 'width': percentageCreditsUsed() + '%' }"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </tab>
              <tab [active]="tabActive(MailSettingsTab.MAIL_LIST_SETTINGS)"
                (selectTab)="selectTab(MailSettingsTab.MAIL_LIST_SETTINGS)"
                [heading]="MailSettingsTab.MAIL_LIST_SETTINGS">
                <div class="img-thumbnail thumbnail-admin-edit">
                  <div class="thumbnail-heading-frame">
                    <div class="thumbnail-heading">List Settings</div>
                    <div class="col-sm-12 mb-3">
                      <app-markdown-editor standalone category="admin" name="mail-settings-list-settings"/>
                    </div>
                    <div class="px-3">
                      <div class="row">
                        <div class="col">
                          <h5>{{ stringUtilsService.pluraliseWithCount(mailMessagingConfig?.brevo?.lists?.count, "list") }} {{ stringUtilsService.pluralise(mailMessagingConfig?.brevo?.lists?.count, "exists", "exist") }} in Brevo</h5>
                        </div>
                        @if (!listCreateRequest) {
                          <div class="col-auto">
                            <div class="float-end">
                              <app-brevo-button button title="Create New List" [disabled]="createNewListDisabled()" (click)="createNewList()"></app-brevo-button>
                            </div>
                          </div>
                        }
                      </div>
                      @if (listCreateRequest) {
                        <app-list-editor [listCreateRequest]="listCreateRequest"></app-list-editor>
                        <div class="row">
                          <div class="col-sm-12">
                            <app-brevo-button button title="Confirm Create List" (click)="confirmCreateList()" [disabled]="listCreateDisabled()"></app-brevo-button>
                            <app-brevo-button button title="Cancel Create List" class="ms-2" (click)="listCreateRequest=null"></app-brevo-button>
                          </div>
                        </div>
                      }
                      @for (list of mailMessagingConfig?.brevo?.lists?.lists; track list.id) {
                        <app-mail-list-settings [mailMessagingConfig]="mailMessagingConfig" [notify]="notify" [list]="list"></app-mail-list-settings>
                      }
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
                    <strong>{{ notifyTarget.alertTitle }}: </strong>
                    } {{ notifyTarget.alertMessage }}
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="col-sm-12">
            <input type="submit" value="Save settings and exit" (click)="saveAndExit()" [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
            <input type="submit" value="Save" (click)="save()" [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-success me-2'" [disabled]="notReady()">
            <input type="submit" value="Undo Changes" (click)="undoChanges()" [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
            <input type="submit" value="Exit Without Saving" (click)="cancel()" [ngClass]="notReady() ? 'btn btn-secondary me-2': 'btn btn-primary me-2'" [disabled]="notReady()">
          </div>
        </div>
      </app-page>
    `,
    imports: [PageComponent, TabsetComponent, TabDirective, MailNotificationTemplateMappingComponent, NotificationConfigToProcessMappingComponent, MarkdownEditorComponent, FormsModule, BrevoButtonComponent, NgStyle, MailListEditorComponent, MailListSettingsComponent, FontAwesomeModule, NgClass, SecretInputComponent]
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
  private logger = this.loggerFactory.createLogger("MailSettingsComponent", NgxLoggerLevel.ERROR);
  private error: any;
  public CREDITS_AVAILABLE = 300;
  public confirm: Confirm = new Confirm();
  private tab: any;
  public listCreateRequest: ListCreateRequest;
  public listCreateResponse: ListCreateResponse;
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

  createNewListDisabled() {
    return !!this.listCreateRequest || this.confirm.deleteConfirmOutstanding();
  }

  notReady() {
    return !(this?.mailMessagingConfig?.mailConfig);
  }

  save() {
    this.logger.info("saving config", this.mailMessagingConfig?.mailConfig);
    return this.mailMessagingService.saveConfig(this.mailMessagingConfig, this.deletedConfigs)
      .catch((error) => this.notify.error(error));
  }

  saveAndExit() {
    this.logger.info("saving config", this.mailMessagingConfig?.mailConfig);
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

  public selectTab(tab: MailSettingsTab) {
    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: kebabCase(tab)},
      queryParamsHandling: "merge"
    });
  }

  tabActive(tab: MailSettingsTab): boolean {
    return kebabCase(this.tab) === kebabCase(tab);
  }

  editAccountProfileInformation() {
    this.mailLinkService.openUrl(this.mailLinkService.profileInformation());
  }
}
