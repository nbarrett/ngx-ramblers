import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import {
  MailMessagingConfig,
  MemberSelection,
  NotificationConfig,
  SendSmtpEmailParams,
  WorkflowAction
} from "../../../../models/mail.model";
import { CommitteeRolesChangeEvent } from "../../../../models/committee.model";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { BroadcastService } from "../../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { AlertLevel, AlertMessageAndType } from "../../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { BannerConfig } from "../../../../models/banner-configuration.model";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { extractParametersFrom } from "../../../../common/mail-parameters";
import { enumKeyValues, KEY_NULL_VALUE_NONE, KeyValue } from "../../../../services/enums";
import last from "lodash-es/last";
import { Subscription } from "rxjs";
import { faAdd, faBackward, faCopy, faEraser, faForward, faMailBulk } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";

@Component({
  selector: "app-mail-notification-template-mapping-editor",
  template: `
    <div *ngIf="mailMessagingConfig" class="row img-thumbnail thumbnail-2">
      <div class="thumbnail-heading-with-select">
        <div class="form-inline">
          <label for="template-mapping">Email Configuration
            {{ mailMessagingConfig.notificationConfigs.indexOf(notificationConfig) + 1 }}
            of {{ mailMessagingConfig.notificationConfigs.length }}: </label>
          <select [(ngModel)]="notificationConfig"
                  id="template-mapping"
                  class="ml-2 form-control input-sm">
            <option *ngFor="let mapping of mailMessagingConfig.notificationConfigs"
                    [ngValue]="mapping">{{ mapping?.subject?.text || '(no subject)' }}
            </option>
          </select>
        </div>
      </div>
      <div class="row">
        <div class="col-sm-12 mt-2 mb-2">
          <app-markdown-editor category="admin" name="mail-settings-email-configurations-help"
                               description="Mail Settings Email Configuration Help"
                               text="* Once Brevo has been initialised and connected to your website, little if anything ever needs to be done on this tab again.\n* In this section, are settings such as the URL to the Brevo system, that you might have to visit if you want to edit email templates, along with configuration checkboxes that turn on/off the ability to send emails, and the API key which is used by the website to authenticate to Brevo when messages are sent and received."></app-markdown-editor>
        </div>
      </div>
      <div class="col-sm-12">
        <div class="row">
          <div class="col pr-1">
            <app-badge-button fullWidth [icon]="faBackward" caption="Previous" (click)="previousConfig()"
                              [disabled]="previousConfigDisabled()"/>
          </div>
          <div class="col pr-1">
            <app-badge-button fullWidth [icon]="faForward" caption="Next" (click)="nextConfig()"
                              [disabled]="nextConfigDisabled()"/>
          </div>
          <div class="col pr-1">
            <app-badge-button fullWidth="true" [icon]="faCopy" caption="Duplicate" (click)="duplicateConfig()"/>
          </div>
          <div class="col">
            <app-badge-button fullWidth [icon]="faAdd" caption="Add New" (click)="addNewConfig()"/>
          </div>
          <div class="col pr-1">
            <app-badge-button fullWidth="true" [icon]="faEraser" caption="Delete" (click)="deleteConfig()"/>
          </div>
        </div>
      </div>
      <ng-container *ngIf="notificationConfig">
        <div class="row img-thumbnail thumbnail-2">
          <div class="thumbnail-heading">Notification Settings</div>
          <div *ngIf="notificationConfig?.subject" class="col-sm-12">
            <div class="row">
              <div class="col">
                <div class="form-group">
                  <label for="prefix-parameter">Subject Prefix</label>
                  <select [(ngModel)]="notificationConfig.subject.prefixParameter"
                          id="{{heading | kebabCase}-prefix-parameter"
                          class="form-control input-sm flex-grow-1 mr-2">
                    <option *ngFor="let keyValue of parametersFrom"
                            [ngValue]="keyValue.key">{{ formatKeyValue(keyValue) }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="col">
                <div class="form-group flex-grow-1">
                  <label for="title">Subject Text</label>
                  <input [(ngModel)]="notificationConfig.subject.text"
                         type="text" id="title"
                         class="form-control input-sm">
                </div>
              </div>
              <div class="col">
                <div class="form-group">
                  <label for="suffix-parameter">Subject Suffix</label>
                  <select [(ngModel)]="notificationConfig.subject.suffixParameter"
                          id="suffix-parameter"
                          class="form-control input-sm flex-grow-1 mr-2">
                    <option *ngFor="let keyValue of parametersFrom"
                            [ngValue]="keyValue.key">{{ formatKeyValue(keyValue) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <ng-container>
            <div class="col-sm-12">
              <div class="form-group">
                <label for="banner-lookup">Banner Image</label>
                <select class="form-control input-sm"
                        id="banner-lookup"
                        [(ngModel)]="notificationConfig.bannerId" (ngModelChange)="bannerSelected($event)">
                  <option *ngFor="let banner of mailMessagingConfig.banners"
                          [ngValue]="banner.id">{{ toBannerInformation(banner) }}
                  </option>
                </select>
              </div>
            </div>
            <div *ngIf="notificationConfig?.bannerId" class="col-sm-12 mb-2">
              <img class="card-img"
                   [src]="mailMessagingService.bannerImageSource(notificationConfig, false)">
            </div>
          </ng-container>
          <div class="col-sm-12">
            <div class="form-group">
              <label for="sender">Sender</label>
              <select [(ngModel)]="notificationConfig.senderRole"
                      id="sender"
                      class="form-control input-sm">
                <option *ngFor="let role of mailMessagingConfig.committeeReferenceData.committeeMembers()"
                        [ngValue]="role.type">{{ role.nameAndDescription }}
                </option>
              </select>
            </div>
          </div>
          <div class="col-sm-12">
            <div class="form-group">
              <label for="reply-to">Reply To</label>
              <select [(ngModel)]="notificationConfig.replyToRole"
                      id="reply-to"
                      class="form-control input-sm">
                <option *ngFor="let role of mailMessagingConfig.committeeReferenceData.committeeMembers()"
                        [ngValue]="role.type">{{ role.nameAndDescription }}
                </option>
              </select>
            </div>
          </div>
          <div class="col-sm-12">
            <div class="form-group">
              <app-committee-role-multi-select [showRoleSelectionAs]="'description'"
                                               [label]="'Sign Off Email With Roles'"
                                               [roles]="notificationConfig.signOffRoles"
                                               (rolesChange)="assignRolesTo($event)"/>
            </div>
          </div>
          <div class="col-sm-12">
            <div class="form-group">
              <label for="template">Brevo Template</label>
              <div class="input-group">
                <select [(ngModel)]="notificationConfig.templateId"
                        id="template"
                        class="form-control input-sm">
                  <option *ngFor="let template of mailMessagingConfig?.mailTemplates?.templates"
                          [ngValue]="template.id">{{ template.name }}
                  </option>
                </select>
                <div class="input-group-append">
                  <div class="input-group-text">
                    <app-brevo-button [disabled]="notReady()"
                                      (click)="editTemplate(notificationConfig.templateId)"
                                      [title]="'View'"/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="img-thumbnail thumbnail-2">
          <div class="thumbnail-heading">Member Selection And Actions</div>
          <div class="row">
            <div class="col-sm-6">
              <div class="form-group">
                <label for="member-selection">
                  Default Member Selection</label>
                <select class="form-control input-sm"
                        [(ngModel)]="notificationConfig.defaultMemberSelection"
                        id="member-selection">
                  <option *ngFor="let type of memberSelections"
                          [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                  </option>
                </select>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                <label for="campaign-months-in-past-filter">Months In Past</label>
                <input [(ngModel)]="notificationConfig.monthsInPast"
                       type="number" id="campaign-months-in-past-filter"
                       class="form-control input-sm">
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                <label for="member-selection">
                  Pre-Send Action</label>
                <select [compareWith]="arrayComparer" class="form-control input-sm"
                        [(ngModel)]="notificationConfig.preSendActions"
                        id="member-selection">
                  <option *ngFor="let type of workflowActions"
                          [ngValue]="keyValueAsArray(type)">{{ stringUtils.asTitle(type.value) }}
                  </option>
                </select>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                <label for="member-selection">
                  Post-Send Action</label>
                <select [compareWith]="arrayComparer" class="form-control input-sm"
                        [(ngModel)]="notificationConfig.postSendActions"
                        id="member-selection">
                  <option *ngFor="let type of workflowActions"
                          [ngValue]="keyValueAsArray(type)">{{ stringUtils.asTitle(type.value) }}
                  </option>
                </select>
              </div>
            </div>
            <div *ngIf="notificationConfig?.contentPreset" class="col-sm-12">
              <div class="form-group">
                <app-forgot-password-notification-details [params]="params"
                                                          [notificationConfig]="notificationConfig"/>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})

export class MailNotificationTemplateMappingComponent implements OnInit, OnDestroy {

  @Input("notificationConfig") set notificationConfigValue(notificationConfig: NotificationConfig) {
    this.notificationConfig = notificationConfig;
    this.logger.info("initialised with notificationConfig:", this.notificationConfig);
    if (this.notificationConfig) {
      this.mailMessagingService.initialiseSubject(this.notificationConfig);
    }
  }

  memberSelections: KeyValue<string>[] = [KEY_NULL_VALUE_NONE].concat(enumKeyValues(MemberSelection));
  workflowActions: KeyValue<string>[] = [KEY_NULL_VALUE_NONE].concat(enumKeyValues(WorkflowAction));
  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private subscriptions: Subscription[] = [];
  @Output() configDeleted: EventEmitter<string> = new EventEmitter();
  private logger: Logger = this.loggerFactory.createLogger("MailNotificationTemplateMappingComponent", NgxLoggerLevel.OFF);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  private broadcastService: BroadcastService<AlertMessageAndType> = inject(BroadcastService);
  private mailLinkService: MailLinkService = inject(MailLinkService);
  public urlService: UrlService = inject(UrlService);
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  public mailMessagingConfig: MailMessagingConfig;
  public parametersFrom: KeyValue<any>[] = [];
  public params: SendSmtpEmailParams;
  public notificationConfig!: NotificationConfig;

  protected readonly faAdd = faAdd;
  protected readonly faEraser = faEraser;
  protected readonly faCopy = faCopy;
  protected readonly first = first;
  protected readonly faMailBulk = faMailBulk;
  protected readonly faForward = faForward;
  protected readonly faBackward = faBackward;

  async ngOnInit() {
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.params = this.mailMessagingService.exampleEmailParams();
      this.notificationConfig = first(mailMessagingConfig.notificationConfigs);
      const parameters: KeyValue<any>[] = extractParametersFrom(this.params, false);
      const parametersAndValues: KeyValue<any>[] = extractParametersFrom(this.params, true);
      this.logger.info("parameters:raw:", parameters, "parameters:wrapped:", parametersAndValues);
      this.parametersFrom = [{
        key: null,
        value: "(none)"
      }].concat(parameters.filter(item => !item.key.includes("subject")));
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  arrayComparer(item1: string[], item2: string[]): boolean {
    return JSON.stringify(item1) === JSON.stringify(item2);
  }

  subject(): string {
    return this.notificationConfig?.subject?.text || "(no subject)";
  }

  toBannerInformation(bannerConfig: BannerConfig) {
    return `${bannerConfig.name || "Unnamed"} (${this.stringUtils.asTitle(bannerConfig.bannerType)})`;
  }

  editTemplate(templateId: number) {
    if (!this.notReady()) {
      if (this.mailMessagingConfig.mailConfig?.allowSendTransactional) {
        if (!templateId) {
          this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
            message: {
              title: "Edit Mail Template",
              message: "Please select a template from the drop-down before choosing edit"
            }, type: AlertLevel.ALERT_ERROR
          }));
        } else {
          const templateUrl = this.mailLinkService.templateEdit(templateId);
          this.logger.info("editing template:", templateUrl);
          return window.open(templateUrl, "_blank");
        }
      } else {
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
          message: {
            title: "Mail Integration not enabled",
            message: "List and campaign dropdowns will not be populated"
          }, type: AlertLevel.ALERT_WARNING
        }));
      }
    }
  }

  assignRolesTo(rolesChangeEvent: CommitteeRolesChangeEvent) {
    this.notificationConfig.signOffRoles = rolesChangeEvent.roles;
  }

  notReady() {
    return !this.notificationConfig?.templateId;
  }

  bannerSelected(selectedBanner: BannerConfig) {
    this.logger.info("selectedBanner:", selectedBanner);
  }

  formatKeyValue(keyValue: KeyValue<any>) {
    const key: string = keyValue.key ? this.stringUtils.asTitle(last(keyValue.key.split("."))) + ": " : "";
    return key + (keyValue.value || "");
  }

  deleteConfig() {
    if (this.notificationConfig.id) {
      this.configDeleted.emit(this.notificationConfig.id);
    }
    this.removeFromNotificationConfigs(this.notificationConfig);
    this.notificationConfig = first(this.mailMessagingConfig.notificationConfigs);
  }

  duplicateConfig() {
    const clone = cloneDeep(this.notificationConfig);
    delete clone.id;
    clone.subject.text = `Copy of ${clone.subject.text}`;
    this.addToNotificationConfigs(clone);
    this.notificationConfig = clone;
  }

  private addToNotificationConfigs(notificationConfig: NotificationConfig) {
    this.mailMessagingConfig.notificationConfigs.push(notificationConfig);
    this.logger.info("adding:", notificationConfig, "notificationConfigs:", this.mailMessagingConfig.notificationConfigs);
  }

  private removeFromNotificationConfigs(notificationConfig: NotificationConfig) {
    this.mailMessagingConfig.notificationConfigs = this.mailMessagingConfig.notificationConfigs.filter(item => item !== notificationConfig);
    this.logger.info("removing:", notificationConfig, this.mailMessagingConfig.notificationConfigs);
  }

  addNewConfig() {
    this.notificationConfig = {
      subject: {
        prefixParameter: null,
        text: null,
        suffixParameter: null
      },
      preSendActions: [],
      postSendActions: [],
      defaultMemberSelection: null,
      contentPreset: null,
      templateId: null,
      monthsInPast: 2,
      bannerId: null,
      senderRole: "membership",
      replyToRole: "membership",
      signOffRoles: ["membership"],
    };
    this.mailMessagingConfig.notificationConfigs.push(this.notificationConfig);
  }

  keyValueAsArray(input: KeyValue<string>) {
    const value = input.key ? [input.value] : [];
    this.logger.off("keyValueAsArray:input:", input, "value:", value);
    return value;
  }

  nextConfig() {
    if (!this.nextConfigDisabled()) {
      this.notificationConfig = this.mailMessagingConfig.notificationConfigs[this.mailMessagingConfig.notificationConfigs.indexOf(this.notificationConfig) + 1];
    }
  }

  previousConfig() {
    if (!this.previousConfigDisabled()) {
      this.notificationConfig = this.mailMessagingConfig.notificationConfigs[this.mailMessagingConfig.notificationConfigs.indexOf(this.notificationConfig) - 1];
    }
  }

  nextConfigDisabled() {
    return this.mailMessagingConfig.notificationConfigs.indexOf(this.notificationConfig) === this.mailMessagingConfig.notificationConfigs.length - 1;
  }

  previousConfigDisabled() {
    return this.mailMessagingConfig.notificationConfigs.indexOf(this.notificationConfig) === 0;
  }
}
