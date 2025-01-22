import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { CommitteeMember, Notification, NotificationItem } from "../../../models/committee.model";
import { Member, MemberFilterSelection, SORT_BY_NAME } from "../../../models/member.model";
import { SocialEvent } from "../../../models/social-events.model";
import { ConfirmType } from "../../../models/ui-actions";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SocialEventsService } from "../../../services/social-events/social-events.service";
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

@Component({
  selector: "app-social-send-notification-modal",
  template: `
    <div *ngIf="mailMessagingConfig" class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title">Send <em>Social Event</em> Notification</h4>
        <button (click)="bsModalRef.hide()" type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;
        </button>
      </div>
      <div class="modal-body" *ngIf="socialEvent?.notification?.content?.title">
        <tabset class="custom-tabset" *ngIf="socialEvent?.notification?.content">
          <tab heading="Recipients & Addressing">
            <div class="img-thumbnail thumbnail-admin-edit">
              <app-notification-config-selector (emailConfigChanged)="emailConfigChanged($event)"
                                                [notificationConfig]="socialEvent.notification?.content?.notificationConfig"
                                                [notificationConfigListing]="notificationConfigListing"/>
              <div class="row">
                <div class="col-sm-7"><label>Send to:</label>
                  <div class="form-group">
                    <ng-container *ngFor="let list of mailMessagingConfig?.brevo?.lists?.lists">
                      <div class="custom-control custom-radio">
                        <input class="custom-control-input"
                               id="send-list-{{list.id}}"
                               name="send-to"
                               type="radio"
                               [checked]="socialEvent.notification.content.listId === list.id"
                               [disabled]="selectionDisabled(list)"
                               (change)="selectList(list)"
                               [value]="list.id"/>
                        <label class="custom-control-label"
                               for="send-list-{{list.id}}">
                          {{ listNameAndMemberCount(list) }}</label>
                        <a class="ml-1 disabled" *ngIf="false"
                           (click)="editRecipientsFromList(list)">(edit)</a>
                      </div>
                    </ng-container>
                    <div class="custom-control custom-radio" *ngIf="false">
                      <input id="custom"
                             type="radio"
                             class="custom-control-input"
                             name="send-to"
                             [(ngModel)]="socialEvent.notification.content.listId"
                             value="custom"/>
                      <label class="custom-control-label" for="custom"><span
                        *ngIf="socialEvent?.notification?.content?.selectedMemberIds?.length===0">Choose individual recipients</span>
                        <div *ngIf="socialEvent?.notification?.content?.selectedMemberIds?.length>0">
                          {{ socialEvent?.notification?.content?.selectedMemberIds?.length }} recipient(s) chosen
                        </div>
                      </label>
                      <a class="ml-4" *ngIf="socialEvent.notification.content.selectedMemberIds.length>0"
                         (click)="clearRecipients(this.selectedList())">(clear)</a>
                    </div>
                  </div>
                </div>
                <div class="col col-sm-5"><label>Address as:</label>
                  <div class="form-group">
                    <div class="custom-control custom-radio">
                      <input id="addressee-first-name"
                             type="radio"
                             class="custom-control-input"
                             name="address-as"
                             [(ngModel)]="socialEvent.notification.content.addresseeType"
                             [value]="ADDRESSEE_CONTACT_FIRST_NAME"/>
                      <label class="custom-control-label" for="addressee-first-name">Hi <i>first name</i></label>
                    </div>
                    <div class="custom-control custom-radio">
                      <input id="addressee-all"
                             type="radio"
                             class="custom-control-input"
                             name="address-as"
                             [(ngModel)]="socialEvent.notification.content.addresseeType"
                             value="Hi all,"/>
                      <label class="custom-control-label" for="addressee-all">Hi all</label>
                    </div>
                    <div class="custom-control custom-radio">
                      <input id="addressee-none"
                             type="radio"
                             class="custom-control-input"
                             name="address-as"
                             [(ngModel)]="socialEvent.notification.content.addresseeType"
                             value=""/>
                      <label class="custom-control-label" for="addressee-none">No addressing</label>
                    </div>
                  </div>
                </div>
              </div>
              <div class="row" *ngIf="false">
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
                               [(ngModel)]="socialEvent.notification.content.selectedMemberIds">
                      <ng-template ng-optgroup-tmp let-item="item">
                        <span class="group-header">{{ item.name }} members</span>
                        <span class="ml-1 badge badge-secondary badge-group"> {{ item.total }} </span>
                      </ng-template>
                    </ng-select>
                  </div>
                </div>
              </div>
            </div>
          </tab>
          <tab heading="Edit Content">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="socialEvent.notification.content.title.include"
                             type="checkbox" class="custom-control-input"
                             id="include-title">
                      <label class="custom-control-label"
                             for="include-title">Include Title:
                      </label>
                    </div>
                    <textarea [(ngModel)]="socialEvent.briefDescription"
                              class="form-control input-sm"
                              [disabled]="!socialEvent?.notification?.content?.title?.include"
                              rows="1"
                              id="title"
                              placeholder="Enter the title you'd like at the top of the notification here"></textarea>
                  </div>
                </div>
              </div>
              <div class="row" *ngIf="socialEvent?.notification?.content?.eventDetails">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input
                        [(ngModel)]="socialEvent.notification.content.eventDetails.include"
                        type="checkbox" class="custom-control-input"
                        id="include-event-details">
                      <label class="custom-control-label"
                             for="include-event-details">Include Event details with title:
                      </label>
                    </div>
                    <input [(ngModel)]="socialEvent.notification.content.eventDetails.value"
                           type="text"
                           class="form-control input-sm"
                           [disabled]="!socialEvent?.notification?.content?.eventDetails?.include"
                           placeholder="Enter heading of event detail here">
                  </div>
                  <div class="row" *ngIf="socialEvent.attendees.length>0">
                    <div class="col-sm-12">
                      <div class="form-group">
                        <div class="custom-control custom-checkbox">
                          <input
                            [(ngModel)]="socialEvent.notification.content.attendees.include"
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
                </div>
              </div>
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input
                        [(ngModel)]="socialEvent.notification.content.text.include"
                        type="checkbox" class="custom-control-input"
                        id="include-notification-text">
                      <label
                        class="custom-control-label"
                        for="include-notification-text">Include Notification text:
                      </label>
                    </div>
                    <textarea [(ngModel)]="socialEvent.notification.content.text.value"
                              class="form-control input-sm" rows="5"
                              id="free-text"
                              [disabled]="!socialEvent?.notification?.content?.text?.include"
                              placeholder="Enter free text to be included of the notification here"></textarea>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input
                        [(ngModel)]="socialEvent.notification.content.description.include"
                        type="checkbox" class="custom-control-input"
                        id="include-description">
                      <label class="custom-control-label"
                             for="include-description">Include Social Event Description text:
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div class="row" *ngIf="socialEvent.attachment">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="socialEvent.notification.content.attachment.include"
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
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="socialEvent.notification.content.signoffText.include"
                             type="checkbox" class="custom-control-input"
                             id="include-signoff-text">
                      <label
                        class="custom-control-label"
                        for="include-signoff-text">Signoff with text:
                      </label>
                    </div>
                    <textarea [(ngModel)]="socialEvent.notification.content.signoffText.value"
                              class="form-control input-sm"
                              [disabled]="!socialEvent?.notification?.content?.signoffText?.include"
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
                      <input [(ngModel)]="socialEvent.notification.content.replyTo.include"
                             type="checkbox" class="custom-control-input"
                             id="include-reply-to">
                      <label class="custom-control-label"
                             for="include-reply-to">Send replies to:
                      </label>
                    </div>
                    <select [(ngModel)]="socialEvent.notification.content.replyTo.value" id="replyTo"
                            (ngModelChange)="modelChange('replyTo',$event)"
                            [disabled]="!socialEvent?.notification?.content?.replyTo?.include"
                            class="form-control input-sm">
                      <option *ngFor="let role of roles.replyTo"
                              [ngValue]="role.type">{{ role.nameAndDescription }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-12">
                  <div class="form-group">
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="socialEvent.notification.content.signoffAs.include"
                             type="checkbox" class="custom-control-input"
                             id="include-signoff-as">
                      <label class="custom-control-label"
                             for="include-signoff-as">Signoff and Send as:
                      </label>
                    </div>
                    <select [(ngModel)]="socialEvent.notification.content.signoffAs.value"
                            (ngModelChange)="socialEventSignoffChanged($event)"
                            id="signoff-as"
                            [disabled]="!socialEvent?.notification?.content?.signoffAs?.include"
                            class="form-control input-sm">
                      <option *ngFor="let role of roles.signoff"
                              [ngValue]="role.type">{{ role.nameAndDescription }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </tab>
          <tab heading="Preview">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div id="preview" class="print-preview">
                <div *ngIf="socialEvent.notification?.content?.notificationConfig?.bannerId" class="mb-2">
                  <img class="card-img"
                       [src]="mailMessagingService.bannerImageSource(socialEvent.notification?.content?.notificationConfig, false)">
                </div>
                <h2 class="mb-3">{{ socialEvent.notification.content.title.value }}</h2>
                <div #notificationContent>
                  <app-committee-notification-ramblers-message-item
                    [notificationItem]="toNotificationItemFromNotification(socialEvent.notification)">
                    <app-social-notification-details [members]="toMembers()" [socialEvent]="socialEvent"
                                                     [mailMessagingConfig]="mailMessagingConfig"/>
                  </app-committee-notification-ramblers-message-item>
                </div>
              </div>
            </div>
          </tab>
        </tabset>
        <div *ngIf="notifyTarget.showAlert" class="row">
          <div class="col-sm-12 mb-10">
            <div class="alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"/>
              <strong *ngIf="notifyTarget.alertTitle">
                {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
            </div>
          </div>
        </div>
        <div class="row" app-create-or-amend-sender (senderExists)="setSenderExists($event)"
             [committeeRoleSender]="signoffAs()"></div>
      </div>
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
    </div>`,
  standalone: false
})
export class SocialSendNotificationModalComponent implements OnInit, OnDestroy {

