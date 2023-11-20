import { HttpErrorResponse } from "@angular/common/http";
import { Component, OnDestroy, OnInit } from "@angular/core";
import first from "lodash-es/first";
import { FileUploader } from "ng2-file-upload";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { CommitteeFile, Notification } from "../../../models/committee.model";
import { DateValue } from "../../../models/date.model";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { LineFeedsToBreaksPipe } from "../../../pipes/line-feeds-to-breaks.pipe";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MailchimpCampaignService } from "../../../services/mailchimp/mailchimp-campaign.service";
import { MailchimpLinkService } from "../../../services/mailchimp/mailchimp-link.service";
import { MailchimpSegmentService } from "../../../services/mailchimp/mailchimp-segment.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { CommitteeDisplayService } from "../committee-display.service";
import { AwsFileUploadResponseData } from "../../../models/aws-object.model";

@Component({
  selector: "app-committee-edit-file-modal",
  styleUrls: ["committee-edit-file-modal.component.sass"],
  templateUrl: "./committee-edit-file-modal.component.html",
})
export class CommitteeEditFileModalComponent implements OnInit, OnDestroy {
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  private logger: Logger;
  public committeeFile: CommitteeFile;
  private campaignSearchTerm: string;
  public hasFileOver = false;
  public eventDate: DateValue;
  private existingTitle: string;
  public uploader: FileUploader;
  private subscriptions: Subscription[] = [];

  constructor(private contentMetadataService: ContentMetadataService,
              private fileUploadService: FileUploadService,
              private authService: AuthService,
              private mailchimpSegmentService: MailchimpSegmentService,
              public display: CommitteeDisplayService,
              private committeeQueryService: CommitteeQueryService,
              private committeeFileService: CommitteeFileService,
              private mailchimpCampaignService: MailchimpCampaignService,
              private mailchimpConfig: MailchimpConfigService,
              private notifierService: NotifierService,
              private stringUtils: StringUtilsService,
              private memberService: MemberService,
              private fullNameWithAlias: FullNameWithAliasPipe,
              private lineFeedsToBreaks: LineFeedsToBreaksPipe,
              private modalService: BsModalService,
              private mailchimpLinkService: MailchimpLinkService,
              private memberLoginService: MemberLoginService,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(CommitteeEditFileModalComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed with committeeFile", this.committeeFile);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.eventDate = this.dateUtils.asDateValue(this.committeeFile.eventDate);
    this.existingTitle = this.committeeFile?.fileNameData?.title;
    this.campaignSearchTerm = "Master";
    this.notify.hide();
    this.uploader = this.fileUploadService.createUploaderFor("committeeFiles");
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
      const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
      this.committeeFile.fileNameData = awsFileUploadResponseData.fileNameData;
      this.committeeFile.fileNameData.title = this.existingTitle;
      this.notify.success({title: "New file added", message: this.committeeFile.fileNameData.title});
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
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

  saveCommitteeFile() {
    this.notify.setBusy();
    this.logger.debug("saveCommitteeFile ->", this.committeeFile);
    return this.committeeFileService.createOrUpdate(this.committeeFile)
      .then(() => {
        this.close();
        this.notify.clearBusy();
        this.display.confirm.clear();
      })
      .catch((error) => this.handleError(error));
  }

  handleError(errorResponse) {
    this.notify.error({
      title: "Your changes could not be saved",
      message: (errorResponse && errorResponse.error ? (". Error was: " + JSON.stringify(errorResponse.error)) : "")
    });
    this.notify.clearBusy();
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
      this.committeeFile.eventDate = dateValue.value;
    }
  }

  browseToFile(fileElement: HTMLInputElement) {
    this.existingTitle = this.committeeFile?.fileNameData?.title;
    fileElement.click();
  }

  removeAttachment() {
    this.committeeFile.fileNameData = undefined;
  }

  onFileSelect($file: File[]) {
    this.notify.setBusy();
    this.notify.progress({title: "Attachment upload", message: `uploading ${first($file).name} - please wait...`});
  }

  close() {
    this.bsModalRef.hide();
  }

  confirmDeleteCommitteeFile() {
    this.display.confirmDeleteCommitteeFile(this.notify, this.committeeFile).then(() => this.close());
  }
}
