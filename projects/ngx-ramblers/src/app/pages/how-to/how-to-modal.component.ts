import { HttpErrorResponse } from "@angular/common/http";
import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import first from "lodash-es/first";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FileUtilsService } from "../../file-utils.service";
import { AlertTarget } from "../../models/alert-target.model";
import { DateValue } from "../../models/date.model";
import { MailchimpCampaign, MailchimpCampaignSearchRequest } from "../../models/mailchimp.model";
import { MailchimpCampaignMixedVersion, MemberResource } from "../../models/member-resource.model";
import { Confirm } from "../../models/ui-actions";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { DateUtilsService } from "../../services/date-utils.service";
import { FileUploadService } from "../../services/file-upload.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MailchimpCampaignService } from "../../services/mailchimp/mailchimp-campaign.service";
import { MemberResourcesService } from "../../services/member-resources/member-resources.service";
import { MemberResourcesReferenceDataService } from "../../services/member/member-resources-reference-data.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { AwsFileUploadResponseData } from "../../models/aws-object.model";
import { DatePickerComponent } from "../../date-picker/date-picker.component";
import { FormsModule } from "@angular/forms";
import { NgClass, NgStyle } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-how-to-modal",
    templateUrl: "how-to-modal.component.html",
    imports: [DatePickerComponent, FormsModule, NgClass, FileUploadModule, NgStyle, FontAwesomeModule]
})
export class HowToModalComponent implements OnInit, AfterViewInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("HowToModalComponent", NgxLoggerLevel.ERROR);
  private mailchimpCampaignService = inject(MailchimpCampaignService);
  private notifierService = inject(NotifierService);
  stringUtils = inject(StringUtilsService);
  private displayDate = inject(DisplayDatePipe);
  memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  private memberResourcesService = inject(MemberResourcesService);
  fileUtils = inject(FileUtilsService);
  protected dateUtils = inject(DateUtilsService);
  bsModalRef = inject(BsModalRef);
  private fileUploadService: FileUploadService = inject(FileUploadService);
  @ViewChild("searchInput") private searchInput: ElementRef;
  public memberResource: MemberResource;
  public confirm: Confirm;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  public hasFileOver = false;
  public resourceDate: DateValue;
  private existingTitle: string;
  public uploader: FileUploader;
  public editMode: string;
  public campaigns: MailchimpCampaign[] = [];
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    const resourceUrl = this.memberResourcesReferenceData.resourceTypeDataFor(this.memberResource.resourceType).resourceUrl(this.memberResource);
    this.logger.info("constructed with memberResource", this.memberResource, "resourceUrl:", resourceUrl);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.notify.hide();
    this.uploader = this.fileUploadService.createUploaderFor("memberResources");
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
      const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
      this.memberResource.data.fileNameData = awsFileUploadResponseData.fileNameData;
      this.memberResource.data.fileNameData.title = this.existingTitle;
      this.notify.success({title: "New file added", message: this.memberResource.data.fileNameData.title});
    }));
    this.editMode = this.memberResource.id ? "Edit existing" : "Create new";
    this.resourceDate = this.dateUtils.asDateValue(this.memberResource.resourceDate);
  }

  ngAfterViewInit(): void {
    this.logger.info("ngAfterViewInit:searchInput.nativeElement",this.searchInput.nativeElement);
    this.searchInput.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  browseToFile(fileElement: HTMLInputElement) {
    this.existingTitle = this.memberResource?.data.fileNameData?.title;
    fileElement.click();
  }

  removeAttachment() {
    this.memberResource.data.fileNameData = {};
  }

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  fileDropped($event: File[]) {
    this.logger.debug("fileDropped:", $event);
  }

  onFileSelect($file: File[]) {
    this.notify.setBusy();
    this.notify.progress({title: "Attachment upload", message: `uploading ${first($file).name} - please wait...`});
  }

  close() {
    this.confirm.clear();
    this.bsModalRef.hide();
  }

  campaignDate(campaign: MailchimpCampaignMixedVersion): number {
    if (MemberResourcesReferenceDataService.isMailchimpCampaign(campaign)) {
      return this.dateUtils.asValueNoTime(campaign.send_time || campaign.create_time);
    } else {
      return this.dateUtils.asValueNoTime(campaign.create_time);
    }

  }

  campaignTitle(campaign: MailchimpCampaign) {
    return campaign.settings.title + " (" + this.displayDate.transform(this.campaignDate(campaign)) + ")";
  }

  setMemberResourceTitle(title: string, isCampaign: boolean) {
    this.logger.info("isMailchimpCampaign:", isCampaign, "setting title to ", title);
    this.memberResource.title = title;
  }

  campaignChange() {
    this.logger.info("campaignChange:memberResource.data.campaign", this.memberResource.data.campaign);

    if (this.memberResource.data.campaign) {
      if (MemberResourcesReferenceDataService.isMailchimpCampaign(this.memberResource.data.campaign)) {
        this.setMemberResourceTitle(this.memberResource.data.campaign.settings.title, true);
      } else {
        this.setMemberResourceTitle(this.memberResource.data.campaign.title, false);
      }
      this.memberResource.resourceDate = this.campaignDate(this.memberResource.data.campaign);
    }
  }

  performCampaignSearch(campaignSearchTerm:string, selectFirst:boolean): Promise<any> {
    this.logger.info("campaignSearchTerm:",campaignSearchTerm);
    if (campaignSearchTerm) {
      this.notify.setBusy();
      this.notify.progress({
        title: "Email search",
        message: "searching for campaigns matching '" + campaignSearchTerm + "'"
      });
      const options: MailchimpCampaignSearchRequest = {
        concise: true,
        query: campaignSearchTerm,
      };
      return this.mailchimpCampaignService.search(options)
        .then((response) => {
          this.campaigns = response.results.map(item => item.campaign);
          this.logger.info("mailchimpCampaignService search response", response);
          if (selectFirst) {
            this.memberResource.data.campaign = first(this.campaigns);
            this.campaignChange();
          } else {
            this.logger.debug("this.memberResource.data.campaign", this.memberResource.data.campaign, "first campaign=", first(this.campaigns));
          }
          this.logger.debug("response.data", response.results);
          this.notify.success({
            title: "Email search",
            message: "Found " + this.campaigns.length + " campaigns matching '" + campaignSearchTerm + "'"
          });
          this.notify.clearBusy();
          return true;
        });
    } else {
      return Promise.resolve(true);
    }
  }

  resourceDateChanged(dateValue: DateValue) {
    if (dateValue) {
      this.logger.debug("resourceDateChanged", dateValue);
      this.memberResource.resourceDate = dateValue.value;
    }
  }

  cancelChange() {
    this.bsModalRef.hide();
  }

  delete() {
    this.confirm.toggleOnDeleteConfirm();
  }

  save() {
    this.notify.setBusy();
    this.memberResourcesService.createOrUpdate(this.memberResource)
      .then(() => this.bsModalRef.hide());
  }

  confirmDelete() {
    this.notify.setBusy();
    this.memberResourcesService.delete(this.memberResource)
      .then(() => this.bsModalRef.hide());
  }

}
