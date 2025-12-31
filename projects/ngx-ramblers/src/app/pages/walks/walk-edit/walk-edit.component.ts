import { Component, inject, Input, OnDestroy, OnInit, Type, ViewChild } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { faCopy, faPencil } from "@fortawesome/free-solid-svg-icons";
import { cloneDeep } from "es-toolkit/compat";
import { isEmpty } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { ConfigKey } from "../../../models/config.model";
import { MEETUP_API_AVAILABLE, MeetupConfig } from "../../../models/meetup-config.model";
import { Member } from "../../../models/member.model";
import { ConfirmType, StoredValue, WalkEditTab } from "../../../models/ui-actions";
import { WalkEventType } from "../../../models/walk-event-type.model";
import { DisplayedWalk, EventType, INITIALISED_LOCATION, WalkExportData, WalkViewMode } from "../../../models/walk.model";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { BroadcastService } from "../../../services/broadcast-service";
import { ConfigService } from "../../../services/config.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { enumValueForKey } from "../../../functions/enums";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { GroupEventService } from "../../../services/walks-and-events/group-event.service";
import { WalkNotificationService } from "../../../services/walks/walk-notification.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { WalkDisplayService } from "../walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailMessagingConfig } from "../../../models/mail.model";
import { MeetupService } from "../../../services/meetup.service";
import { WalkNotification, WalksConfig } from "../../../models/walk-notification.model";
import { MeetupDescriptionComponent } from "../../../notifications/walks/templates/meetup/meetup-description.component";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { RootFolder, SystemConfig } from "../../../models/system.model";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { JsonPipe } from "@angular/common";
import { ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { EventDefaultsService } from "../../../services/event-defaults.service";
import { NotificationComponent } from "../../../notifications/common/notification.component";
import { WalkDataAudit } from "../../../models/walk-data-audit.model";
import { isEqual } from "es-toolkit/compat";
import { WalkEditMainDetailsComponent } from "./walk-edit-main-details";
import { WalkEditDetailsComponent } from "./walk-edit-details";
import { WalkRiskAssessmentComponent } from "../walk-risk-assessment/walk-risk-assessment.component";
import { WalkEditRelatedLinksComponent } from "./walk-edit-links";
import { WalkEditLeaderComponent } from "./walk-edit-leader";
import { WalkEditFeaturesComponent } from "./walk-edit-features";
import { EditGroupEventImagesComponent } from "../../../common/walks-and-events/edit-group-event-images";
import { WalkEditHistoryComponent } from "./walk-edit-walk-history";
import { WalkEditCopyFromComponent } from "./walk-edit-copy-from";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";

@Component({
  selector: "app-walk-edit",
  template: `
    <div class="d-none">
      <ng-template app-notification-directive/>
    </div>
    <div class="tabset-container">
      <app-walk-panel-expander [walk]="displayedWalk?.walk" collapsable [collapseAction]="'exit edit'"
                               [expandAction]="'edit walk full-screen'" [expandable]="isExpandable()"/>
      <tabset class="custom-tabset">
        <tab heading="{{WalkEditTab.MAIN_DETAILS}}"
             [active]="tabActive(WalkEditTab.MAIN_DETAILS)"
             (selectTab)="onTabSelect(WalkEditTab.MAIN_DETAILS)">
          <app-walk-edit-main-details [displayedWalk]="displayedWalk"
                                      [inputDisabled]="inputDisabled()"/>
        </tab>
        <tab heading="{{WalkEditTab.WALK_DETAILS}}"
             [active]="tabActive(WalkEditTab.WALK_DETAILS)"
             (selectTab)="onTabSelect(WalkEditTab.WALK_DETAILS)">
          <app-walk-edit-details
            [displayedWalk]="displayedWalk"
            [inputDisabled]="inputDisabled()"
            [renderMapEdit]="renderMapEdit"
            [allowDetailView]="allowDetailView()"
            [notify]="notify"/>
        </tab>
        @if (display.allowEdits(displayedWalk?.walk)) {
          <tab heading="{{WalkEditTab.RISK_ASSESSMENT}}"
               [active]="tabActive(WalkEditTab.RISK_ASSESSMENT)"
               (selectTab)="onTabSelect(WalkEditTab.RISK_ASSESSMENT)">
            <app-walk-risk-assessment [displayedWalk]="displayedWalk"/>
          </tab>
        }
        <tab heading="{{WalkEditTab.RELATED_LINKS}}"
             [active]="tabActive(WalkEditTab.RELATED_LINKS)"
             (selectTab)="onTabSelect(WalkEditTab.RELATED_LINKS)">
          <app-walk-edit-related-links
            [notify]="notify"
            [displayedWalk]="displayedWalk"
            [inputDisabled]="inputDisabled()"
            [saveInProgress]="saveInProgress"/>
        </tab>
        <tab heading="{{WalkEditTab.LEADER}}"
             [active]="tabActive(WalkEditTab.LEADER)"
             (selectTab)="onTabSelect(WalkEditTab.LEADER)">
          <app-walk-edit-leader
            [notify]="notify"
            [displayedWalk]="displayedWalk"
            [inputDisabled]="inputDisabled()"
            [saveInProgress]="saveInProgress"
            (walkLeaderChange)="walkLeaderMemberIdChanged()"
            (clearWalkLeaderRequest)="requestClearWalkLeader()"
            (statusChange)="onWalkStatusChange($event)"/>
        </tab>
        <tab app-walk-edit-features heading="{{WalkEditTab.FEATURES}}"
             [active]="tabActive(WalkEditTab.FEATURES)"
             (selectTab)="onTabSelect(WalkEditTab.FEATURES)"
             [displayedWalk]="displayedWalk"
             [config]="config"/>
        <tab app-edit-group-event-images heading="{{WalkEditTab.IMAGES}}"
             [active]="tabActive(WalkEditTab.IMAGES)"
             (selectTab)="onTabSelect(WalkEditTab.IMAGES)"
             [rootFolder]="RootFolder.walkImages"
             [notify]="notify"
             [extendedGroupEvent]="displayedWalk?.walk"
             [config]="config"/>
        @if (display.walkLeaderOrAdmin(displayedWalk?.walk)) {
          <tab heading="{{WalkEditTab.HISTORY}}"
               [active]="tabActive(WalkEditTab.HISTORY)"
               (selectTab)="onTabSelect(WalkEditTab.HISTORY)">
            <app-walk-edit-history [displayedWalk]="displayedWalk"/>
          </tab>
        }
        @if (displayedWalk?.walk?.fields?.contactDetails?.memberId) {
          <tab heading="{{WalkEditTab.COPY}}"
               [active]="tabActive(WalkEditTab.COPY)"
               (selectTab)="onTabSelect(WalkEditTab.COPY)">
            <app-walk-edit-copy-from
              [notify]="notify"
              [displayedWalk]="displayedWalk"
              [inputDisabled]="inputDisabled()"
              (statusChange)="setStatus($event)"/>
          </tab>
        }
      </tabset>
    </div>
    <div class="form-group">
      @if (notifyTarget.showAlert) {
        <div class="alert {{notifyTarget.alertClass}}">
          <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
          <strong> {{ notifyTarget.alertTitle }}: </strong>
          {{ notifyTarget.alertMessage }}
        </div>
      }
    </div>
    @if (displayedWalk?.walk) {
      @if (showChangedItems) {
        <pre>
          changedItems: {{ walkEventService.walkDataAuditFor(this.displayedWalk?.walk, status(), true)?.changedItems | json }}
        </pre>
      }
      @if (display.walkLink(displayedWalk.walk)) {
        <div class="mb-2">
          <app-copy-icon [icon]="faCopy" title [value]="display.walkLink(displayedWalk.walk)"
                         [elementName]="'event link'">copy link to this
          </app-copy-icon>
          <a class="rams-text-decoration-pink" [href]="display.walkLink(displayedWalk.walk)"
             target="_blank">{{ stringUtils.asTitle(displayedWalk.walk?.groupEvent?.item_type) }}</a>
        </div>
      }
      <div class="d-inline-flex align-items-center flex-wrap mb-4 align-middle">
        @if (allowClose()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Close"
                 (click)="closeEditView()" title="Close and go back to walks list"
                 class="btn btn-primary me-2">
        }
        @if (allowSave()) {
          <input [disabled]="saveInProgress" type="submit" value="Save"
                 (click)="saveWalkDetails()" title="Save these walk details"
                 class="btn btn-primary me-2">
        }
        @if (allowCancel()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Cancel"
                 (click)="cancelWalkDetails()" title="Cancel and don't save"
                 class="btn btn-primary me-2">
        }
        @if (pendingCancel()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Confirm" (click)="confirmCancelWalkDetails()"
                 title="Confirm losing my changes and closing this form"
                 class="btn btn-primary me-2">
        }
        @if (allowDelete()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Delete"
                 (click)="deleteWalkDetails()" title="Delete these walk details"
                 class="btn btn-primary me-2">
        }
        @if (pendingDelete()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Confirm Deletion" (click)="confirmDeleteWalkDetails()"
                 title="Confirm Delete of these walk details"
                 class="btn btn-primary me-2">
        }
        @if (allowRequestApproval()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Request Approval" (click)="requestApproval()"
                 title="Mark walk details complete and request approval"
                 class="btn btn-primary me-2">
        }
        @if (allowApprove()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Approve" (click)="approveWalkDetails()"
                 title="Approve walk and publish"
                 class="btn btn-primary me-2">
        }
        @if (pendingRequestApproval()) {
          <input [disabled]="saveInProgress"
                 type="submit"
                 value="Confirm Request Approval" (click)="confirmRequestApproval()"
                 title="Confirm walk details complete and request approval"
                 class="btn btn-primary me-2">
        }
        @if (allowContactOther()) {
          <input [disabled]="saveInProgress" type="submit"
                 value=""
                 (click)="contactOther()" title="Contact {{personToNotify()}}"
                 class="btn btn-primary me-2">
        }
        @if (pendingContactOther()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Contact {{personToNotify()}}" (click)="confirmContactOther()"
                 title="Contact {{personToNotify()}} via email"
                 class="btn btn-primary me-2">
        }
        @if (pendingClearWalkLeader()) {
          <input [disabled]="saveInProgress" type="submit"
                 value="Keep Walk Details" (click)="confirmClearWalkLeaderKeepDetails()"
                 title="Clear walk leader but keep all walk details"
                 class="btn btn-primary me-2">
          <input [disabled]="saveInProgress" type="submit"
                 value="Free Slot" (click)="confirmClearWalkLeaderFreeSlot()"
                 title="Reset walk to empty slot and clear all details"
                 class="btn btn-primary me-2">
        }
        @if (pendingConfirmation()) {
          <input type="submit" value="Cancel" (click)="cancelConfirmableAction()"
                 title="Cancel this action"
                 class="btn btn-primary me-2">
        }
        @if (allowNotifyConfirmation() && !saveInProgress) {
          <div class="form-check">
            <input [disabled]="!display.allowAdminEdits() || saveInProgress"
                   [(ngModel)]="sendNotifications"
                   type="checkbox" class="form-check-input" id="send-notification">
            <label class="form-check-label ms-2"
                   for="send-notification">Notify {{ personToNotify() }} about this change
            </label>
          </div>
        }
      </div>
    }
  `,
  styleUrls: ["./walk-edit.component.sass"],
  imports: [NotificationDirective, WalkPanelExpanderComponent, TabsetComponent, FormsModule, FontAwesomeModule, JsonPipe, TabDirective, WalkEditMainDetailsComponent, WalkEditDetailsComponent, WalkRiskAssessmentComponent, WalkEditRelatedLinksComponent, WalkEditLeaderComponent, WalkEditFeaturesComponent, EditGroupEventImagesComponent, WalkEditHistoryComponent, WalkEditCopyFromComponent, CopyIconComponent]
})
export class WalkEditComponent implements OnInit, OnDestroy {

  @Input("displayedWalk")
  set initialiseWalk(displayedWalk: DisplayedWalk) {
    this.logger.info("initialiseWalk:displayedWalk displayedWalk input:", displayedWalk);
    if (displayedWalk && !displayedWalk?.walk?.groupEvent?.start_location) {
      this.logger.info("initialiseWalk:initialising walk start location with:", INITIALISED_LOCATION);
      displayedWalk.walk.groupEvent.start_location = cloneDeep(INITIALISED_LOCATION);
    }
    if (displayedWalk && !displayedWalk?.walk?.fields?.contactDetails) {
      const contactDetails = this.eventDefaultsService.defaultContactDetails();
      this.logger.info("initialiseWalk:initialising walk contactDetails with:", contactDetails);
      displayedWalk.walk.fields.contactDetails = contactDetails;
    }
    this.displayedWalk = cloneDeep(displayedWalk);
    this.initialiseMilesPerHour();
    this.logger.info("initialiseWalk:cloning groupEvent for edit:", this.displayedWalk?.walk?.groupEvent, "original:", displayedWalk?.walk?.groupEvent);
    this.mapEditComponentDisplayedWalk = this.displayedWalk;
    if (this.displayedWalk?.walk?.fields?.gpxFile?.awsFileName) {
      this.renderMapEdit = true;
    }
  }

  private logger: Logger = inject(LoggerFactory).createLogger("WalkEditComponent", NgxLoggerLevel.ERROR);
  public showChangedItems = false;
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private walksConfigService = inject(WalksConfigService);
  private mailMessagingService = inject(MailMessagingService);
  googleMapsService = inject(GoogleMapsService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private addressQueryService = inject(AddressQueryService);
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private memberLoginService = inject(MemberLoginService);
  route = inject(ActivatedRoute);
  private router = inject(Router);
  private walkNotificationService = inject(WalkNotificationService);
  protected walkEventService = inject(GroupEventService);
  protected currentTab: WalkEditTab = WalkEditTab.MAIN_DETAILS;
  private walksReferenceService = inject(WalksReferenceService);
  protected dateUtils = inject(DateUtilsService);
  display = inject(WalkDisplayService);
  stringUtils = inject(StringUtilsService);
  private displayDate = inject(DisplayDatePipe);
  protected notifierService = inject(NotifierService);
  private configService = inject(ConfigService);
  private eventDefaultsService = inject(EventDefaultsService);
  private broadcastService = inject<BroadcastService<ExtendedGroupEvent>>(BroadcastService);
  public config: SystemConfig;
  protected renderMapEdit: boolean;
  private mailMessagingConfig: MailMessagingConfig;
  public previousWalkLeaderIds: string[] = [];
  public displayedWalk: DisplayedWalk;
  public mapEditComponentDisplayedWalk: DisplayedWalk;
  public meetupService: MeetupService;
  public confirmAction: ConfirmType = ConfirmType.NONE;
  public googleMapsUrl: SafeResourceUrl;
  public walkDate: Date;
  private priorStatus: EventType;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  public saveInProgress = false;
  public sendNotifications = false;
  public meetupConfig: MeetupConfig;
  public faPencil = faPencil;
  private subscriptions: Subscription[] = [];
  private walksConfig: WalksConfig;
  public options: any;
  public showGoogleMapsView = false;
  public walkDataAudit: WalkDataAudit;
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  @ViewChild(WalkEditDetailsComponent) walkEditDetailsComponent: WalkEditDetailsComponent;
  protected readonly RootFolder = RootFolder;
  protected readonly faCopy = faCopy;
  protected readonly WalkEditTab = WalkEditTab;

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      const defaultValue = this.stringUtils.kebabCase(WalkEditTab.MAIN_DETAILS);
      const tabParameter = params[StoredValue.TAB];
      const tab = tabParameter || defaultValue;
      this.logger.info("received tab value of:", tabParameter, "defaultValue:", defaultValue, "selectTab:", tab);
      this.selectTab(tab);
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe((config: SystemConfig) => this.config = config));
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      if (this.mailMessagingConfig?.mailConfig.allowSendTransactional) {
        this.sendNotifications = true;
      } else if (this.memberLoginService.memberLoggedIn() && this.personToNotify()) {
        this.notify.warning({
          title: "Email notifications",
          message: this.notificationsDisabledWarning()
        });

      }
    }));
    this.previousWalkLeaderIds = await this.walksAndEventsService.queryWalkLeaders();
    this.subscriptions.push(this.walksConfigService.events().subscribe(walksConfig => {
      this.walksConfig = walksConfig;
      this.logger.info("walksConfigService:walksConfig:", walksConfig);
      this.initialiseMilesPerHour();

    }));
    this.logger.info("previousWalkLeaderIds:", this.previousWalkLeaderIds);
    this.configService.queryConfig<MeetupConfig>(ConfigKey.MEETUP).then(meetupConfig => this.meetupConfig = meetupConfig);
    this.showWalk(this.displayedWalk);
    this.logger.debug("displayedWalk:", this.displayedWalk);
  }

  private initialiseMilesPerHour() {
    if (this.displayedWalk?.walk?.fields.milesPerHour > 0) {
      this.logger.info("initialiseMilesPerHour:milesPerHour already set to:", this.displayedWalk?.walk?.fields.milesPerHour);
    } else if (this.walksConfig?.milesPerHour) {
      this.logger.info("initialiseMilesPerHour:setting milesPerHour from:", this.displayedWalk?.walk?.fields.milesPerHour, "to:", this.walksConfig.milesPerHour);
      this.displayedWalk.walk.fields.milesPerHour = this.walksConfig.milesPerHour;
    } else {
      this.logger.info("initialiseMilesPerHour:not setting as this.displayedWalk.walk:", this.displayedWalk.walk, "this.walksConfig.milesPerHour:", this.walksConfig?.milesPerHour);
    }
  }

  toggleMapView() {
    this.showGoogleMapsView = !this.showGoogleMapsView;
    setTimeout(() => {
      this.showGoogleMapsView = !this.showGoogleMapsView;
    }, 0);
  }

  private pushWalkToChild() {
    this.logger.info("displayedWalk changed:", this.displayedWalk);
    this.toggleMapView();
    this.mapEditComponentDisplayedWalk = cloneDeep(this.displayedWalk);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private notificationsDisabledWarning() {
    return `Email notifications are not enabled, so ${this.personToNotify()} won't be automatically notified of changes you make.`;
  }

  private confirmChangesMessage() {
    return {
      title: "Confirm walk details complete",
      message: this.mailMessagingConfig?.mailConfig.allowSendTransactional ? this.confirmAndChangesWillBePublished() : this.notificationsDisabledWarning()
    };
  }

  private confirmAndChangesWillBePublished() {
    return `If you confirm this, your walk details will be emailed to ${this.display.walksCoordinatorName()} and they will publish these to the site.`;
  }

  inputDisabled() {
    return !this.inputEnabled();
  }

  inputEnabled() {
    return this.confirmAction === ConfirmType.NONE && !this.saveInProgress && (this.display.allowAdminEdits() ||
      this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk));
  }

  allowSave() {
    return this.inputEnabled() && this.notificationRequired();
  }

  allowClose() {
    return !this.saveInProgress && this.confirmAction === ConfirmType.NONE && !this.allowSave();
  }

  allowCancel() {
    return !this.saveInProgress && this.inputEnabled() && this.notificationRequired();
  }

  status(): EventType {
    return this.displayedWalk.status;
  }

  allowDelete() {
    return !this.saveInProgress && this.confirmAction === ConfirmType.NONE && this.memberLoginService.allowWalkAdminEdits()
      && this.displayedWalk.walkAccessMode && this.displayedWalk?.walkAccessMode?.walkWritable;
  }

  allowNotifyConfirmation() {
    return this.mailMessagingConfig?.mailConfig.allowSendTransactional && (this.allowSave() || this.confirmAction === ConfirmType.DELETE) && this.displayedWalk.walk?.fields?.contactDetails?.memberId;
  }

  allowDetailView() {
    return this.memberLoginService.memberLoggedIn();
  }

  allowApprove() {
    return this.confirmAction === ConfirmType.NONE && this.memberLoginService.allowWalkAdminEdits() &&
      this.walkEventService.latestEventWithStatusChangeIs(this.displayedWalk.walk, EventType.AWAITING_APPROVAL)
      && this.status() !== EventType.APPROVED;
  }

  allowContactOther() {
    return false;
  }

  allowRequestApproval() {
    return this.confirmAction === ConfirmType.NONE && this.ownedAndAwaitingWalkDetails();
  }

  pendingCancel() {
    return this.confirmAction === ConfirmType.CANCEL;
  }

  pendingDelete() {
    return this.confirmAction === ConfirmType.DELETE;
  }

  pendingRequestApproval() {
    return this.confirmAction === ConfirmType.REQUEST_APPROVAL;
  }

  pendingContactOther() {
    return this.confirmAction === ConfirmType.CONTACT_OTHER;
  }

  pendingClearWalkLeader() {
    return this.confirmAction === ConfirmType.CLEAR_WALK_LEADER;
  }

  pendingConfirmation() {
    return this.confirmAction !== ConfirmType.NONE;
  }

  ownedAndAwaitingWalkDetails() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) && this.status() === EventType.AWAITING_WALK_DETAILS;
  }

  walkLeaderMemberIdChanged() {
    this.notify.hide();
    const memberId = this.displayedWalk.walk?.fields?.contactDetails?.memberId;
    if (!memberId) {
      this.setStatus(EventType.AWAITING_LEADER);
      this.displayedWalk.walk.fields.contactDetails.memberId = null;
      this.displayedWalk.walk.fields.contactDetails.contactId = null;
      this.displayedWalk.walk.fields.publishing.ramblers.contactName = null;
      this.displayedWalk.walk.fields.contactDetails.phone = null;
      this.displayedWalk.walk.fields.contactDetails.phone = null;
      this.displayedWalk.walk.fields.contactDetails.email = null;
    } else {
      const selectedMember: Member = this.display.members.find((member: Member) => {
        return member.id === memberId;
      });
      if (selectedMember) {
        this.logger.info("selectedMember", selectedMember);
        this.setStatus(EventType.AWAITING_WALK_DETAILS);
        this.displayedWalk.walk.fields.contactDetails.memberId = selectedMember.id;
        const selectedContactId = selectedMember.contactId ?? null;
        this.displayedWalk.walk.fields.contactDetails.contactId = selectedContactId;
        this.displayedWalk.walk.fields.publishing.ramblers.contactName = selectedContactId;
        this.displayedWalk.walk.fields.contactDetails.displayName = selectedMember.displayName;
        this.displayedWalk.walk.fields.contactDetails.phone = selectedMember.mobileNumber;
        this.displayedWalk.walk.fields.contactDetails.email = selectedMember.email;
      }
    }
  }

  showWalk(displayedWalk: DisplayedWalk) {
    if (displayedWalk) {
      this.logger.info("showWalk", displayedWalk.walk, "mailConfig:", this?.mailMessagingConfig?.mailConfig);
      if (!displayedWalk.walk.fields.venue) {
        this.logger.debug("initialising walk venue");
        displayedWalk.walk.fields.venue = {
          type: this.walksReferenceService.venueTypes()[0].type,
          postcode: displayedWalk.walk?.groupEvent?.start_location?.postcode
        };
      }
      this.confirmAction = ConfirmType.NONE;
      this.updateGoogleMapsUrl();
      if (this.displayedWalk.walkAccessMode.initialiseWalkLeader) {
        this.setStatus(EventType.AWAITING_WALK_DETAILS);
        this.displayedWalk.walk.fields.contactDetails.memberId = this.memberLoginService.loggedInMember().memberId;
        this.walkLeaderMemberIdChanged();
        this.notify.success({
          title: `Thanks for offering to lead this walk ${this.memberLoginService.loggedInMember().firstName}!`,
          message: "Please complete as many details you can, then click Save to allocate this slot on the walks programme. " +
            "It will be published to the public once it's approved. If you want to release this slot again, just click Cancel."
        });
      } else {
        const eventType: EventType = this.display.statusFor(this.displayedWalk.walk);
        this.logger.debug("eventType", eventType);
        if (!isEmpty(eventType)) {
          this.setStatus(eventType);
          this.priorStatus = eventType;
        }
        this.calculateAndSetFinishTimeIfNotPopulated();
      }
    } else {
      this.displayedWalk = {
        hasFeatures: false,
        showEndpoint: false,
        walkAccessMode: WalksReferenceService.walkAccessModes.add,
        walk: this.eventDefaultsService.createDefault(),
        status: EventType.AWAITING_LEADER
      };
      this.displayedWalk.latestEventType = this.display.latestEventTypeFor(this.displayedWalk.walk);
    }
  }

  private updateGoogleMapsUrl() {
    this.googleMapsUrl = this.display.googleMapsUrl(false, this.displayedWalk?.walk?.groupEvent?.start_location?.postcode, this.displayedWalk?.walk?.groupEvent?.start_location?.postcode);
  }

  validateWalk(): WalkExportData {
    return this.ramblersWalksAndEventsService.toWalkExport({localWalk: this.displayedWalk.walk, ramblersWalk: null});
  }


  loggedIn() {
    return this.memberLoginService.memberLoggedIn();
  }

  deleteWalkDetails() {
    this.confirmAction = ConfirmType.DELETE;
    this.notify.warning({
      title: "Confirm delete of walk details",
      message: `If you confirm this, the slot for ${this.displayDate.transform(this.displayedWalk.walk?.groupEvent?.start_date_time)} will be deleted from the site.`
    });
  }

  cancelWalkDetails() {
    this.confirmAction = ConfirmType.CANCEL;
    this.notify.warning({
      title: "Cancel changes",
      message: `Click Confirm to lose any changes you've just made for ${this.displayDate.transform(this.displayedWalk.walk?.groupEvent?.start_date_time)}, or Cancel to carry on editing.`
    });
  }

  confirmCancelWalkDetails() {
    this.closeEditView();
  }

  isWalkReadyForStatusChangeTo(eventType: WalkEventType): boolean {
    this.notify.hide();
    this.logger.info("isWalkReadyForStatusChangeTo ->", eventType);
    const walkValidations = this.validateWalk().validationMessages;
    if (eventType.mustHaveLeader && !this.displayedWalk.walk?.fields?.contactDetails?.memberId) {
      this.notify.warning(
        {
          title: "Walk leader needed",
          message: `This walk cannot be changed to ${eventType.description} yet`
        });
      this.logger.info("isWalkReadyForStatusChangeTo:false - this.displayedWalk.status ->", this.displayedWalk.status);
      return false;
    } else if (eventType.mustPassValidation && walkValidations.length > 0) {
      this.notify.warning(
        {
          title: `This walk is not ready to be ${eventType.readyToBe} yet due to the following ${walkValidations.length} reasons(s)`,
          message: `${walkValidations.join(", ")}. You can still save this walk, then come back later on to complete the rest of the details.`
        });
      return false;
    } else {
      return true;
    }
  }

  createEventAndSendNotifications(): Promise<boolean> {
    this.saveInProgress = true;
    const sendNotificationsGivenWalkLeader: boolean = this.sendNotifications && !!this.displayedWalk.walk?.fields?.contactDetails?.memberId;
    return this.walkNotificationService.createEventAndSendNotifications(this.notify, this.display.members, this.notificationDirective, this.displayedWalk, sendNotificationsGivenWalkLeader);
  }

  async confirmDeleteWalkDetails() {
    this.displayedWalk.walk.groupEvent.title = `Deleted walk ${this.displayedWalk.walk.id}`;
    this.setStatus(EventType.DELETED);
    try {
      return this.sendNotificationsSaveAndCloseIfNotSent();
    } catch (error) {
      return this.notifyError(error);
    }
  }

  private async sendNotificationsSaveAndCloseIfNotSent(): Promise<boolean> {
    const notificationSent: boolean = await this.createEventAndSendNotifications();
    return await this.saveAndCloseIfNotSent(notificationSent);
  }

  private async saveAndCloseIfNotSent(notificationSent: boolean): Promise<boolean> {
    this.logger.debug("saveAndCloseIfNotSent:saving walk:notificationSent", notificationSent);
    const savedWalk: ExtendedGroupEvent = await this.walksAndEventsService.createOrUpdate(this.displayedWalk.walk);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_SAVED, savedWalk));
    this.afterSaveWith(notificationSent);
    return notificationSent;
  }

  afterSaveWith(notificationSent: boolean): void {
    this.logger.debug("afterSaveWith:notificationSent", notificationSent);
    this.notify.clearBusy();
    this.saveInProgress = false;
    this.confirmAction = ConfirmType.NONE;
    this.display.refreshDisplayedWalk(this.displayedWalk);
    this.closeEditView();
  }


  closeEditView() {
    this.saveInProgress = false;
    this.confirmAction = ConfirmType.NONE;
    this.display.closeEditView(this.displayedWalk.walk);
  }

  public async saveWalkDetails(): Promise<void> {
    Promise.resolve().then(async () => {
      this.notify.setBusy();
      this.saveInProgress = true;
      return this.updateGridReferenceIfRequired();
    })
      .then(async () => {
        if (MEETUP_API_AVAILABLE) {
          const walkNotification: WalkNotification = this.walkNotificationService.toWalkNotification(this.displayedWalk, this.display.members);
          const meetupDescription: string = await this.generateMeetupDescriptionHTML(walkNotification);
          return this.meetupService.synchroniseWalkWithEvent(this.notify, this.displayedWalk, meetupDescription);
        } else {
          return true;
        }
      })
      .then(() => this.sendNotificationsSaveAndCloseIfNotSent())
      .catch(error => this.notifyError(error));
  }

  public generateMeetupDescriptionHTML(walkNotification: WalkNotification): Promise<string> {
    const component: Type<MeetupDescriptionComponent> = MeetupDescriptionComponent;
    const componentAndData = new NotificationComponent<MeetupDescriptionComponent>(component);
    const viewContainerRef = this.notificationDirective.viewContainerRef;
    viewContainerRef.clear();
    const componentRef = viewContainerRef.createComponent(componentAndData.component);
    componentRef.instance.data = walkNotification;
    componentRef.changeDetectorRef.detectChanges();
    const html = componentRef.location.nativeElement.innerHTML;
    this.logger.info("notification html ->", html);
    return Promise.resolve(html);
  }

  private updateGridReferenceIfRequired() {
    this.logger.info("walk:", this.displayedWalk.walk);
    if (this.displayedWalk.walk?.groupEvent?.start_location?.postcode && (!this.display.gridReferenceFrom(this.displayedWalk?.walk?.groupEvent?.start_location) || this.display.gridReferenceFrom(this.displayedWalk?.walk?.groupEvent?.start_location).length < 14)) {
      return this.postcodeChange();
    } else {
      return Promise.resolve();
    }
  }

  private notifyError(error: any) {
    this.saveInProgress = false;
    this.confirmAction = ConfirmType.NONE;
    const title = "Save of walk failed";
    this.logger.error(title, error);
    this.notify.error({continue: true, title, message: error});
  }

  confirmContactOther() {
  }

  requestApproval() {
    this.logger.debug("requestApproval called with current status:", this.status());
    if (this.isWalkReadyForStatusChangeTo(this.walksReferenceService.toWalkEventType(EventType.AWAITING_APPROVAL))) {
      this.confirmAction = ConfirmType.REQUEST_APPROVAL;
      this.notify.warning(this.confirmChangesMessage());
    }
  }

  contactOther() {
    this.notify.warning(this.confirmChangesMessage());
  }

  approveWalkDetails() {
    const validationMessages = this.validateWalk().validationMessages;
    if (validationMessages.length > 0) {
      this.notify.warning({
        title: `This walk still has the following ${this.stringUtils.pluraliseWithCount(validationMessages.length, "area")} that ${this.stringUtils.pluralise(validationMessages.length, "needs", "need")} attention`,
        message: `${validationMessages.join(", ")}. You'll have to get the rest of these details completed before you mark the walk as approved.`
      });
    } else {
      this.notify.success({
        title: "Ready to publish walk details",
        message: "All fields appear to be filled in okay, so next time you save this walk it will be published."
      });
      this.setStatus(EventType.APPROVED);
    }
  }

  confirmRequestApproval() {
    this.setStatus(EventType.AWAITING_APPROVAL);
    this.saveWalkDetails();
  }

  cancelConfirmableAction() {
    this.confirmAction = ConfirmType.NONE;
    this.notify.hide();
  }

  requestClearWalkLeader() {
    this.confirmAction = ConfirmType.CLEAR_WALK_LEADER;
    this.notify.warning({
      title: "Clear Walk Leader",
      message: "Choose 'Keep Walk Details' to clear the walk leader but keep all walk information, or 'Free Slot' to reset this to an empty walk slot."
    });
  }

  confirmClearWalkLeaderKeepDetails() {
    this.confirmAction = ConfirmType.NONE;
    this.notify.hide();
    this.displayedWalk.walk.fields.contactDetails.memberId = null;
    this.displayedWalk.walk.fields.contactDetails.contactId = null;
    this.displayedWalk.walk.fields.contactDetails.displayName = null;
    this.displayedWalk.walk.fields.contactDetails.phone = null;
    this.displayedWalk.walk.fields.contactDetails.email = null;
    this.displayedWalk.walk.fields.publishing.ramblers.contactName = null;
    this.setStatus(EventType.AWAITING_LEADER);
  }

  confirmClearWalkLeaderFreeSlot() {
    this.confirmAction = ConfirmType.NONE;
    this.notify.hide();
    const walkDate = this.displayedWalk.walk?.groupEvent?.start_date_time;
    const endDateTime = this.displayedWalk.walk?.groupEvent?.end_date_time;
    this.displayedWalk.walk = this.eventDefaultsService.createDefault({
      id: this.displayedWalk.walk.id,
      groupEvent: {
        id: this.displayedWalk.walk.groupEvent.id,
        item_type: this.displayedWalk.walk?.groupEvent?.item_type,
        start_date_time: walkDate,
        end_date_time: endDateTime
      },
      fields: {
        inputSource: InputSource.MANUALLY_CREATED
      },
      events: this.displayedWalk.walk.events
    });
    this.setStatus(EventType.AWAITING_LEADER);
    this.notify.success({
      title: `Walk details reset for ${this.displayDate.transform(walkDate)}`,
      message: `Status is now ${this.walksReferenceService.toWalkEventType(EventType.AWAITING_LEADER).description}`
    });
  }

  personToNotify() {
    const loggedInMemberIsLeadingWalk = this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk);
    this.logger.off("personToNotify:loggedInMemberIsLeadingWalk:", loggedInMemberIsLeadingWalk, "walkLeaderMemberId:", this.displayedWalk.walk?.fields?.contactDetails?.memberId, "walk?.fields?.contactDetails?.phone:", this.displayedWalk?.walk?.fields?.contactDetails?.displayName);
    return loggedInMemberIsLeadingWalk ?
      this.display.walksCoordinatorName() :
      this.displayedWalk?.walk?.fields?.contactDetails?.displayName;
  }

  isExpandable(): boolean {
    return this.display.walkMode(this.displayedWalk.walk) === WalkViewMode.EDIT;
  }

  async postcodeChange() {
    if (this.displayedWalk?.walk?.groupEvent?.start_location?.postcode?.length > 3) {
      const postcode = this.displayedWalk.walk?.groupEvent?.start_location?.postcode;
      this.displayedWalk.walk.groupEvent.start_location.postcode = postcode?.toUpperCase()?.trim();
      const gridReferenceLookupResponse: GridReferenceLookupResponse = await this.addressQueryService.gridReferenceLookup(postcode);
      this.displayedWalk.walk.groupEvent.start_location.grid_reference_6 = gridReferenceLookupResponse.gridReference6;
      this.displayedWalk.walk.groupEvent.start_location.grid_reference_8 = gridReferenceLookupResponse.gridReference8;
      this.displayedWalk.walk.groupEvent.start_location.grid_reference_10 = gridReferenceLookupResponse.gridReference10;
      this.pushWalkToChild();
      return this.updateGoogleMapsUrl();
    } else {
      return Promise.resolve();
    }
  }

  calculateAndSetFinishTimeIfNotPopulated() {
    if (this.displayedWalk.walk.fields.milesPerHour && !this.displayedWalk.walk.groupEvent?.end_date_time) {
      const endDateTime = this.ramblersWalksAndEventsService.walkFinishTime(this.displayedWalk.walk, this.displayedWalk.walk.fields.milesPerHour);
      this.logger.info("calculateAndSetFinishTimeIfNotPopulated:endDateTime", endDateTime, "from:", this.displayedWalk.walk?.groupEvent?.end_date_time);
      this.displayedWalk.walk.groupEvent.end_date_time = endDateTime;
    } else {
      this.logger.info("calculateAndSetFinishTimeIfNotPopulated:not calculating finish time as walk.fields.milesPerHour:", this.displayedWalk.walk.fields.milesPerHour, "walk.groupEvent.end_date_time:", this.displayedWalk.walk.groupEvent?.end_date_time);
    }
  }

  onTabSelect(tab: WalkEditTab): void {
    this.logger.info("onTabSelect:tab", tab);
    this.selectTab(tab);
    if (tab === WalkEditTab.WALK_DETAILS) {
      this.renderMapEdit = true;
      setTimeout(() => {
        this.walkEditDetailsComponent?.invalidateMaps();
      }, 100);
    }
  }

  public selectTab(tab: string | WalkEditTab) {
    let tabValue: WalkEditTab;

    if (enumValueForKey(WalkEditTab, tab)) {
      tabValue = tab as WalkEditTab;
    } else {
      tabValue = this.findTabByKebabCase(tab as string);
    }

    const newTabKebab = this.stringUtils.kebabCase(tabValue);
    const currentTabKebab = this.stringUtils.kebabCase(this.currentTab);

    this.logger.info("selectTab:", {tab, tabValue, newTabKebab, currentTabKebab, currentTab: this.currentTab});

    if (currentTabKebab === newTabKebab) {
      this.logger.info("Tab already selected, skipping navigation");
      return;
    }

    this.currentTab = tabValue;
    this.logger.info("Navigating to tab:", newTabKebab);

    this.router.navigate([], {
      queryParams: {[StoredValue.TAB]: newTabKebab},
      queryParamsHandling: "merge",
      fragment: this.route.snapshot.fragment
    });
  }

  tabActive(tab: WalkEditTab): boolean {
    return this.stringUtils.kebabCase(this.currentTab) === this.stringUtils.kebabCase(tab);
  }

  private findTabByKebabCase(kebabValue: string): WalkEditTab {
    const found = Object.values(WalkEditTab).find(
      tab => this.stringUtils.kebabCase(tab) === kebabValue
    );
    return found || WalkEditTab.MAIN_DETAILS;
  }

  setStatus(status: EventType) {
    if (this.displayedWalk.status === status) {
      this.logger.info("Status is already =>", status);
    } else {
      this.displayedWalk.status = status;
      this.priorStatus = cloneDeep(this.displayedWalk.status);
      this.logger.info("Setting status =>", status, "this.priorStatus", this.priorStatus);
    }
  }

  onWalkStatusChange(eventTypeChange: EventType) {
    this.notify.hide();
    this.logger.info("walkStatusChange - previous status:", this.displayedWalk.status, "eventTypeChange:", eventTypeChange);
    const eventType: WalkEventType = this.walksReferenceService.toWalkEventType(this.displayedWalk.status);
    if (this.isWalkReadyForStatusChangeTo(eventType)) {
      this.setStatus(eventType.eventType);
      switch (eventType.eventType) {
        case EventType.AWAITING_LEADER: {
          return this.requestClearWalkLeader();
        }
        case EventType.APPROVED: {
          return this.approveWalkDetails();
        }
      }
    } else {
      setTimeout(() => {
        this.revertToPriorStatus();
      });
    }
  }

  revertToPriorStatus() {
    this.logger.debug("revertToPriorWalkStatus:", this.status(), "->", this.priorStatus);
    if (this.priorStatus) {
      this.setStatus(this.priorStatus);
    }
  }

  notificationRequired() {
    const audit: WalkDataAudit = this.walkEventService.walkDataAuditFor(this.displayedWalk.walk, this.status(), true);
    if (!isEqual(this.walkDataAudit, audit)) {
      const notificationRequired = audit.notificationRequired;
      this.logger.info("dataHasChanged:", notificationRequired, "walkDataAudit:", audit);
      this.walkDataAudit = audit;
    }
    return audit.notificationRequired;
  }
}
