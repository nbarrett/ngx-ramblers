import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  CommitteeFile,
  CommitteeMember,
  CommitteeRolesChangeEvent,
  GroupEvent,
  Notification
} from "../../../models/committee.model";
import { DateValue } from "../../../models/date.model";
import { Member, MemberFilterSelection, SORT_BY_NAME } from "../../../models/member.model";
import { SystemConfig } from "../../../models/system.model";
import { ConfirmType } from "../../../models/ui-actions";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { CommitteeDisplayService } from "../committee-display.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailLinkService } from "../../../services/mail/mail-link.service";
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
import { MailService } from "../../../services/mail/mail.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import { MemberLoginService } from "../../../services/member/member-login.service";

@Component({
  selector: "app-committee-send-notification",
  styles: [`
    .scrollable
      max-height: 500px
      overflow: scroll

    .group-events-ul
      @extend .scrollable
      list-style: none
  `],
  template: `
    <app-page autoTitle>
      <div class="row">
        <div class="col-sm-12">
          <tabset class="custom-tabset" *ngIf="notification">
            <tab heading="List, Addressing, Email Type, Banner, Template and Intro Message">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-notification-config-selector (emailConfigChanged)="emailConfigChanged($event)"
                                                  [notificationConfig]="notification?.content?.notificationConfig"
                                                  [notificationConfigListing]="notificationConfigListing"/>
                <ng-container>
                  <div class="row">
                    <div class="col-sm-7"><label>Send to:</label>
                      <div class="form-group">
                        <form>
                          <ng-container *ngFor="let list of mailMessagingConfig?.brevo?.lists?.lists">
                            <div class="custom-control custom-radio">
                              <input class="custom-control-input"
                                     id="send-list-{{list.id}}"
                                     name="send-to"
                                     type="radio"
                                     [checked]="notification.content.listId===list.id"
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
                        </form>
                        <div *ngIf="false" class="custom-control custom-radio">
                          <input id="custom"
                                 type="radio"
                                 class="custom-control-input"
                                 name="send-to"
                                 [disabled]="true"
                                 [(ngModel)]="notification.content.listId"
                                 value="custom"/>
                          <label class="custom-control-label" for="custom">
                            <div *ngIf="notification.content.selectedMemberIds.length===0">Choose individual
                              recipients
                            </div>
                            <div
                              *ngIf="notification.content.selectedMemberIds.length>0">
                              {{ this.stringUtils.pluraliseWithCount(this.notification.content.selectedMemberIds.length, "recipient") }}
                              chosen from {{ this.selectedList()?.name }} list
                            </div>
                          </label>
                          <a class="ml-1" (click)="clearRecipients(this.selectedList())"> (clear)</a>
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
                                 [(ngModel)]="notification.content.addresseeType"
                                 [value]="addresseeFirstName"/>
                          <label class="custom-control-label" for="addressee-first-name">Hi <i>first name</i> </label>
                        </div>
                        <div class="custom-control custom-radio">
                          <input id="addressee-all"
                                 type="radio"
                                 class="custom-control-input"
                                 name="address-as"
                                 [(ngModel)]="notification.content.addresseeType"
                                 value="Hi all,"/>
                          <label class="custom-control-label" for="addressee-all">Hi all,</label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="row" *ngIf="false">
                    <div class="col-sm-12">
                      <div class="form-group" triggers="" placement="bottom"
                           [tooltip]="helpMembers()">
                        <ng-select #select [items]="selectableRecipients"
                                   bindLabel="memberInformation"
                                   name="member-selector"
                                   bindValue="id"
                                   placeholder="Select one or more members"
                                   [disabled]="notifyTarget.busy"
                                   [dropdownPosition]="'bottom'"
                                   [groupBy]="groupBy"
                                   [groupValue]="groupValue"
                                   [multiple]="true"
                                   [closeOnSelect]="true"
                                   (change)="onChange()"
                                   [(ngModel)]="notification.content.selectedMemberIds">
                          <ng-template ng-optgroup-tmp let-item="item">
                            <span class="group-header">{{ item.name }} members</span>
                            <span class="ml-1 badge badge-secondary badge-group"> {{ item.total }} </span>
                          </ng-template>
                        </ng-select>
                      </div>
                    </div>
                  </div>
                </ng-container>
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-group">
                      <label for="notification-title">Email title:</label>
                      <input [(ngModel)]="notification.content.title.value" type="text" class="form-control input-sm"
                             id="notification-title"
                             placeholder="This will appear as the email title to the recipient">
                    </div>
                  </div>
                </div>
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-group">
                      <label for="content-text">Intro Message: <small>(no need to prefix 'Hi ...' as it's done
                        automatically by Address as: above)</small>
                      </label>
                      <textarea markdown [(ngModel)]="notification.content.text.value"
                                class="form-control input-sm" rows="5"
                                id="content-text"
                                placeholder="Enter free text to be included of the notification here"></textarea>
                    </div>
                  </div>
                </div>
                <div class="row" *ngIf="committeeFile">
                  <div class="col col-sm-12"><label>Include download information for:</label>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="notification.content.includeDownloadInformation"
                             type="checkbox" class="custom-control-input" id="include-download-information">
                      <label
                        class="custom-control-label"
                        for="include-download-information">{{ committeeFile.fileType }} -
                        {{ display.fileTitle(committeeFile) }}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab heading="Auto-Include Events">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="row">
                  <div class="col-sm-4">
                    <div class="form-group">
                      <label for="from-date">Include Events From:</label>
                      <app-date-picker startOfDay id="from-date"
                                       [size]="'md round'"
                                       (dateChange)="onFromDateChange($event)"
                                       [value]="this.notification.groupEventsFilter.fromDate">
                      </app-date-picker>
                    </div>
                    <div class="form-group">
                      <label for="to-date">Include Events To:</label>
                      <app-date-picker startOfDay id="to-date"
                                       [size]="'md round'"
                                       (dateChange)="onToDateChange($event)"
                                       [value]="this.notification.groupEventsFilter.toDate">
                      </app-date-picker>
                    </div>
                  </div>
                  <div class="col-sm-4">
                    <label>Include Information:</label>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="notification.groupEventsFilter.includeDescription"
                             (ngModelChange)="populateGroupEvents()"
                             type="checkbox" class="custom-control-input" id="user-events-show-description">
                      <label class="custom-control-label"
                             for="user-events-show-description">Description
                      </label>
                    </div>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="notification.groupEventsFilter.includeLocation"
                             (ngModelChange)="populateGroupEvents()"
                             type="checkbox" class="custom-control-input" id="user-events-show-location">
                      <label class="custom-control-label"
                             for="user-events-show-location">Location
                      </label>
                    </div>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="notification.groupEventsFilter.includeContact"
                             (ngModelChange)="populateGroupEvents()"
                             type="checkbox" class="custom-control-input" id="user-events-show-contact">
                      <label class="custom-control-label"
                             for="user-events-show-contact">Contact
                      </label>
                    </div>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="notification.groupEventsFilter.includeImage"
                             (ngModelChange)="populateGroupEvents()"
                             type="checkbox" class="custom-control-input" id="user-events-show-image">
                      <label class="custom-control-label"
                             for="user-events-show-image">Image
                      </label>
                    </div>
                  </div>
                  <div class="col-sm-4">
                    <label>Include Event Types:</label>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="notification.groupEventsFilter.includeWalks"
                             (ngModelChange)="populateGroupEvents()"
                             type="checkbox" class="custom-control-input" id="user-events-include-walks">
                      <label class="custom-control-label"
                             for="user-events-include-walks">Walks:
                      </label>
                    </div>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="notification.groupEventsFilter.includeSocialEvents"
                             (ngModelChange)="populateGroupEvents()"
                             type="checkbox" class="custom-control-input" id="user-events-include-social-events">
                      <label class="custom-control-label"
                             for="user-events-include-social-events">Social Events:
                      </label>
                    </div>
                    <div class="custom-control custom-checkbox">
                      <input [(ngModel)]="notification.groupEventsFilter.includeCommitteeEvents"
                             (ngModelChange)="populateGroupEvents()"
                             type="checkbox" class="custom-control-input" id="user-events-include-committee-events"/>
                      <label class="custom-control-label"
                             for="user-events-include-committee-events">Committee Events:
                      </label>
                    </div>
                  </div>
                </div>
                <div class="row">
                  <div class="col col-sm-12">
                    <ul class="group-events-ul">
                      <li class="mb-2" *ngIf="notification.groupEvents.length>0">
                        <div class="custom-control custom-checkbox">
                          <input [(ngModel)]="notification.groupEventsFilter.selectAll"
                                 (click)="selectAllGroupEvents()"
                                 id="select-all"
                                 type="checkbox" class="custom-control-input">
                          <label class="custom-control-label"
                                 for="select-all"><strong>Select/Deselect All</strong> - {{ selectedCount() }} out
                            of {{ stringUtils.pluraliseWithCount(notification.groupEvents.length, "event") }}
                          </label>
                        </div>
                      </li>
                      <li *ngFor="let groupEvent of notification.groupEvents; let index = index;"
                          (click)="changeGroupEventSelection(groupEvent)">
                        <div class="custom-control custom-checkbox">
                          <input [(ngModel)]="groupEvent.selected"
                                 (change)="toggleEvent(groupEvent)"
                                 [id]="idForIndex(index)"
                                 type="checkbox" class="custom-control-input">
                          <label class="custom-control-label"
                                 [for]="idForIndex(index)">
                        <span style="font-size: 14px;font-weight: bold">
                          <span [textContent]="groupEvent.eventDate | displayDate"></span>
                          <span *ngIf="groupEvent.eventTime"> •
                              <span>{{ groupEvent.eventTime }}</span>
                            </span>
                          •
                          <span>{{ groupEvent?.eventType?.description }}</span>
                          •
                          <app-link [area]="groupEvent?.eventType.area"
                                    [id]="groupEvent?.id"
                                    [text]="groupEvent?.title"></app-link>
                          <span *ngIf="groupEvent.distance"> •
                              <span>{{ groupEvent.distance }}</span>
                            </span>
                        </span>
                            <span style="font-size: 14px;font-weight: bold">
                            <span *ngIf="notification.groupEventsFilter.includeContact && groupEvent.contactName"> • Contact:
                              <a
                                [href]="'mailto:' + groupEvent.contactEmail">{{ groupEvent.contactName || groupEvent.contactEmail }}</a>
                              <span *ngIf="groupEvent.contactPhone"> ({{ groupEvent.contactPhone }})</span></span>
                          <span *ngIf="notification.groupEventsFilter.includeLocation && groupEvent.postcode"> • Location: <a
                            [href]="googleMapsService.urlForPostcode(groupEvent.postcode)"
                            target="_blank">
                              <span [textContent]="groupEvent.postcode"></span>
                            </a></span>
                        </span>
                            <span markdown [data]="groupEvent.description" style="padding: 8px 0px 0px 0px"
                                  *ngIf="notification.groupEventsFilter.includeDescription">
                        </span>
                          </label>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </tab>
            <tab heading="Sender, Reply To, CCs & Sign Off">
              <div class="img-thumbnail thumbnail-admin-edit">
                <app-sender-replies-and-sign-off omitSignOff omitCC [mailMessagingConfig]="mailMessagingConfig"
                                                 (senderExists)="senderExists=$event"
                                                 [notificationConfig]="notification?.content?.notificationConfig"/>
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-group">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="notification.content.signoffText.include" type="checkbox"
                               class="custom-control-input"
                               id="include-signoff-text">
                        <label for="include-signoff-text"
                               class="custom-control-label">
                          Include Signoff text:
                        </label>
                      </div>
                      <textarea [disabled]="!notification.content.signoffText.include"
                                [(ngModel)]="notification.content.signoffText.value" type="text"
                                class="form-control input-sm" rows="3"
                                id="signoff-text"
                                placeholder="Enter any signoff text to be included of the notification here"></textarea>
                    </div>
                  </div>
                </div>
                <div class="row">
                  <div class="col col-sm-12">
                    <div class="form-group">
                      <div class="custom-control custom-checkbox">
                        <input [(ngModel)]="notification.content.signoffAs.include"
                               type="checkbox" class="custom-control-input"
                               id="include-signoff-as">
                        <label class="custom-control-label"
                               for="include-signoff-as">Signoff as:
                        </label>
                      </div>
                      <app-committee-role-multi-select [roles]="notification.content.signoffAs.value"
                                                       (rolesChange)="setSignOffValue($event)"/>
                    </div>
                  </div>
                </div>
              </div>
            </tab>
            <tab heading="Preview">
              <div class="img-thumbnail thumbnail-admin-edit">
                <div class="print-preview">
                  <div *ngIf="notification?.content?.notificationConfig?.bannerId" class="mb-2">
                    <img class="card-img"
                         [src]="mailMessagingService.bannerImageSource(notification?.content?.notificationConfig, false)">
                  </div>
                  <div #notificationContent>
                    <app-committee-notification-details [committeeFile]="committeeFile" [members]="members"
                                                        [notification]="notification">
                    </app-committee-notification-details>
                  </div>
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
          <app-brevo-button button [disabled]="notReady()" (click)="runCampaignCreationAndSendWorkflow()"
                            title="Send Now via {{systemConfig?.mailDefaults?.mailProvider| titlecase}}"></app-brevo-button>
          <app-brevo-button class="ml-2" button [disabled]="notReady()" (click)="completeInMailSystem()"
                            title="Complete in {{systemConfig?.mailDefaults?.mailProvider| titlecase}}"></app-brevo-button>
          <input type="submit" value="Back" (click)="backToCommittee()"
                 class="ml-2 btn btn-primary px-2 py-2">
        </div>
      </div>
      <div class="d-none">
        <ng-template app-notification-directive/>
      </div>
    </app-page>`
})
export class CommitteeSendNotificationComponent implements OnInit, OnDestroy {

