import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { faCalendar, faCopy, faMagnifyingGlass, faPencil } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import isEmpty from "lodash-es/isEmpty";
import pick from "lodash-es/pick";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { ConfigKey } from "../../../models/config.model";
import { DateValue } from "../../../models/date.model";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { MeetupConfig } from "../../../models/meetup-config.model";
import { Member } from "../../../models/member.model";
import { ConfirmType } from "../../../models/ui-actions";
import { DisplayedEvent } from "../../../models/walk-displayed-event.model";
import { WalkEventType } from "../../../models/walk-event-type.model";
import { WalkEvent } from "../../../models/walk-event.model";
import { WalkNotification } from "../../../models/walk-notification.model";
import { DisplayedWalk, EventType, Walk, WalkExport, WalkViewMode } from "../../../models/walk.model";
import { MeetupDescriptionComponent } from "../../../notifications/walks/templates/meetup/meetup-description.component";
import { WalkNotificationDirective } from "../../../notifications/walks/walk-notification.directive";
import { ChangedItemsPipe } from "../../../pipes/changed-items.pipe";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { EventNotePipe } from "../../../pipes/event-note.pipe";
import { FullNameWithAliasOrMePipe } from "../../../pipes/full-name-with-alias-or-me.pipe";
import { FullNamePipe } from "../../../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../../../pipes/member-id-to-full-name.pipe";
import { sortBy } from "../../../services/arrays";
import { BroadcastService } from "../../../services/broadcast-service";
import { CommitteeConfigService } from "../../../services/committee/commitee-config.service";
import { CommitteeReferenceData } from "../../../services/committee/committee-reference-data";
import { ConfigService } from "../../../services/config.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MeetupService } from "../../../services/meetup.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { RamblersWalksAndEventsService } from "../../../services/walks/ramblers-walks-and-events.service";
import { WalkEventService } from "../../../services/walks/walk-event.service";
import { WalkNotificationService } from "../../../services/walks/walk-notification.service";
import { WalksQueryService } from "../../../services/walks/walks-query.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalksService } from "../../../services/walks/walks.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { WalkDisplayService } from "../walk-display.service";

interface DisplayMember {
  memberId: string;
  name: string;
  displayName: string;
  contactId: string;
  firstName: string;
  lastName: string;
  membershipNumber: string;
}

@Component({
  selector: "app-walk-edit",
  templateUrl: "./walk-edit.component.html",
  styleUrls: ["./walk-edit.component.sass"],
  changeDetection: ChangeDetectionStrategy.Default
})
export class WalkEditComponent implements OnInit, OnDestroy {
  @Input("displayedWalk")
  set initialiseWalk(displayedWalk: DisplayedWalk) {
    this.logger.debug("cloning walk for edit");
    this.displayedWalk = cloneDeep(displayedWalk);
  }

  @ViewChild(WalkNotificationDirective) notificationDirective: WalkNotificationDirective;
  private mailchimpConfig: MailchimpConfig;
  public displayedWalk: DisplayedWalk;
  public confirmAction: ConfirmType = ConfirmType.NONE;
  public googleMapsUrl: SafeResourceUrl;
  public walkDate: Date;
  private priorStatus: EventType;
  protected logger: Logger;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance;
  public saveInProgress = false;
  public sendNotifications = false;
  public longerDescriptionPreview: boolean;
  public meetupConfig: MeetupConfig;
  private committeeReferenceData: CommitteeReferenceData;
  faPencil = faPencil;
  faMagnifyingGlass = faMagnifyingGlass;
  private subscriptions: Subscription[] = [];

