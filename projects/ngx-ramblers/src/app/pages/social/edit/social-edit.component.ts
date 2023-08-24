import { HttpErrorResponse } from "@angular/common/http";
import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { faCopy, faEye, faPencil } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import { FileUploader } from "ng2-file-upload";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { AwsFileData } from "../../../models/aws-object.model";
import { DateValue } from "../../../models/date.model";
import { MemberFilterSelection } from "../../../models/member.model";
import { SocialEvent } from "../../../models/social-events.model";
import { Actions, ConfirmType } from "../../../models/ui-actions";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { LineFeedsToBreaksPipe } from "../../../pipes/line-feeds-to-breaks.pipe";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MailchimpCampaignService } from "../../../services/mailchimp/mailchimp-campaign.service";
import { MailchimpLinkService } from "../../../services/mailchimp/mailchimp-link.service";
import { MailchimpListService } from "../../../services/mailchimp/mailchimp-list.service";
import { MailchimpSegmentService } from "../../../services/mailchimp/mailchimp-segment.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SocialEventsService } from "../../../services/social-events/social-events.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { SocialSendNotificationModalComponent } from "../send-notification/social-send-notification-modal.component";
import { SocialDisplayService } from "../social-display.service";

@Component({
  selector: "app-social-edit",
  templateUrl: "social-edit.component.html",
  styleUrls: ["social-edit.component.sass"]
})
export class SocialEditComponent implements OnInit, OnDestroy {
  @Input()
  public actions: Actions;
  public socialEvent: SocialEvent;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  private logger: Logger;
  private campaignSearchTerm: string;
  public hasFileOver = false;
  public eventDate: DateValue;
  private existingTitle: string;
  public uploader: FileUploader;
  public socialEventEditMode: string;
  public longerDescriptionPreview = true;
  public selectedMemberIds: string[] = [];
  faCopy = faCopy;
  faEye = faEye;
  faPencil = faPencil;
  editActive: boolean;
  public awsFileData: AwsFileData;
  private subscriptions: Subscription[] = [];