  constructor(
    private route: ActivatedRoute,
    private pageService: PageService,
    private memberLoginService: MemberLoginService,
    private committeeQueryService: CommitteeQueryService,
    private mailService: MailService,
    protected mailMessagingService: MailMessagingService,
    private notifierService: NotifierService,
    public display: CommitteeDisplayService,
    public stringUtils: StringUtilsService,
    public googleMapsService: GoogleMapsService,
    private memberService: MemberService,
    private fullNameWithAlias: FullNameWithAliasPipe,
    public mailLinkService: MailLinkService,
    private mailListUpdaterService: MailListUpdaterService,
    private systemConfigService: SystemConfigService,
    private urlService: UrlService,
    protected dateUtils: DateUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CommitteeSendNotificationComponent", NgxLoggerLevel.OFF);
  }

  @ViewChild("notificationContent") notificationContent: ElementRef;
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  public segmentEditingSupported = false;
  public committeeFile: CommitteeFile;
  public members: Member[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  public roles: { replyTo: any[]; signoff: CommitteeMember[] };
  public selectableRecipients: MemberFilterSelection[];
  public mailMessagingConfig: MailMessagingConfig;
  public committeeEventId: string;
  public systemConfig: SystemConfig;
  public pageTitle: string;
  public notificationConfigListing: NotificationConfigListing;
  public senderExists: boolean;
  public notificationConfigs: NotificationConfig[] = [];
  protected readonly addresseeFirstName = ADDRESSEE_CONTACT_FIRST_NAME;

  async ngOnInit() {
    this.logger.info("ngOnInit with", this.members.length, "members");
    this.display.confirm.as(ConfirmType.SEND_NOTIFICATION);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.notificationConfigListing = {mailMessagingConfig, includeMemberSelections: [MemberSelection.MAILING_LIST]};
      this.notificationConfigs = this.mailMessagingService.notificationConfigs(this.notificationConfigListing);
      if (this.notificationConfigs.length === 0) {
        this.notify.error({
          title: "Failed to initialise message sending",
          message: `No notification configurations have been created for ${this.stringUtils.asTitle(MemberSelection.MAILING_LIST)} members. Create one in Mail Settings and try this again.`,
        });
      } else {
        this.generateNotificationDefaults("mailMessagingService");
      }
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => this.systemConfig = systemConfig));
    this.subscriptions.push(this.display.configEvents().subscribe(() => {
      this.roles = {signoff: this.display.committeeReferenceData.committeeMembers(), replyTo: []};
      this.generateNotificationDefaults("committeeReferenceData");
      this.logger.info("initialised on open: committeeFile", this.committeeFile, ", roles", this.roles);
      this.logger.info("initialised on open: notification ->", this.notification);
      this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
        this.committeeEventId = paramMap.get("committee-event-id");
        this.logger.info("initialised with committee-event-id:", this.committeeEventId);
        if (this.committeeEventId) {
          this.committeeQueryService.queryFiles(this.committeeEventId)
            .then(() => {
              this.logger.info("this.committeeQueryService.committeeFiles:", this.committeeQueryService.committeeFiles);
              if (this.committeeQueryService.committeeFiles?.length > 0) {
                const committeeFile = this.committeeQueryService.committeeFiles[0];
                this.committeeFile = committeeFile;
                this.logger.info("committeeFile:", committeeFile);
                this.pageService.setTitle(committeeFile.fileType);
                this.pageTitle = committeeFile.fileType;
                this.generateNotificationDefaults("committeeQueryService.queryFiles");
              }
            });
        }
      }));
    }));
  }

  selectedList(): ListInfo {
    return this.mailMessagingConfig?.brevo?.lists?.lists?.find(item => item.id === this?.notification?.content?.listId);
  }

  private initialiseMembersAndGroupEvents() {

    return Promise.all([
      this.memberService.publicFields(this.memberService.filterFor.GROUP_MEMBERS).then(members => {
        this.members = members;
        this.logger.info("refreshMembers -> populated ->", this.members.length, "members");
        this.selectableRecipients = members
          .map(member => this.toMemberFilterSelection(member, this.selectedList()))
          .sort(SORT_BY_NAME);
        this.logger.info("refreshMembers -> populated ->", this.selectableRecipients.length, "selectableRecipients:", this.selectableRecipients);
      }),
      this.committeeFile ? Promise.resolve() : this.populateGroupEvents()
    ]).then((tasksCompleted) => {
      this.logger.info("performed total of", tasksCompleted.length, "preparatory steps");
      this.notify.clearBusy();
    }).catch(error => {
      this.logger.error("Error caught:", error);
      this.notify.error({title: "Failed to initialise message sending", message: error});
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private generateNotificationDefaults(reason: string) {
    const ready = !!(this.mailMessagingConfig && this.display.committeeReferenceData && this.notificationConfigs?.length > 0);
    this.logger.info("generateNotificationDefaults due to:", reason, "ready:", ready);
    if (ready) {
      const notificationConfig = this.notificationConfigs?.[0];
      this.notification = {
        cancelled: false,
        content: {
          notificationConfig,
          text: {value: "", include: true},
          signoffText: {
            value: "If you have any questions about the above, please don't hesitate to contact me.\n\nBest regards,",
            include: true
          },
          includeDownloadInformation: !!this.committeeFile,
          listId: this.mailMessagingConfig?.brevo?.lists?.lists?.[0]?.id,
          addresseeType: ADDRESSEE_CONTACT_FIRST_NAME,
          selectedMemberIds: [],
          signoffAs: {
            include: true,
            value: this.display.committeeReferenceData.loggedOnRole()?.type || "secretary"
          },
          title: {value: notificationConfig?.subject?.text, include: true}
        },
        groupEvents: [],
        groupEventsFilter: {
          search: null,
          selectAll: true,
          fromDate: this.dateUtils.asDateValue(this.dateUtils.momentNowNoTime().valueOf()),
          toDate: this.dateUtils.asDateValue(this.dateUtils.momentNowNoTime().add(2, "weeks").valueOf()),
          includeImage: true,
          includeContact: true,
          includeDescription: true,
          includeLocation: true,
          includeWalks: true,
          includeSocialEvents: true,
          includeCommitteeEvents: true
        },
      };
      this.logger.info("generateNotificationDefaults:notification:", this.notification);
      this.emailConfigChanged(notificationConfig);
      if (this.committeeFile) {
        this.notification.content.title.value = this.committeeFile.fileType;
        this.notification.content.text.value = `This is just a quick note to let you know in case you are interested, that I've uploaded a new file to the ${this?.systemConfig?.group?.shortName} website. The file information is as follows:`;
      }
      this.initialiseMembersAndGroupEvents().then(() => this.clearRecipients(this.selectedList()));
    }
  }

  populateGroupEvents(): Promise<GroupEvent[]> {
    return this.committeeQueryService.groupEvents(this.notification?.groupEventsFilter)
      .then(events => {
        this.notification.groupEvents = events;
        this.logger.info("groupEvents", events);
        return events;
      });
  }

  changeGroupEventSelection(groupEvent: GroupEvent) {
    groupEvent.selected = !groupEvent.selected;
  }

  subscribedToEmailsForList(list: ListInfo): MemberFilterSelection[] {
    return this.members
      .filter(this.memberService.filterFor.GROUP_MEMBERS)
      .filter(member => this.mailListUpdaterService.memberSubscribed(member, list.id))
      .map(member => this.toMemberFilterSelection(member, list))
      .sort(SORT_BY_NAME);
  }

  notReady() {
    return !this.senderExists || this.stringUtils.arrayFromDelimitedData(this.notification?.content?.signoffAs?.value)?.length === 0 || this.members.length === 0 || this.notifyTarget.busy || (this.notification.content.selectedMemberIds.length === 0 && !this.notification.content.listId);
  }

  toMemberFilterSelection(member: Member, list: ListInfo): MemberFilterSelection {
    return {
      id: member.id,
      order: 0,
      memberGrouping: `Subscribed to ${list.name} emails`,
      member,
      memberInformation: this.fullNameWithAlias.transform(member)
    };
  }

  private showSelectedMemberIds() {
    this.onChange();
    this.logger.info("notification.content.destinationType", this.notification.content.listId, "notification.content.addresseeType", this.notification.content.addresseeType);
  }

  editRecipientsFromList(list: ListInfo) {
    if (this.segmentEditingSupported) {
      this.notification.content.listId = list.id;
      this.notification.content.selectedMemberIds = this.subscribedToEmailsForList(list).map(item => item.id);
      this.showSelectedMemberIds();
    }
  }

  clearRecipients(list: ListInfo) {
    if (this.segmentEditingSupported) {
      this.logger.info("clearRecipientsFor:", list);
      this.notification.content.customCampaignType = null;
      this.notification.content.listId = list.id;
      this.notification.content.selectedMemberIds = [];
      this.showSelectedMemberIds();
    }
  }

  selectList(list: ListInfo) {
    this.logger.info("selectList:", list);
    this.notification.content.listId = list.id;
  }

  handleNotificationError(errorResponse) {
    this.notify.clearBusy();
    this.notify.error({
      title: "Your notification could not be sent",
      message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + JSON.stringify(errorResponse.error)) : "")
    });
  }

  async createThenEditOrSendEmailCampaign(bodyContent: string, campaignName: string, createAsDraft: boolean) {
    this.notify.progress(createAsDraft ? (`Preparing to complete ${campaignName} in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`) : ("Sending " + campaignName));
    const signoffRoles: string[] =  this.stringUtils.arrayFromDelimitedData(this.notification.content.signoffAs.value)
    this.logger.info("roles", signoffRoles);
    const member: Member = await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    const createCampaignRequest: CreateCampaignRequest = {
      createAsDraft,
      templateId: this.notification.content.notificationConfig.templateId,
      htmlContent: bodyContent,
      inlineImageActivation: false,
      mirrorActive: false,
      name: campaignName,
      params: this.mailMessagingService.createSendSmtpEmailParams(signoffRoles, this.notificationDirective, member, this.notification.content.notificationConfig, bodyContent, this.notification?.content.signoffAs.include, this.notification.content.title.value, this.notification.content.addresseeType),
      recipients: {listIds: [this.notification.content.listId]},
      replyTo: this.display.committeeReferenceData.contactUsField(this.notification.content.notificationConfig.replyToRole, "email"),
      sender: {
        email: this.display.committeeReferenceData.contactUsField(this.notification.content.notificationConfig.senderRole, "email"),
        name: this.display.committeeReferenceData.contactUsField(this.notification.content.notificationConfig.senderRole, "fullName")
      },
      subject: campaignName
    };
    this.logger.info("sendEmailCampaign:notification:", this.notification);
    this.logger.info("sendEmailCampaign:createCampaignRequest:", createCampaignRequest);
    if (this.notification.content?.listId > 0) {
      this.logger.info("about to send email campaign to list:", this.selectedList(), "with campaignName:", campaignName, "createAsDraft:", createAsDraft);
      const createCampaignResponse: StatusMappedResponseSingleInput = await this.mailService.createCampaign(createCampaignRequest);
      const campaignId: number = createCampaignResponse?.responseBody?.id;
      this.logger.info("sendEmailCampaign:createCampaignResponse:", createCampaignResponse, "createAsDraft:", createAsDraft, "campaignId:", campaignId);
      if (createAsDraft) {
        window.open(`${this.mailLinkService.campaignEditRichText(campaignId)}`, "_blank");
      } else {
        const sendCampaignResponse: StatusMappedResponseSingleInput = await this.mailService.sendCampaign({campaignId});
        this.logger.info("sendCampaignResponse:", sendCampaignResponse);
      }
      this.notifyEmailSendComplete(campaignName, createAsDraft);
    } else {
      this.notify.error({
        title: "Send Committee notification",
        message: `${this.creationOrSending(createAsDraft)} of ${campaignName} was not successful as no lists were found to send to`
      });
    }
  }

  notifyEmailSendComplete(campaignName: string, dontSend: boolean) {
    this.notify.clearBusy();
    if (!this.notification.cancelled) {
      this.notify.success({
        title: "Send Committee notification",
        message: `${this.creationOrSending(dontSend)} of ${campaignName} was successful`
      });
      this.display.confirm.clear();
    }
  }

  creationOrSending(dontSend: boolean): string {
    return dontSend ? "Creation" : "Sending";
  }

  runCampaignCreationAndSendWorkflow(createAsDraft?: boolean) {
    const campaignName = this.notification.content.title.value;
    this.logger.info("campaignName", campaignName);
    this.notify.setBusy();
    return Promise.resolve(this.generateNotificationHTML())
      .then(bodyContent => this.createThenEditOrSendEmailCampaign(bodyContent, campaignName, createAsDraft))
      .catch((error) => this.handleNotificationError(error));
  }

  generateNotificationHTML(): string {
    const bodyContent = this.notificationContent?.nativeElement?.innerHTML;
    this.logger.info("this.generateNotificationHTML bodyContent ->", bodyContent);
    return bodyContent;
  }

  completeInMailSystem() {
    this.notify.warning({
      title: `Complete in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`,
      message: `You can close this dialog now as the message was presumably completed and sent in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`
    });
    this.runCampaignCreationAndSendWorkflow(true);
  }

  backToCommittee() {
    if (this.notifyTarget.busy) {
      this.notification.cancelled = true;
      this.notify.error({
        title: "Cancelling during send",
        message: `Because notification sending was already in progress when you cancelled, campaign may have already been sent - check in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)} if in doubt.`
      });
    } else {
      this.logger.info("calling cancelSendNotification");
      this.display.confirm.clear();
      this.urlService.navigateTo(["committee"]);
    }
  }

  onFromDateChange(dateValue: DateValue) {
    this.notification.groupEventsFilter.fromDate = dateValue;
    this.populateGroupEvents();
  }

  onToDateChange(dateValue: DateValue) {
    this.notification.groupEventsFilter.toDate = dateValue;
    this.populateGroupEvents();
  }

  helpMembers() {
    return `Click below and select`;
  }

  onChange() {
    if (this.notification.content.selectedMemberIds.length > 0) {
      this.notify.warning({
        title: "Member selection",
        message: `${this.notification.content.selectedMemberIds.length} members manually selected`
      });
    } else {
      this.notify.hide();
    }
  }

  groupBy(member: MemberFilterSelection) {
    return member.memberGrouping;
  }

  groupValue(_: string, children: any[]) {
    return ({name: children[0].memberGrouping, total: children.length});
  }

  selectAllGroupEvents() {
    this.notification.groupEventsFilter.selectAll = !this.notification.groupEventsFilter.selectAll;
    this.logger.info("select all=", this.notification.groupEventsFilter.selectAll);
    this.notification.groupEvents.forEach(event => event.selected = this.notification.groupEventsFilter.selectAll);
  }

  idForIndex(index) {
    const id = "select-" + index;
    this.logger.off("id:", id);
    return id;
  }

  toggleEvent(groupEvent: GroupEvent) {
    this.logger.info("toggleEvent:", groupEvent);
    groupEvent.selected = !groupEvent.selected;
  }

  selectedCount() {
    return this.notification.groupEvents.filter(item => item.selected).length;
  }

  setSignOffValue(rolesChangeEvent: CommitteeRolesChangeEvent) {
    this.notification.content.signoffAs.value = rolesChangeEvent.roles.join(",");
    this.logger.info("rolesChangeEvent:", rolesChangeEvent, "this.notification.content.signoffAs.value:", this.notification.content.signoffAs.value);
  }

  emailConfigChanged(notificationConfig: NotificationConfig) {
    if (notificationConfig) {
      this.notification.content.notificationConfig = notificationConfig;
      this.notification.content.title.value = notificationConfig.subject.text;
    }
  }

  selectionDisabled(list: ListInfo): boolean {
    const disabled = this.subscribedToEmailsForList(list).length === 0;
    this.logger.debug("list selection disabled for", list.name, disabled);
    return disabled;
  }

  listNameAndMemberCount(list: ListInfo) {
    return `${list.name} (${this.stringUtils.pluraliseWithCount(this.subscribedToEmailsForList(list)?.length || 0, "member")})`;
  }
}
