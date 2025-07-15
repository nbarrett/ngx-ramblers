import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { BuiltInRole, CommitteeMember, Notification, NotificationItem } from "../../../models/committee.model";
import { Member, MemberFilterSelection, SORT_BY_NAME } from "../../../models/member.model";
import { ConfirmType } from "../../../models/ui-actions";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SocialDisplayService } from "../social-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { SystemConfig } from "../../../models/system.model";
import { Subscription } from "rxjs";
import {
  ADDRESSEE_CONTACT_FIRST_NAME,
  CreateCampaignRequest,
  ListInfo,
  MailMessagingConfig,
  MemberSelection,
  NotificationConfig,
  NotificationConfigListing,
  StatusMappedResponseSingleInput
} from "../../../models/mail.model";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import { MailService } from "../../../services/mail/mail.service";
import first from "lodash-es/first";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { isUndefined, set } from "lodash-es";
import get from "lodash-es/get";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { NotificationConfigSelectorComponent } from "../../admin/system-settings/mail/notification-config-selector";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgOptgroupTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import {
  CommitteeNotificationRamblersMessageItemComponent
} from "../../../notifications/committee/templates/committee-notification-ramblers-message-item";
import {
  SocialNotificationDetailsComponent
} from "../../../notifications/social/templates/social-notification-details.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CreateOrAmendSenderComponent } from "../../admin/send-emails/create-or-amend-sender";
import { BrevoButtonComponent } from "../../../modules/common/third-parties/brevo-button";
import { TitleCasePipe } from "@angular/common";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import last from "lodash-es/last";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import cloneDeep from "lodash-es/cloneDeep";