  constructor(private notifierService: NotifierService,
              private memberService: MemberService,
              private memberLoginService: MemberLoginService,
              private fullNameWithAlias: FullNameWithAliasPipe,
              protected mailMessagingService: MailMessagingService,
              protected mailService: MailService,
              private systemConfigService: SystemConfigService,
              public stringUtils: StringUtilsService,
              public display: SocialDisplayService,
              private socialEventsService: SocialEventsService,
              public mailLinkService: MailLinkService,
              private mailListUpdaterService: MailListUpdaterService,
              protected dateUtils: DateUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("SocialSendNotificationModalComponent", NgxLoggerLevel.ERROR);
  }
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  @ViewChild("notificationContent") notificationContent: ElementRef;
  public segmentEditingSupported = false;
  public socialEvent: SocialEvent;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
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
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  notReady(): boolean {
    return !this.senderExists || this.roles.replyTo.length === 0 || this.notifyTarget.busy || !this.socialEvent?.notification?.content?.listId;
  }

  initialiseNotification() {
    if (!this.socialEvent?.notification?.content) {
      this.socialEvent.notification.content = {notificationConfig: null};
      this.logger.info("initialiseNotification:content created");
    }
    if (!this.socialEvent.notification.content.notificationConfig) {
      this.socialEvent.notification.content.notificationConfig = first(this.mailMessagingService.notificationConfigs(this.notificationConfigListing));
      this.logger.info("initialiseNotification:notificationConfig created");
    }
    this.logger.info("initialiseNotification:notification content:", this.socialEvent.notification.content);
    this.defaultNotificationField(["addresseeType"], ADDRESSEE_CONTACT_FIRST_NAME);
    this.defaultNotificationField(["title"], {include: true});
    this.defaultNotificationField(["text"], {include: true, value: ""});
    this.defaultNotificationField(["eventDetails"], {
      include: true,
      value: "Social Event details"
    });
    this.defaultNotificationField(["description"], {include: true});
    this.defaultNotificationField(["attendees"], {include: this.socialEvent.attendees.length > 0});
    this.defaultNotificationField(["attachment"], {include: !!this.socialEvent.attachment});
    this.defaultNotificationField(["replyTo"], {
      include: true,
      value: this.roleForType(this.socialEvent.displayName ? "organiser" : "social")?.type
    });
    this.defaultNotificationField(["signoffText"], {
      include: true,
      value: "If you have any questions about the above, please don't hesitate to contact me.\n\nBest regards,"
    });
    this.defaultNotificationField(["signoffAs"], {
      include: true,
      value: this.roleForType("social")?.type
    });
    this.emailConfigChanged(this.socialEvent.notification.content.notificationConfig);
    this.logger.info("initialiseNotification:socialEvent.notification ->", this.socialEvent.notification);
  }