  constructor(
    private mailchimpConfigService: MailchimpConfigService,
    public googleMapsService: GoogleMapsService,
    private walksService: WalksService,
    private addressQueryService: AddressQueryService,
    public ramblersWalksAndEventsService: RamblersWalksAndEventsService,
    private memberLoginService: MemberLoginService,
    public route: ActivatedRoute,
    private walksQueryService: WalksQueryService,
    private meetupService: MeetupService,
    private walkNotificationService: WalkNotificationService,
    private walkEventService: WalkEventService,
    private walksReferenceService: WalksReferenceService,
    private memberIdToFullNamePipe: MemberIdToFullNamePipe,
    private displayDateAndTime: DisplayDateAndTimePipe,
    private fullNamePipe: FullNamePipe,
    private fullNameWithAliasOrMePipe: FullNameWithAliasOrMePipe,
    private eventNotePipe: EventNotePipe,
    private changedItemsPipe: ChangedItemsPipe,
    protected dateUtils: DateUtilsService,
    public display: WalkDisplayService,
    private displayDate: DisplayDatePipe,
    protected notifierService: NotifierService,
    private configService: ConfigService,
    private broadcastService: BroadcastService<Walk>,
    private siteEditService: SiteEditService,
    private changeDetectorRef: ChangeDetectorRef,
    private committeeConfig: CommitteeConfigService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkEditComponent, NgxLoggerLevel.OFF);
  }

  copySource = "copy-selected-walk-leader";
  copySourceFromWalkLeaderMemberId: string;
  public copyFrom: any = {};

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.committeeConfig.events().subscribe(committeeReferenceData => this.committeeReferenceData = committeeReferenceData));
    this.mailchimpConfigService.getConfig().then(response => {
      this.mailchimpConfig = response;
      this.logger.info("mailchimpConfig:", this.mailchimpConfig);
      if (this.mailchimpConfig?.allowSendCampaign) {
        this.sendNotifications = true;
      } else if (this.memberLoginService.memberLoggedIn()) {
        this.notify.warning({
          title: "Mailchimp notifications",
          message: "Mailchimp notifications have been temporarily disabled, so any changes to this walk will not be sent."
        });

      }
    });
    this.copyFrom = {walkTemplate: {}, walkTemplates: [] as Walk[]};
    this.configService.queryConfig<MeetupConfig>(ConfigKey.MEETUP).then(meetupConfig => this.meetupConfig = meetupConfig);
    this.showWalk(this.displayedWalk);
    this.logger.debug("displayedWalk:", this.displayedWalk);
    this.logDetectChanges();
    this.subscriptions.push(this.siteEditService.events.subscribe(item => this.logDetectChanges()));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  notificationRequired() {
    const walkDataAudit = this.walkEventService.walkDataAuditFor(this.displayedWalk.walk, this.status(), true);
    const notificationRequired = walkDataAudit.notificationRequired;
    this.logger.debug("dataHasChanged:", notificationRequired, "walkDataAudit:", walkDataAudit);
    return notificationRequired;
  }

  allowEdits() {
    return this.confirmAction === ConfirmType.NONE && !this.saveInProgress && (this.allowAdminEdits() ||
      this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk));
  }

  allowSave() {
    return this.allowEdits() && this.notificationRequired();
  }

  allowClose() {
    return !this.saveInProgress && this.confirmAction === ConfirmType.NONE && !this.allowSave();
  }

  allowCancel() {
    return !this.saveInProgress && this.allowEdits() && this.notificationRequired();
  }

  status(): EventType {
    return this.displayedWalk.status;
  }

  allowDelete() {
    return !this.saveInProgress && this.confirmAction === ConfirmType.NONE && this.memberLoginService.allowWalkAdminEdits()
      && this.displayedWalk.walkAccessMode && this.displayedWalk?.walkAccessMode?.walkWritable;
  }

  allowNotifyConfirmation() {
    return this.mailchimpConfig?.mailchimpEnabled && (this.allowSave() || this.confirmAction === ConfirmType.DELETE) && this.displayedWalk.walk.walkLeaderMemberId;
  }

  allowHistoryView() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) || this.allowAdminEdits();
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

  allowAdminEdits() {
    return this.memberLoginService.allowWalkAdminEdits();
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

  pendingConfirmation() {
    return this.confirmAction !== ConfirmType.NONE;
  }

  ownedAndAwaitingWalkDetails() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) && this.status() === EventType.AWAITING_WALK_DETAILS;
  }

  setWalkLeaderToMe() {
    this.displayedWalk.walk.walkLeaderMemberId = this.memberLoginService.loggedInMember().memberId;
    this.walkLeaderMemberIdChanged();
  }

  walkLeaderMemberIdChanged() {
    this.notify.hide();
    this.populateCopySourceFromWalkLeaderMemberId();
    const memberId = this.displayedWalk.walk.walkLeaderMemberId;
    if (!memberId) {
      this.setStatus(EventType.AWAITING_LEADER);
      this.displayedWalk.walk.walkLeaderMemberId = "";
      this.displayedWalk.walk.contactId = "";
      this.displayedWalk.walk.displayName = "";
      this.displayedWalk.walk.contactPhone = "";
      this.displayedWalk.walk.contactEmail = "";
    } else {
      const selectedMember: Member = this.display.members.find((member: Member) => {
        return member.id === memberId;
      });
      if (selectedMember) {
        this.setStatus(EventType.AWAITING_WALK_DETAILS);
        this.displayedWalk.walk.contactId = selectedMember.contactId;
        this.displayedWalk.walk.displayName = selectedMember.displayName;
        this.displayedWalk.walk.contactPhone = selectedMember.mobileNumber;
        this.displayedWalk.walk.contactEmail = selectedMember.email;
        this.populateWalkTemplates(memberId);
      }
    }
  }

  showWalk(displayedWalk: DisplayedWalk) {
    if (displayedWalk) {
      this.logger.info("showWalk", displayedWalk.walk, "mailchimpConfig:", this.mailchimpConfig);
      if (!displayedWalk.walk.venue) {
        this.logger.debug("initialising walk venue");
        displayedWalk.walk.venue = {type: this.walksReferenceService.venueTypes()[0].type, postcode: displayedWalk.walk.postcode};
      }
      this.confirmAction = ConfirmType.NONE;
      this.updateGoogleMapsUrl();
      if (this.displayedWalk.walkAccessMode.initialiseWalkLeader) {
        this.setStatus(EventType.AWAITING_WALK_DETAILS);
        this.displayedWalk.walk.walkLeaderMemberId = this.memberLoginService.loggedInMember().memberId;
        this.walkLeaderMemberIdChanged();
        this.notify.success({
          title: "Thanks for offering to lead this walk " + this.memberLoginService.loggedInMember().firstName + "!",
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
      }
    } else {
      this.displayedWalk = {
        walkAccessMode: WalksReferenceService.walkAccessModes.add,
        latestEventType: null,
        walk: {
          walkType: this.display.walkTypes[0],
          walkDate: this.dateUtils.momentNowNoTime().valueOf(),
          events: []
        },
        status: EventType.AWAITING_LEADER,
        showEndpoint: false
      };
    }
    this.populateCopySourceFromWalkLeaderMemberId();
    this.populateWalkTemplates();
  }

  private updateGoogleMapsUrl() {
    this.googleMapsUrl = this.display.googleMapsUrl(this.displayedWalk.walk, false, this.displayedWalk.walk.postcode);
  }

  populateCopySourceFromWalkLeaderMemberId() {
    this.copySourceFromWalkLeaderMemberId = this.displayedWalk.walk.walkLeaderMemberId
      || this.memberLoginService.loggedInMember().memberId;
  }

  walkEvents(walk: Walk): DisplayedEvent[] {
    return walk.events
      .sort((event: WalkEvent) => event.date)
      .map((event: WalkEvent) => ({
        member: this.memberIdToFullNamePipe.transform(event.memberId, this.display.members),
        date: this.displayDateAndTime.transform(event.date),
        eventType: this.walksReferenceService.toWalkEventType(event.eventType).description,
        notes: this.eventNotePipe.transform(event),
        changedItems: this.changedItemsPipe.transform(event, this.display.members)
      }))
      .reverse();
  }

  membersWithAliasOrMe(): DisplayMember[] {
    return this.display.members.sort(sortBy("firstName", "lastName")).map(member => {
      return {
        memberId: member.id,
        name: this.fullNameWithAliasOrMePipe.transform(member),
        contactId: member.contactId,
        displayName: member.displayName,
        firstName: member.firstName,
        lastName: member.lastName,
        membershipNumber: member.membershipNumber
      };
    });
  }

  previousWalkLeadersWithAliasOrMe(): DisplayMember[] {
    const displayMembers = this.membersWithAliasOrMe()
      .filter(member => this.display.previousWalkLeaderIds?.includes(member.memberId));
    this.logger.debug("this.membersWithAliasOrMe:", "\n" + displayMembers.map(item => item.membershipNumber + "," + item.contactId + "," + item.displayName).join("\n"));
    return displayMembers;
  }

  populateCurrentWalkFromTemplate() {
    const walkTemplate = cloneDeep(this.copyFrom.walkTemplate) as Walk;
    if (walkTemplate) {
      const templateDate = this.displayDate.transform(walkTemplate.walkDate);
      delete walkTemplate.id;
      delete walkTemplate.events;
      delete walkTemplate.walkLeaderMemberId;
      delete walkTemplate.ramblersWalkId;
      delete walkTemplate.walkDate;
      delete walkTemplate.displayName;
      delete walkTemplate.contactPhone;
      delete walkTemplate.contactEmail;
      delete walkTemplate.meetupEventDescription;
      delete walkTemplate.meetupEventUrl;
      delete walkTemplate.meetupPublish;
      delete walkTemplate.meetupEventTitle;
      walkTemplate.riskAssessment = [];
      Object.assign(this.displayedWalk.walk, walkTemplate);
      const event = this.walkEventService.createEventIfRequired(this.displayedWalk.walk,
        EventType.WALK_DETAILS_COPIED, "Copied from previous walk on " + templateDate);
      this.setStatus(EventType.AWAITING_WALK_DETAILS);
      this.walkEventService.writeEventIfRequired(this.displayedWalk.walk, event);
      this.notify.success({
        title: "Walk details were copied from " + templateDate,
        message: "Make any further changes here and save when you are done."
      });
    }
  }

  revertToPriorStatus() {
    this.logger.debug("revertToPriorWalkStatus:", this.status(), "->", this.priorStatus);
    if (this.priorStatus) {
      this.setStatus(this.priorStatus);
      this.logDetectChanges();
    }
  }

  unlinkRamblersDataFromCurrentWalk() {
    this.displayedWalk.walk.ramblersWalkId = "";
    this.notify.progress({title: "Unlink walk", message: "Previous Ramblers walk has now been unlinked."});
  }

  unlinkOSMapsFromCurrentWalk() {
    this.displayedWalk.walk.osMapsRoute = "";
    this.displayedWalk.walk.osMapsTitle = "";
    this.notify.progress({title: "Unlink walk", message: "Previous OS Maps route has now been unlinked."});
  }

  canUnlinkRamblers() {
    return this.memberLoginService.allowWalkAdminEdits() && this.ramblersWalkExists();
  }

  canUnlinkOSMaps() {
    return this.displayedWalk.walk.osMapsRoute || this.displayedWalk.walk.osMapsTitle;
  }

  notUploadedToRamblersYet() {
    return !this.ramblersWalkExists();
  }

  insufficientDataToUploadToRamblers() {
    return this.memberLoginService.allowWalkAdminEdits() && this.displayedWalk.walk
      && !(this.displayedWalk.walk.gridReference || this.displayedWalk.walk.postcode);
  }

  validateWalk(): WalkExport {
    return this.ramblersWalksAndEventsService.validateWalk(this.displayedWalk.walk);
  }

  walkValidations() {
    const walkValidations = this.validateWalk().validationMessages;
    return "This walk cannot be included in the Ramblers Walks and Events Manager export due to the following "
      + walkValidations.length + " reasons(s): " + walkValidations.join(", ") + ".";
  }

  ramblersWalkExists() {
    return this.validateWalk().publishedOnRamblers;
  }

  loggedIn() {
    return this.memberLoginService.memberLoggedIn();
  }

  deleteWalkDetails() {
    this.confirmAction = ConfirmType.DELETE;
    this.notify.warning({
      title: "Confirm delete of walk details",
      message: "If you confirm this, the slot for " +
        this.displayDate.transform(this.displayedWalk.walk.walkDate) + " will be deleted from the site."
    });
  }

  cancelWalkDetails() {
    this.confirmAction = ConfirmType.CANCEL;
    this.notify.warning({
      title: "Cancel changes",
      message: "Click Confirm to lose any changes you've just made for " +
        this.displayDate.transform(this.displayedWalk.walk.walkDate) + ", or Cancel to carry on editing."
    });
  }

  confirmCancelWalkDetails() {
    this.closeEditView();
  }

  isWalkReadyForStatusChangeTo(eventType: WalkEventType): boolean {
    this.notify.hide();
    this.logger.info("isWalkReadyForStatusChangeTo ->", eventType);
    const walkValidations = this.validateWalk().validationMessages;
    if (eventType.mustHaveLeader && !this.displayedWalk.walk.walkLeaderMemberId) {
      this.notify.warning(
        {
          title: "Walk leader needed",
          message: "This walk cannot be changed to " + eventType.description + " yet."
        });
      this.logger.info("isWalkReadyForStatusChangeTo:false - this.displayedWalk.status ->", this.displayedWalk.status);
      return false;
    } else if (eventType.mustPassValidation && walkValidations.length > 0) {
      this.notify.warning(
        {
          title: "This walk is not ready to be " + eventType.readyToBe + " yet due to the following "
            + walkValidations.length + " reasons(s)",
          message: walkValidations.join(", ") +
            ". You can still save this walk, then come back later on to complete the rest of the details."
        });
      return false;
    } else {
      return true;
    }
  }

  createEventAndSendNotifications(): Promise<boolean> {
    this.saveInProgress = true;
    const sendNotificationsGivenWalkLeader: boolean = this.sendNotifications && !!this.displayedWalk.walk.walkLeaderMemberId;
    return this.walkNotificationService.createEventAndSendNotifications(this.notify, this.display.members, this.notificationDirective, this.displayedWalk, sendNotificationsGivenWalkLeader);
  }

  setStatus(status: EventType) {
    this.logger.info("setting status =>", status);
    this.displayedWalk.status = status;
    this.priorStatus = cloneDeep(this.displayedWalk.status);
    this.logger.info("setting status =>", status, "this.priorStatus", this.priorStatus);
  }

  async confirmDeleteWalkDetails() {
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
    const savedWalk: Walk = await this.walksService.createOrUpdate(this.displayedWalk.walk);
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
    if (!notificationSent) {
      this.closeEditView();
    }
    this.logDetectChanges();
  }

  private logDetectChanges() {
    this.logger.debug("detectChanges");
    // this.changeDetectorRef.detectChanges();
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
      await this.updateGridReferenceIfRequired();
      const walkNotification: WalkNotification = this.walkNotificationService.toWalkNotification(this.displayedWalk, this.display.members);
      return this.walkNotificationService.generateNotificationHTML(walkNotification, this.notificationDirective, MeetupDescriptionComponent);
    })
      // .then((meetupDescription: string) => this.meetupService.synchroniseWalkWithEvent(this.notify, this.displayedWalk, meetupDescription))
      .then(() => this.sendNotificationsSaveAndCloseIfNotSent())
      .catch(error => this.notifyError(error));
  }

  private updateGridReferenceIfRequired() {
    this.logger.info("walk:", this.displayedWalk.walk);
    if (this.displayedWalk.walk.postcode && (!this.displayedWalk.walk.gridReference || this.displayedWalk.walk.gridReference.length < 8)) {
      return this.postcodeChange();
    } else {
      return Promise.resolve();
    }
  }

  private notifyError(message: any) {
    this.saveInProgress = false;
    this.confirmAction = ConfirmType.NONE;
    const title = "Save of walk failed";
    this.logger.error(title, message);
    this.notify.error({continue: true, title, message});
    this.logDetectChanges();
  }

  confirmContactOther() {
  }

  requestApproval() {
    this.logger.debug("requestApproval called with current status:", this.status());
    if (this.isWalkReadyForStatusChangeTo(this.walksReferenceService.toWalkEventType(EventType.AWAITING_APPROVAL))) {
      this.confirmAction = ConfirmType.REQUEST_APPROVAL;
      this.notify.warning({
        title: "Confirm walk details complete",
        message: "If you confirm this, your walk details will be emailed to " + this.walksCoordinatorName() +
          " and they will publish these to the site."
      });
    }
  }

  contactOther() {
    this.notify.warning({
      title: "Confirm walk details complete",
      message: "If you confirm this, your walk details will be emailed to " + this.walksCoordinatorName() +
        " and they will publish these to the site."
    });
  }

  walkStatusChange() {
    this.notify.hide();
    this.logger.info("walkStatusChange - previous status:", this.displayedWalk.status);
    const eventType = this.walksReferenceService.toWalkEventType(this.displayedWalk.status);
    if (this.isWalkReadyForStatusChangeTo(eventType)) {
      this.setStatus(eventType.eventType);
      switch (eventType.eventType) {
        case EventType.AWAITING_LEADER: {
          const walkDate = this.displayedWalk.walk.walkDate;
          this.displayedWalk.walk = pick(this.displayedWalk.walk, ["id", "events", "walkDate"]);
          return this.notify.success({
            title: "Walk details reset for " + this.displayDate.transform(walkDate),
            message: "Status is now " + this.walksReferenceService.toWalkEventType(EventType.AWAITING_LEADER).description
          });
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

  walkStatuses(): WalkEventType[] {
    return this.walksReferenceService.walkStatuses();
  }

  approveWalkDetails() {
    const validationMessages = this.validateWalk().validationMessages;
    if (validationMessages.length > 0) {
      this.notify.warning({
        title: "This walk still has the following " + validationMessages.length + " field(s) that need attention",
        message: validationMessages.join(", ") +
          ". You'll have to get the rest of these details completed before you mark the walk as approved."
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

  editLongerDescription() {
    this.logger.debug("editLongerDescription");
    this.longerDescriptionPreview = false;
  }

  previewLongerDescription() {
    this.logger.debug("previewLongerDescription");
    this.longerDescriptionPreview = true;
  }

  selectCopySelectedLeader() {
    this.copySource = "copy-selected-walk-leader";
    this.populateWalkTemplates();
  }

  myOrWalkLeader() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) ? "my" :
      this.displayedWalk.walk && this.displayedWalk.walk.displayName + "'s";
  }

  meOrWalkLeader() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) ? "me" :
      this.displayedWalk.walk && this.displayedWalk.walk.displayName;
  }

  personToNotify() {
    return this.display.loggedInMemberIsLeadingWalk(this.displayedWalk.walk) ?
      this.walksCoordinatorName() :
      this.displayedWalk.walk && this.displayedWalk.walk.displayName;
  }

  walksCoordinatorName() {
    return this.committeeReferenceData.contactUsField("walks", "fullName");
  }

  populateWalkTemplates(injectedMemberId?: string) {
    const memberId = this.displayedWalk.walk.walkLeaderMemberId || injectedMemberId;
    let criteria;
    switch (this.copySource) {
      case "copy-selected-walk-leader": {
        criteria = {
          walkLeaderMemberId: this.copySourceFromWalkLeaderMemberId,
          briefDescriptionAndStartPoint: {$exists: true}
        };
        break;
      }
      case "copy-with-os-maps-route-selected": {
        criteria = {osMapsRoute: {$exists: true}};
        break;
      }
      default: {
        criteria = {walkLeaderMemberId: memberId};
      }
    }
    this.logger.debug("selecting walks", this.copySource, criteria);
    this.walksService.all({criteria, sort: {walkDate: -1}})
      .then(walks => this.walksQueryService.activeWalks(walks))
      .then(walks => {
        this.copyFrom.walkTemplates = walks;
        this.logDetectChanges();
      });
  }

  onDateChange(date: DateValue) {
    if (date) {
      this.logger.info("onDateChange:date", date);
      this.displayedWalk.walk.walkDate = date.value;
    }
  }

  isExpandable(): boolean {
    return this.display.walkMode(this.displayedWalk.walk) === WalkViewMode.EDIT;
  }

  private async lookupGridReferenceBasedOn(postcode: string): Promise<string> {
    this.notify.hide();
    this.logger.debug("postcodeChange:", postcode);
    if (isEmpty(postcode)) {
      return Promise.resolve(null);
    } else {
      const gridReferenceLookupResponse: GridReferenceLookupResponse = await this.addressQueryService.gridReferenceLookup(postcode);
      if (gridReferenceLookupResponse.error) {
        this.notify.error({
          continue: true,
          title: "Postcode error",
          message: `Lookup of postcode ${gridReferenceLookupResponse.postcode} failed due to '${gridReferenceLookupResponse.error}' error`
        });
      } else {
        return gridReferenceLookupResponse.gridReference;
      }
    }
  }

  async postcodeChange() {
    if (this.displayedWalk.walk.postcode.length > 3) {
      const postcode = this.displayedWalk.walk.postcode;
      this.displayedWalk.walk.postcode = postcode?.toUpperCase()?.trim();
      this.displayedWalk.walk.gridReference = await this.lookupGridReferenceBasedOn(postcode);
      return this.updateGoogleMapsUrl();
    } else {
      return Promise.resolve();
    }
  }

  async postcodeFinishChange() {
    const postcode = this.displayedWalk.walk.postcodeFinish;
    this.displayedWalk.walk.postcodeFinish = postcode.toUpperCase().trim();
    this.displayedWalk.walk.gridReferenceFinish = await this.lookupGridReferenceBasedOn(postcode);
  }

  viewGridReference(gridReference: string) {
    return window.open(this.display.gridReferenceLink(gridReference));
  }
}