  constructor(private contentMetadataService: ContentMetadataService,
              private fileUploadService: FileUploadService,
              private mailchimpSegmentService: MailchimpSegmentService,
              private mailchimpListService: MailchimpListService,
              public display: SocialDisplayService,
              private mailchimpCampaignService: MailchimpCampaignService,
              private mailchimpConfigService: MailchimpConfigService,
              private notifierService: NotifierService,
              private stringUtils: StringUtilsService,
              private memberService: MemberService,
              private fullNameWithAlias: FullNameWithAliasPipe,
              private lineFeedsToBreaks: LineFeedsToBreaksPipe,
              private modalService: BsModalService,
              public googleMapsService: GoogleMapsService,
              private mailchimpLinkService: MailchimpLinkService,
              private socialEventsService: SocialEventsService,
              private memberLoginService: MemberLoginService,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialEditComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    if (this.urlService.pathContainsMongoId()) {
      this.notify.setBusy();
      const socialEventId = this.urlService.lastPathSegment();
      this.logger.debug("finding socialEvent from socialEventId:", socialEventId);
      this.socialEventsService.getById(socialEventId).then(data => {
        this.socialEvent = data;
        if (!this.socialEvent.attendees) {
          this.socialEvent.attendees = [];
        }
        this.eventDate = this.dateUtils.asDateValue(this.socialEvent.eventDate);
        this.existingTitle = this.socialEvent?.attachment?.title;
        this.campaignSearchTerm = "Master";
        this.notify.hide();
        this.selectedMemberIds = this.socialEvent.attendees.map(attendee => attendee.id);
      });
    } else if (this.display.inNewEventMode()) {
      const todayValue = this.dateUtils.momentNowNoTime().valueOf();
      this.socialEvent = {eventDate: todayValue, attendees: []};
    } else {
      this.notify.error({title: "Cannot edit social event", message: "path does not contain social event id"});
    }
    this.uploader = this.fileUploadService.createUploaderFor("socialEvents");
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
        this.logger.debug("response", response, "type", typeof response);
        this.notify.clearBusy();
        if (response instanceof HttpErrorResponse) {
          this.notify.error({title: "Upload failed", message: response.error});
        } else if (response === "Unauthorized") {
          this.notify.error({title: "Upload failed", message: response + " - try logging out and logging back in again and trying this again."});
        } else {
          const uploadResponse = JSON.parse(response);
          this.socialEvent.attachment = uploadResponse.response.fileNameData;
          this.socialEvent.attachment.title = this.existingTitle;
          this.logger.debug("JSON response:", uploadResponse, "socialEvent:", this.socialEvent);
          this.notify.clearBusy();
          this.notify.success({title: "New file added", message: this.socialEvent.attachment.title});
        }
      }
    ));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onChange() {
    this.socialEvent.attendees = this.selectedMemberIds.map(item => this.memberService.toIdentifiable(item));
    this.logger.debug("attendees: ", this.socialEvent.attendees);
    if (this.selectedMemberIds.length > 0) {
      this.notify.warning({
        title: "Member selection",
        message: `${this.selectedMemberIds.length} attendees selected`
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

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  fileDropped($event: File[]) {
    this.logger.debug("fileDropped:", $event);
  }

  cancelFileChange() {
    this.close();
  }

  saveSocialEvent() {
    this.notify.setBusy();
    this.logger.debug("saveSocialEvent ->", this.socialEvent);
    return this.socialEventsService.createOrUpdate(this.socialEvent)
      .then(() => this.close())
      .then(() => this.notify.clearBusy())
      .catch((error) => this.handleError(error));
  }

  deleteSocialEventDetails() {
    this.display.confirm.toggleOnDeleteConfirm();
  }

  confirmDeleteSocialEventDetails() {
    Promise.resolve(this.notify.progress("Deleting social event", true))
      .then(() => this.deleteMailchimpSegment())
      .then(() => this.removeSocialEventAndRefreshSocialEvents())
      .then(() => this.notify.clearBusy())
      .catch((error) => this.notify.error(error));
  }

  deleteMailchimpSegment() {
    if (this.socialEvent.mailchimp && this.socialEvent.mailchimp.segmentId) {
      return this.mailchimpListService.deleteSegment("socialEvents", this.socialEvent.mailchimp.segmentId);
    }
  }

  removeSocialEventAndRefreshSocialEvents() {
    this.socialEventsService.delete(this.socialEvent).then(() => this.close());
  }

  selectMemberContactDetails(memberId: string) {
    const socialEvent = this.socialEvent;
    if (memberId === null) {
      socialEvent.eventContactMemberId = "";
      socialEvent.displayName = "";
      socialEvent.contactPhone = "";
      socialEvent.contactEmail = "";
    } else {
      this.logger.debug("looking for member id", memberId, "in memberFilterSelections", this.display.memberFilterSelections);
      const selectedMember = this.display.memberFilterSelections.find(member => member.id === memberId).member;
      socialEvent.displayName = selectedMember.displayName;
      socialEvent.contactPhone = selectedMember.mobileNumber;
      socialEvent.contactEmail = selectedMember.email;
    }
  }

  editLongerDescription() {
    this.logger.debug("editLongerDescription");
    this.longerDescriptionPreview = false;
  }

  previewLongerDescription() {
    this.logger.debug("previewLongerDescription");
    this.longerDescriptionPreview = true;
  }

  saveSocialEventDetails() {
    Promise.resolve(this.notify.progress({title: "Save in progress", message: "Saving social event"}, true))
      .then(() => this.saveSocialEvent())
      .then(() => this.notify.clearBusy())
      .catch((error) => this.notify.error(error));
  }

  imageCroppingError(errorEvent: ErrorEvent) {
    this.notify.error({
      title: "Image cropping error occurred",
      message: (errorEvent ? (". Error was: " + JSON.stringify(errorEvent)) : "")
    });
    this.notify.clearBusy();
  }

  handleError(errorResponse) {
    this.notify.error({
      title: "Your changes could not be saved",
      message: (errorResponse && errorResponse.error ? (". Error was: " + JSON.stringify(errorResponse.error)) : "")
    });
    this.notify.clearBusy();
  }

  deleteSocialEvent() {
    this.display.confirm.as(ConfirmType.DELETE);
  }

  showAlertMessage(): boolean {
    return this.notifyTarget.busy || this.notifyTarget.showAlert;
  }

  pendingCompletion(): boolean {
    return this.notifyTarget.busy || this.display.confirm.notificationsOutstanding();
  }

  eventDateChanged(dateValue: DateValue) {
    if (dateValue) {
      this.logger.debug("eventDateChanged", dateValue);
      this.socialEvent.eventDate = dateValue.value;
    }
  }

  browseToFile(fileElement: HTMLInputElement) {
    this.existingTitle = this.socialEvent?.attachment?.title;
    fileElement.click();
  }

  removeAttachment() {
    this.socialEvent.attachment = {};
  }

  onFileSelect($file: File[]) {
    this.notify.setBusy();
    this.notify.progress({title: "Attachment upload", message: `uploading ${first($file).name} - please wait...`});
  }

  close() {
    this.display.confirm.clear();
    this.actions.clearEditMode();
    this.logger.info("close:this.actions", this.actions, "this.display.confirm", this.display.confirm);
    if (this.display.inNewEventMode()) {
      this.urlService.navigateTo("social");
    }
  }

  confirmDeleteSocialEvent() {
    this.socialEventsService.delete(this.socialEvent)
      .then(() => this.close());
  }

  cancelDeleteSocialEvent() {
    this.display.confirm.clear();
  }

  copyDetailsToNewSocialEvent() {
    const copiedSocialEvent = cloneDeep(this.socialEvent);
    delete copiedSocialEvent.id;
    delete copiedSocialEvent.mailchimp;
    delete copiedSocialEvent.notification;
    copiedSocialEvent.attendees = [];
    this.socialEvent = copiedSocialEvent;
    this.display.confirm.clear();
    const existingRecordEditEnabled = this.display.allow.edits && "Copy Existing".startsWith("Edit");
    this.display.allow.copy = existingRecordEditEnabled;
    this.display.allow.delete = existingRecordEditEnabled;
    this.notify.success({
      title: "Existing social event copied!",
      message: "Make changes here and save to create a new social event."
    });
  }

  attendeeCaption() {
    return this.socialEvent && this.socialEvent.attendees.length + (this.socialEvent.attendees.length === 1 ? " member is attending" : " members are attending"
    );
  }

  cancelSocialEventDetails() {
    this.close();
  }

  sendSocialEventNotification() {
    this.modalService.show(SocialSendNotificationModalComponent, this.display.createModalOptions({
      memberFilterSelections: this.display.memberFilterSelections,
      socialEvent: this.socialEvent,
      allow: this.display.allow,
      confirm: this.display.confirm
    }));
    this.close();
  }

  imageChanged(awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData);
    this.awsFileData = awsFileData;
  }

  exitImageEdit() {
    this.editActive = false;
    this.awsFileData = null;
  }

  imagedSaved(awsFileData: AwsFileData) {
    const thumbnail = awsFileData.awsFileName;
    this.logger.info("imagedSaved:", awsFileData, "setting thumbnail to", thumbnail);
    this.socialEvent.thumbnail = thumbnail;
    this.awsFileData = null;
  }

  editImage() {
    this.editActive = true;
  }

}