  defaultNotificationField(path: string[], value: any) {
    const target = get(this.socialEvent?.notification?.content, path);
    if (isUndefined(target)) {
      this.logger.info("existing target:", target, "setting path:", path, "to value:", value,);
      set(this.socialEvent?.notification?.content, path, value);
    } else {
      this.logger.info(target, "already set");
    }
    return target;
  }


  editRecipientsFromList(list: ListInfo) {
    if (this.segmentEditingSupported) {
      this.socialEvent.notification.content.listId = list.id;
      this.socialEvent.notification.content.selectedMemberIds = this.subscribedToEmailsForList(list).map(item => item.id);
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

  roleForType(type: string): CommitteeMember {
    const role = this.roles.replyTo.find(role => role.type === type);
    this.logger.info("roleForType for", type, "->", role);
    return role;
  }

  initialiseRoles(members: Member[]) {
    const roles = this.display.committeeMembersPlusOrganiser(this.socialEvent, members);
    this.roles.replyTo = roles;
    this.roles.signoff = roles;
  }

  clearRecipients(list: ListInfo) {
    if (this.segmentEditingSupported) {
      this.logger.info("clearRecipients: pre clear - recipients:", this.socialEvent?.notification?.content.selectedMemberIds);
      this.socialEvent.notification.content.selectedMemberIds = [];
    }
  }

  memberGrouping(member) {
    return member.memberGrouping;
  }

  cancelSendNotification() {
    this.bsModalRef.hide();
  }

  saveAndSendLater() {
    this.socialEventsService.update(this.socialEvent).then(() => this.bsModalRef.hide());
  }

  selectedList(): ListInfo {
    return this.mailMessagingConfig?.brevo?.lists?.lists?.find(item => item.id === this?.socialEvent?.notification?.content?.listId);
  }

  selectList(list: ListInfo) {
    this.logger.info("selectList:", list);
    this.socialEvent.notification.content.listId = list.id;
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
    return this.socialEventsService.createOrUpdate(this.socialEvent);
  }

  notifyEmailSendComplete(campaignName: string) {
    this.notify.success("Sending of " + campaignName + " was successful.", false);
    this.notify.clearBusy();
    this.bsModalRef.hide();
  }

  onChange($event: any) {
    this.logger.info("$event", $event, "socialEvent.notification.content.selectedMemberIds:", this.socialEvent?.notification?.content.selectedMemberIds);
    if (this.socialEvent?.notification?.content.selectedMemberIds.length > 0) {
      this.notify.warning({
        title: "Member selection",
        message: `${this.socialEvent?.notification?.content.selectedMemberIds.length} members manually selected`
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
    const replyToRole: CommitteeMember = this.replyToRole() || this.roleForType("social");
    const senderRole: CommitteeMember = this.signoffAs();
    const signoffRoles: string[] = [senderRole.type];
    this.logger.info("signoffRoles:", signoffRoles);
    const member: Member = await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    const createCampaignRequest: CreateCampaignRequest = {
      createAsDraft,
      templateId: this.socialEvent.notification.content.notificationConfig.templateId,
      htmlContent: bodyContent,
      inlineImageActivation: false,
      mirrorActive: false,
      name: campaignName,
      params: this.mailMessagingService.createSendSmtpEmailParams(signoffRoles, this.notificationDirective, member, this.socialEvent.notification.content.notificationConfig, bodyContent, this.socialEvent.notification?.content.signoffAs.include, this.socialEvent.notification.content.title.value, this.socialEvent.notification.content.addresseeType),
      recipients: {listIds: [this.socialEvent.notification.content.listId]},
      replyTo: replyToRole.email,
      sender: {
        email: senderRole.email,
        name: senderRole.fullName
      },
      subject: campaignName
    };
    this.logger.info("sendEmailCampaign:notification:", this.socialEvent.notification);
    this.logger.info("sendEmailCampaign:createCampaignRequest:", createCampaignRequest);
    if (this.socialEvent.notification.content?.listId > 0) {
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
    const campaignName = this.socialEvent.briefDescription;
    this.logger.info("sendSocialNotification:notification->", this.socialEvent.notification);
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
    this.socialEvent.notification.content.notificationConfig = notificationConfig;
    if (notificationConfig.defaultListId) {
      this.socialEvent.notification.content.listId = notificationConfig.defaultListId;
    }
    this.logger.info("emailConfigChanged:notificationConfig", notificationConfig, "notification.content.listId:", this.socialEvent.notification.content.listId);
  }

  socialEventSignoffChanged(memberId: any) {
    this.logger.info("socialEventSignoffChanged:memberId", memberId);
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
    this.logger.info("modelChange:", type, "data:", data, "notification content:", this.socialEvent.notification.content[type]);
  }

  signoffAs(): CommitteeMember {
    const signoffAs = this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members)?.find(member => this.socialEvent?.notification?.content?.signoffAs?.value === member.type);
    this.logger.off("signoffAs:", this.members, signoffAs);
    return signoffAs;
  }


  replyToRole(): CommitteeMember {
    const membersPlusOrganiser = this.display?.committeeMembersPlusOrganiser(this.socialEvent, this.members);
    const sender: CommitteeMember = membersPlusOrganiser?.find(member => this.socialEvent?.notification?.content?.replyTo?.value === member.type);
    this.logger.info("replyTo:", this.socialEvent?.notification?.content?.replyTo, "sender:", sender);
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