@Component({
    selector: "app-social-send-notification-modal",
    template: `
    @if (mailMessagingConfig) {
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title">Send <em>Social Event</em> Notification</h4>
          <button (click)="bsModalRef.hide()" type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;
          </button>
        </div>
        @if (latestNotification?.content?.title) {
          <div class="modal-body">
            @if (latestNotification?.content) {
              <tabset class="custom-tabset">
                <tab heading="Recipients & Addressing">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <app-notification-config-selector (emailConfigChanged)="emailConfigChanged($event)"
                      [notificationConfig]="latestNotification?.content?.notificationConfig"
                      [notificationConfigListing]="notificationConfigListing"/>
                    <div class="row">
                      <div class="col-sm-7"><label>Send to:</label>
                      <div class="form-group">
                        @for (list of mailMessagingConfig?.brevo?.lists?.lists; track list.id) {
                          <div class="custom-control custom-radio">
                            <input class="custom-control-input"
                              id="send-list-{{list.id}}"
                              name="send-to"
                              type="radio"
                              [checked]="latestNotification?.content?.listId === list.id"
                              [disabled]="selectionDisabled(list)"
                              (change)="selectList(list)"
                              [value]="list.id"/>
                            <label class="custom-control-label"
                              for="send-list-{{list.id}}">
                            {{ listNameAndMemberCount(list) }}</label>
                            @if (false) {
                              <a class="ml-1 disabled"
                              (click)="editRecipientsFromList(list)">(edit)</a>
                            }
                          </div>
                        }
                        @if (false) {
                          <div class="custom-control custom-radio">
                            <input id="custom"
                              type="radio"
                              class="custom-control-input"
                              name="send-to"
                              [(ngModel)]="latestNotification.content.listId"
                              value="custom"/>
                            <label class="custom-control-label" for="custom">@if (latestNotification?.content?.selectedMemberIds?.length===0) {
                              <span
                              >Choose individual recipients</span>
                            }
                            @if (latestNotification?.content?.selectedMemberIds?.length>0) {
                              <div>
                                {{ latestNotification?.content?.selectedMemberIds?.length }} recipient(s) chosen
                              </div>
                            }
                          </label>
                          @if (latestNotification?.content?.selectedMemberIds.length>0) {
                            <a class="ml-4"
                            (click)="clearRecipients(this.selectedList())">(clear)</a>
                          }
                        </div>
                      }
                    </div>
                  </div>
                  <div class="col col-sm-5"><label>Address as:</label>
                  <div class="form-group">
                    <div class="custom-control custom-radio">
                      <input id="addressee-first-name"
                        type="radio"
                        class="custom-control-input"
                        name="address-as"
                        [(ngModel)]="latestNotification.content.addresseeType"
                        [value]="ADDRESSEE_CONTACT_FIRST_NAME"/>
                      <label class="custom-control-label" for="addressee-first-name">Hi <i>first name</i></label>
                    </div>
                    <div class="custom-control custom-radio">
                      <input id="addressee-all"
                        type="radio"
                        class="custom-control-input"
                        name="address-as"
                        [(ngModel)]="latestNotification.content.addresseeType"
                        value="Hi all,"/>
                      <label class="custom-control-label" for="addressee-all">Hi all</label>
                    </div>
                    <div class="custom-control custom-radio">
                      <input id="addressee-none"
                        type="radio"
                        class="custom-control-input"
                        name="address-as"
                        [(ngModel)]="latestNotification.content.addresseeType"
                        value=""/>
                      <label class="custom-control-label" for="addressee-none">No addressing</label>
                    </div>
                  </div>
                </div>
              </div>
              @if (false) {
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-group" placement="bottom"
                      [tooltip]="helpMembers()">
                      <ng-select [items]="display.memberFilterSelections"
                        bindLabel="text"
                        name="member-selector"
                        bindValue="id"
                        placeholder="Select one or more members"
                        [disabled]="notifyTarget.busy"
                        [dropdownPosition]="'bottom'"
                        [groupBy]="groupBy"
                        [groupValue]="groupValue"
                        [multiple]="true"
                        [closeOnSelect]="true"
                        (change)="onChange($event)"
                        [(ngModel)]="latestNotification.content.selectedMemberIds">
                        <ng-template ng-optgroup-tmp let-item="item">
                          <span class="group-header">{{ item.name }} members</span>
                          <span class="ml-1 badge badge-secondary badge-group"> {{ item.total }} </span>
                        </ng-template>
                      </ng-select>
                    </div>
                  </div>
                </div>
              }
            </div>
          </tab>
          <tab heading="Edit Content">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="latestNotification.content.title.include"
                        type="checkbox" class="custom-control-input"
                        id="include-title">
                      <label class="custom-control-label"
                        for="include-title">Include Title:
                      </label>
                    </div>
                    <textarea [(ngModel)]="socialEvent.groupEvent.title"
                      class="form-control input-sm"
                      [disabled]="!latestNotification?.content?.title?.include"
                      rows="1"
                      id="title"
                    placeholder="Enter the title you'd like at the top of the notification here"></textarea>
                  </div>
                </div>
              </div>
              @if (latestNotification?.content?.eventDetails) {
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-group">
                      <div class="custom-control custom-checkbox">
                        <input
                          [(ngModel)]="latestNotification.content.eventDetails.include"
                          type="checkbox" class="custom-control-input"
                          id="include-event-details">
                        <label class="custom-control-label"
                          for="include-event-details">Include Event details with title:
                        </label>
                      </div>
                      <input [(ngModel)]="latestNotification.content.eventDetails.value"
                        type="text"
                        class="form-control input-sm"
                        [disabled]="!latestNotification?.content?.eventDetails?.include"
                        placeholder="Enter heading of event detail here">
                    </div>
                    @if (socialEvent.fields.attendees.length>0) {
                      <div class="row">
                        <div class="col-sm-12">
                          <div class="form-group">
                            <div class="custom-control custom-checkbox">
                              <input
                                [(ngModel)]="latestNotification.content.attendees.include"
                                type="checkbox" class="custom-control-input"
                                id="include-attendees">
                              <label
                                class="custom-control-label"
                                for="include-attendees">Include List of attendees:
                                <span
                                  style="font-weight: normal"> ({{ display.attendeeList(socialEvent, display.memberFilterSelections) }}
                                )</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input
                        [(ngModel)]="latestNotification.content.text.include"
                        type="checkbox" class="custom-control-input"
                        id="include-notification-text">
                      <label
                        class="custom-control-label"
                        for="include-notification-text">Include Notification text:
                      </label>
                    </div>
                    <textarea [(ngModel)]="latestNotification.content.text.value"
                      class="form-control input-sm" rows="5"
                      id="free-text"
                      [disabled]="!latestNotification?.content?.text?.include"
                    placeholder="Enter free text to be included of the notification here"></textarea>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input
                        [(ngModel)]="latestNotification.content.description.include"
                        type="checkbox" class="custom-control-input"
                        id="include-description">
                      <label class="custom-control-label"
                        for="include-description">Include Social Event Description text:
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              @if (socialEvent.fields.attachment) {
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-group">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="latestNotification.content.attachment.include"
                          type="checkbox" class="custom-control-input"
                          id="include-attachment">
                        <label class="custom-control-label"
                          for="include-attachment">Include link to attachment:
                          <span
                          style="font-weight: normal"> {{ display.attachmentTitle(socialEvent) }}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              }
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="latestNotification.content.signoffText.include"
                        type="checkbox" class="custom-control-input"
                        id="include-signoff-text">
                      <label
                        class="custom-control-label"
                        for="include-signoff-text">Signoff with text:
                      </label>
                    </div>
                    <textarea [(ngModel)]="latestNotification.content.signoffText.value"
                      class="form-control input-sm"
                      [disabled]="!latestNotification?.content?.signoffText?.include"
                      rows="3"
                      id="signoff-text"
                    placeholder="Enter any signoff text to be included of the notification here"></textarea>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="latestNotification.content.replyTo.include"
                        type="checkbox" class="custom-control-input"
                        id="include-reply-to">
                      <label class="custom-control-label"
                        for="include-reply-to">Send replies to:
                      </label>
                    </div>
                    <select [(ngModel)]="latestNotification.content.replyTo.value" id="replyTo"
                      (ngModelChange)="modelChange('replyTo',$event)"
                      [disabled]="!latestNotification?.content?.replyTo?.include"
                      class="form-control input-sm">
                      @for (role of roles.replyTo; track role) {
                        <option
                          [ngValue]="role.type">{{ role.nameAndDescription }}
                        </option>
                      }
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="latestNotification.content.signoffAs.include"
                        type="checkbox" class="custom-control-input"
                        id="include-signoff-as">
                      <label class="custom-control-label"
                        for="include-signoff-as">Signoff and Send as:
                      </label>
                    </div>
                    <select [(ngModel)]="latestNotification.content.signoffAs.value"
                      (ngModelChange)="socialEventSignoffChanged($event)"
                      id="signoff-as"
                      [disabled]="!latestNotification?.content?.signoffAs?.include"
                      class="form-control input-sm">
                      @for (role of roles.signoff; track role) {
                        <option
                          [ngValue]="role.type">{{ role.nameAndDescription }}
                        </option>
                      }
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </tab>
          <tab heading="Preview">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div id="preview" class="print-preview">
                @if (latestNotification?.content?.notificationConfig?.bannerId) {
                  <div class="mb-2">
                    <img class="card-img"
                      [src]="mailMessagingService.bannerImageSource(latestNotification?.content?.notificationConfig, false)">
                  </div>
                }
                <h2 class="mb-3">{{ latestNotification?.content?.title.value }}</h2>
                <div #notificationContent>
                  <app-committee-notification-ramblers-message-item
                    [notificationItem]="toNotificationItemFromNotification(latestNotification)">
                    <app-social-notification-details [members]="toMembers()" [socialEvent]="socialEvent"
                      [mailMessagingConfig]="mailMessagingConfig"/>
                  </app-committee-notification-ramblers-message-item>
                </div>
              </div>
            </div>
          </tab>
        </tabset>
      }
      @if (notifyTarget.showAlert) {
        <div class="row">
          <div class="col-sm-12 mb-10">
            <div class="alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"/>
              @if (notifyTarget.alertTitle) {
                <strong>
                {{ notifyTarget.alertTitle }}: </strong>
                } {{ notifyTarget.alertMessage }}
              </div>
            </div>
          </div>
        }
        <div class="row" app-create-or-amend-sender (senderExists)="setSenderExists($event)"
        [committeeRoleSender]="signoffAs()"></div>
      </div>
    }
    <div class="modal-footer">
      <app-brevo-button button [disabled]="notReady()" (click)="runCampaignCreationAndSendWorkflow()"
        title="Send Now via {{systemConfig?.mailDefaults?.mailProvider| titlecase}}"/>
      <app-brevo-button class="ml-2" button [disabled]="notReady()" (click)="completeInMailSystem()"
        title="Complete in {{systemConfig?.mailDefaults?.mailProvider| titlecase}}"/>
      <input type="submit" value="Save and Send Later" (click)="saveAndSendLater()"
        class="ml-2 btn btn-primary px-2 py-2">
      <input type="submit" value="Cancel Send" (click)="cancelSendNotification()"
        class="ml-2 btn btn-primary px-2 py-2 mr-2">
    </div>
    <div class="d-none">
      <ng-template app-notification-directive/>
    </div>
    </div>
    }`,
    imports: [TabsetComponent, TabDirective, NotificationConfigSelectorComponent, FormsModule, TooltipDirective, NgSelectComponent, NgOptgroupTemplateDirective, CommitteeNotificationRamblersMessageItemComponent, SocialNotificationDetailsComponent, FontAwesomeModule, CreateOrAmendSenderComponent, BrevoButtonComponent, NotificationDirective, TitleCasePipe]
})
export class SocialSendNotificationModalComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialSendNotificationModalComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private memberService = inject(MemberService);
  private memberLoginService = inject(MemberLoginService);
  private fullNameWithAlias = inject(FullNameWithAliasPipe);
  protected mailMessagingService = inject(MailMessagingService);
  protected mailService = inject(MailService);
  private systemConfigService = inject(SystemConfigService);
  stringUtils = inject(StringUtilsService);
  display = inject(SocialDisplayService);
  private walksAndEventsService = inject(WalksAndEventsService);
  mailLinkService = inject(MailLinkService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  protected dateUtils = inject(DateUtilsService);
  bsModalRef = inject(BsModalRef);
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  @ViewChild("notificationContent") notificationContent: ElementRef;
  public segmentEditingSupported = false;
  public socialEvent: ExtendedGroupEvent;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public roles: {
    replyTo: CommitteeMember[];
    signoff: CommitteeMember[];
  } = {replyTo: [], signoff: []};
  private subscriptions: Subscription[] = [];
  public systemConfig: SystemConfig;
  public mailMessagingConfig: MailMessagingConfig;
  public notificationConfigListing: NotificationConfigListing;
  public members: Member[] = [];

  protected readonly ADDRESSEE_CONTACT_FIRST_NAME = ADDRESSEE_CONTACT_FIRST_NAME;
  protected senderExists = false;
  public latestNotification: Notification;
  async ngOnInit() {
    this.logger.info("ngOnInit", this.socialEvent, "memberFilterSelections:", this.display.memberFilterSelections);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget, NgxLoggerLevel.ERROR);
    this.subscriptions.push(this.mailMessagingService.events().subscribe(async mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.notificationConfigListing = {mailMessagingConfig, includeMemberSelections: [MemberSelection.MAILING_LIST]};
      this.members = await this.memberService.all();
      this.initialiseRoles(this.members);
      this.initialiseNotification();
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(async (systemConfig: SystemConfig) => {
      this.systemConfig = systemConfig;
      this.logger.info("retrieved systemConfig", systemConfig);
    }));
    this.display.confirm.as(ConfirmType.SEND_NOTIFICATION);
    this.latestNotification = last(this.socialEvent?.fields.notifications) || {};
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  notReady(): boolean {
    return !this.senderExists || this.roles.replyTo.length === 0 || this.notifyTarget.busy || !this.latestNotification?.content?.listId || !this.latestNotification?.content?.replyTo.value || !this.latestNotification?.content?.signoffAs.value;
  }

  initialiseNotification() {
    if (!this.socialEvent.fields.notifications) {
      this.socialEvent.fields.notifications = [];
      this.logger.info("initialiseNotification:notifications initialised");
    }
    if (this.socialEvent.fields.notifications.length === 0 || !last(this.socialEvent.fields.notifications)?.content) {
      this.latestNotification = {content: {notificationConfig: null}};
      this.logger.info("initialiseNotification:creating first notification as:", this.latestNotification);
      this.socialEvent.fields.notifications.push(this.latestNotification);
      this.logger.info("initialiseNotification:content created");
    } else {
      this.latestNotification = last(this.socialEvent.fields.notifications);
      this.logger.info("initialiseNotification:using existing notification:", this.latestNotification);
    }
    if (!this.latestNotification?.content?.notificationConfig) {
      const notificationConfigs = this.mailMessagingService.notificationConfigs(this.notificationConfigListing);
      this.latestNotification.content.notificationConfig = notificationConfigs.find(item => item.subject?.text?.toLowerCase()?.includes("social")) || first(notificationConfigs);
      this.logger.info("initialiseNotification:notificationConfig created");
    }
    this.logger.info("initialiseNotification:notification content:", this.latestNotification.content);
    this.defaultNotificationContentField(["addresseeType"], ADDRESSEE_CONTACT_FIRST_NAME);
    this.defaultNotificationContentField(["title"], {include: true});
    this.defaultNotificationContentField(["text"], {include: true, value: ""});
    this.defaultNotificationContentField(["eventDetails"], {
      include: true,
      value: "Social Event details"
    });
    this.defaultNotificationContentField(["description"], {include: true});
    this.defaultNotificationContentField(["attendees"], {include: this.socialEvent.fields.attendees.length > 0});
    this.defaultNotificationContentField(["attachment"], {include: !!this.socialEvent.fields.attachment});
    this.defaultNotificationContentField(["replyTo"], {
      include: true,
      value: this.committeeMemberForTypeOrBuiltInRole(this.socialEvent?.fields?.contactDetails?.displayName ? "organiser" : BuiltInRole.SOCIAL_CO_ORDINATOR)?.type
    });
    this.defaultNotificationContentField(["signoffText"], {
      include: true,
      value: "If you have any questions about the above, please don't hesitate to contact me.\n\nBest regards,"
    });
    this.defaultNotificationContentField(["signoffAs"], {
      include: true,
      value: this.committeeMemberForTypeOrBuiltInRole(BuiltInRole.SOCIAL_CO_ORDINATOR)?.type
    });
    this.emailConfigChanged(this.latestNotification?.content?.notificationConfig);
    this.logger.info("initialiseNotification:latestNotification ->", this.latestNotification);
  }

  defaultNotificationContentField(path: string[], value: any) {
    const target = get(this.latestNotification?.content, path);
    if (isUndefined(target)) {
      set(this.latestNotification?.content, path, value);
      this.logger.info("defaultNotificationContentField:existing target:", target, "set path:", path, "to value:", value, "notification:", cloneDeep(this.latestNotification));
    } else {
      this.logger.info("defaultNotificationContentField:existing target:", target, "already set");
    }
    return target;
  }


  editRecipientsFromList(list: ListInfo) {
    if (this.segmentEditingSupported) {
      this.latestNotification.content.listId = list.id;
      this.latestNotification.content.selectedMemberIds = this.subscribedToEmailsForList(list).map(item => item.id);
    }
  }

  subscribedToEmailsForList(list: ListInfo): MemberFilterSelection[] {
    return this.members
      .filter(this.memberService.filterFor.GROUP_MEMBERS)
      .filter(member => this.mailListUpdaterService.memberSubscribed(member, list.id))
      .map(member => this.toMemberFilterSelection(member, list))
      .sort(SORT_BY_NAME);
  }

  toMemberFilterSelection(member: Member, list: ListInfo): MemberFilterSelection {
    const disabled = !member.email;
    return {
      id: member.id,
      order: 0,
      memberGrouping: disabled ? "no email address" : `Subscribed to ${list.name} emails`,
      member,
      memberInformation: this.fullNameWithAlias.transform(member),
      disabled
    };
  }

  committeeMemberForTypeOrBuiltInRole(type: string): CommitteeMember {
    const committeeMember = this.roles.replyTo.find(role => [role.type, role.builtInRoleMapping].includes(type));
    this.logger.info("committeeMemberForTypeOrBuiltInRole for", type, "->", committeeMember);
    return committeeMember;
  }

  initialiseRoles(members: Member[]) {
    const roles = this.display.committeeMembersPlusOrganiser(this.socialEvent, members);
    this.roles.replyTo = roles;
    this.roles.signoff = roles;
  }

  clearRecipients(list: ListInfo) {
    if (this.segmentEditingSupported) {
      this.logger.info("clearRecipients: pre clear - recipients:", this.latestNotification?.content.selectedMemberIds);
      this.latestNotification.content.selectedMemberIds = [];
    }
  }

  memberGrouping(member) {
    return member.memberGrouping;
  }

  cancelSendNotification() {
    this.bsModalRef.hide();
  }

  saveAndSendLater() {
    this.walksAndEventsService.update(this.socialEvent).then(() => this.bsModalRef.hide());
  }

  selectedList(): ListInfo {
    return this.mailMessagingConfig?.brevo?.lists?.lists?.find(item => item.id === this?.latestNotification?.content?.listId);
  }

  selectList(list: ListInfo) {
    this.logger.info("selectList:", list);
    this.latestNotification.content.listId = list.id;
  }

  handleError(errorResponse: any) {
    this.logger.error("errorResponse", errorResponse);
    this.notify.error({
      continue: true,
      title: "Your notification could not be sent",
      message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + JSON.stringify(errorResponse.error)) : "")
    });
    this.notify.clearBusy();
  }

  public toMembers(): Member[] {
    return this.display.memberFilterSelections.map(item => item.member);
  }

  saveSocialEvent() {
    return this.walksAndEventsService.createOrUpdate(this.socialEvent);
  }

  notifyEmailSendComplete(campaignName: string) {
    this.notify.success("Sending of " + campaignName + " was successful.", false);
    this.notify.clearBusy();
    this.bsModalRef.hide();
  }

  onChange($event: any) {
    this.logger.info("$event", $event, "latestNotification.content.selectedMemberIds:", this.latestNotification?.content.selectedMemberIds);
    if (this.latestNotification?.content.selectedMemberIds.length > 0) {
      this.notify.warning({
        title: "Member selection",
        message: `${this.latestNotification?.content.selectedMemberIds.length} members manually selected`
      });
    } else {
      this.notify.hide();
    }
  }

  helpMembers() {
    return `Click below and select`;
  }

  groupBy(member: MemberFilterSelection) {
    return member.memberGrouping;
  }

  groupValue(_: string, children: any[]) {
    return ({name: children[0].memberGrouping, total: children.length});
  }

  async createThenEditOrSendEmailCampaign(bodyContent: string, campaignName: string, createAsDraft: boolean) {
    this.notify.progress(createAsDraft ? (`Preparing to complete ${campaignName} in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`) : ("Sending " + campaignName));
    const replyToRole: CommitteeMember = this.replyToRole() || this.committeeMemberForTypeOrBuiltInRole(BuiltInRole.SOCIAL_CO_ORDINATOR);
    const senderRole: CommitteeMember = this.signoffAs();
    this.logger.info("replyToRole:", replyToRole, "senderRole:", senderRole);
    const signoffRoles: string[] = [senderRole.type];
    this.logger.info("signoffRoles:", signoffRoles);
    const member: Member = await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    const createCampaignRequest: CreateCampaignRequest = {
      createAsDraft,
      templateId: this.latestNotification?.content?.notificationConfig.templateId,
      htmlContent: bodyContent,
      inlineImageActivation: false,
      mirrorActive: false,
      name: campaignName,
      params: this.mailMessagingService.createSendSmtpEmailParams(signoffRoles, this.notificationDirective, member, this.latestNotification.content.notificationConfig, bodyContent, this.latestNotification?.content.signoffAs.include, this.latestNotification?.content?.title.value, this.latestNotification?.content?.addresseeType),
      recipients: {listIds: [this.latestNotification?.content?.listId]},
      replyTo: replyToRole.email,
      sender: {
        email: senderRole.email,
        name: senderRole.fullName
      },
      subject: campaignName
    };
    this.logger.info("sendEmailCampaign:notification:", this.latestNotification);
    this.logger.info("sendEmailCampaign:createCampaignRequest:", createCampaignRequest);
    if (this.latestNotification.content?.listId > 0) {
      this.logger.info("about to send email campaign to lists", this.selectedList(), "with campaign name:", campaignName, "create as draft:", createAsDraft);
      const createCampaignResponse: StatusMappedResponseSingleInput = await this.mailService.createCampaign(createCampaignRequest);
      const campaignId: number = createCampaignResponse?.responseBody?.id;
      this.logger.info("sendEmailCampaign:createCampaignResponse:", createCampaignResponse, "create as draft:", createAsDraft, "campaign Id:", campaignId);
      if (createAsDraft) {
        window.open(`${this.mailLinkService.campaignEditRichText(campaignId)}`, "_blank");
      } else {
        const sendCampaignResponse: StatusMappedResponseSingleInput = await this.mailService.sendCampaign({campaignId});
        this.logger.info("sendCampaignResponse:", sendCampaignResponse);
      }
      this.notifyEmailSendComplete(campaignName);
    } else {
      this.notify.error({
        title: "Send Social notification",
        message: `${this.creationOrSending(createAsDraft)} of ${campaignName} was not successful as no lists were found to send to`
      });
    }
  }

  creationOrSending(createAsDraft: boolean): string {
    return createAsDraft ? "Creation" : "Sending";
  }

  generateNotificationHTML(): string {
    const bodyContent = this.notificationContent?.nativeElement?.innerHTML;
    this.logger.info("this.generateNotificationHTML bodyContent ->", bodyContent);
    return bodyContent;
  }

  runCampaignCreationAndSendWorkflow(createAsDraft?: boolean) {
    if (!this.notReady()) {
    this.notify.setBusy();
    const campaignName = this.socialEvent?.groupEvent?.title;
    this.logger.info("sendSocialNotification:notification->", this.latestNotification);
    return Promise.resolve()
      .then(() => this.notify.progress({title: campaignName, message: "preparing and sending notification"}))
      .then(() => this.generateNotificationHTML())
      .then((bodyContent) => this.createThenEditOrSendEmailCampaign(bodyContent, campaignName, createAsDraft))
      .then(() => this.saveSocialEvent())
      .then(() => this.notifyEmailSendComplete(campaignName))
      .catch((error) => this.handleError(error));
    }
  }

  completeInMailSystem() {
    if (!this.notReady()) {
    this.notify.warning({
      title: `Complete in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`,
      message: `You can close this dialog now as the message was presumably completed and sent in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`
    });
    this.runCampaignCreationAndSendWorkflow(true);
    }
  }

  emailConfigChanged(notificationConfig: NotificationConfig) {
    this.latestNotification.content.notificationConfig = notificationConfig;
    if (notificationConfig.defaultListId) {
      this.latestNotification.content.listId = notificationConfig.defaultListId;
    }
    this.logger.info("emailConfigChanged:notificationConfig", notificationConfig, "notification.content.listId:", this.latestNotification?.content?.listId);
  }

  socialEventSignoffChanged(type: any) {
    this.logger.info("socialEventSignoffChanged:type", type);
  }

  selectionDisabled(list: ListInfo): boolean {
    const disabled = this.subscribedToEmailsForList(list).length === 0;
    this.logger.debug("list selection disabled for", list.name, disabled);
    return disabled;
  }

  listNameAndMemberCount(list: ListInfo) {
    return `${list.name} (${this.stringUtils.pluraliseWithCount(this.subscribedToEmailsForList(list)?.length || 0, "member")})`;
  }

  modelChange(type: string, data: any) {
    this.logger.info("modelChange:", type, "data:", data, "notification content:", this.latestNotification.content[type]);
  }

  signoffAs(): CommitteeMember {
    const signoffAs = this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members)?.find(member => this.latestNotification?.content?.signoffAs?.value === member.type);
    this.logger.off("signoffAs:", this.members, signoffAs);
    return signoffAs;
  }


  replyToRole(): CommitteeMember {
    const membersPlusOrganiser = this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members);
    const sender: CommitteeMember = membersPlusOrganiser?.find(member => this.latestNotification?.content?.replyTo?.value === member.type);
    this.logger.info("replyTo:", this.latestNotification?.content?.replyTo, "sender:", sender);
    return sender;

  }

  setSenderExists(senderExists: boolean) {
    this.logger.info("setSenderExists:from:", this.senderExists, "to:", senderExists);
    this.senderExists = senderExists;
  }

  toNotificationItemFromNotification(notification: Notification): NotificationItem {
    return {
      callToAction: null,
      image: null,
      subject: notification.content.title.value,
      text: notification.content.text.value
    };
  }
}
