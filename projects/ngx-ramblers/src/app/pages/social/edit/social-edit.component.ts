import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faCopy, faEnvelope, faEye, faPencil } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { AwsFileData, AwsFileUploadResponseData } from "../../../models/aws-object.model";
import { DateValue } from "../../../models/date.model";
import { MemberFilterSelection } from "../../../models/member.model";
import { SocialEvent } from "../../../models/social-events.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SocialEventsService } from "../../../services/social-events/social-events.service";
import { UrlService } from "../../../services/url.service";
import { SocialSendNotificationModalComponent } from "../send-notification/social-send-notification-modal.component";
import { SocialDisplayService } from "../social-display.service";
import { PageService } from "../../../services/page.service";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { DatePickerComponent } from "../../../date-picker/date-picker.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownComponent } from "ngx-markdown";
import { NgClass, NgStyle, NgTemplateOutlet } from "@angular/common";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { SocialCardComponent } from "../social-card/social-card";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgOptgroupTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { RootFolder } from "../../../models/system.model";

@Component({
    selector: "app-social-edit",
    template: `
      <app-page [pageTitle]="pageTitle()">
        @if (socialEvent) {
          <div class="row">
            <div class="col-sm-12">
              <tabset class="custom-tabset">
                <tab heading="Social Event Details">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <div class="row">
                      <div class="col-sm-12">
                        <div class="form-group">
                          <label for="title">Title</label>
                          <input [disabled]="!display.allow.edits"
                                 [(ngModel)]="socialEvent.briefDescription" type="text"
                                 class="form-control input-sm"
                                 id="title"
                                 placeholder="Enter title for social event here"/>
                        </div>
                      </div>
                    </div>
                    <div class="row">
                      <div class="col-sm-6">
                        <div class="form-group">
                          <app-date-picker startOfDay [label]="'Social Event Date'"
                                           [size]="'md'"
                                           (dateChange)="eventDateChanged($event)"
                                           [value]="eventDate">
                          </app-date-picker>
                        </div>
                      </div>
                      <div class="col-sm-3">
                        <div class="form-group">
                          <label for="start-time">Start Time</label>
                          <input [disabled]="!display.allow.edits"
                                 [(ngModel)]="socialEvent.eventTimeStart" type="text"
                                 class="form-control input-sm" id="start-time"
                                 placeholder="Enter Start time here"/>
                        </div>
                      </div>
                      <div class="col-sm-3">
                        <div class="form-group">
                          <label for="end-time">End Time</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.eventTimeEnd"
                                 type="text" class="form-control input-sm" id="end-time"
                                 placeholder="Enter End time here"/>
                        </div>
                      </div>
                    </div>
                    <div class="row">
                      <div class="col-sm-8">
                        <div class="form-group">
                          <label for="location">Location</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.location"
                                 type="text" class="form-control input-sm" id="location"
                                 placeholder="Enter Location here">
                        </div>
                      </div>
                      <div class="col-sm-4">
                        <div class="form-group">
                          <label for="post-code">Postcode</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.postcode"
                                 type="text" class="form-control input-sm" id="post-code"
                                 placeholder="Enter Postcode here">
                        </div>
                      </div>
                    </div>
                    <div class="row">
                      <div class="col-sm-12">
                        <div class="event-description">
                          <div class="form-group">
                            <label for="longer-description">Description
                              @if (!longerDescriptionPreview) {
                                <a (click)="previewLongerDescription()" [href]="">
                                  <fa-icon [icon]="faEye" class="markdown-preview-icon"></fa-icon>
                                  preview</a>
                              }
                              @if (longerDescriptionPreview) {
                                <a (click)="editLongerDescription()" [href]="">
                                  <fa-icon [icon]="faPencil" class="markdown-preview-icon"></fa-icon>
                                  edit</a>
                              }
                            </label>
                            <div>
                              @if (longerDescriptionPreview) {
                                <p class="list-arrow"
                                   (click)="editLongerDescription()"
                                   markdown [data]="socialEvent.longerDescription"
                                   id="longer-description-preview"></p>
                              }
                            </div>
                            @if (!longerDescriptionPreview) {
                              <textarea
                                [disabled]="!display.allow.edits"
                                (blur)="previewLongerDescription()"
                                [(ngModel)]="socialEvent.longerDescription"
                                type="text"
                                class="form-control input-sm"
                                rows="{{socialEvent.thumbnail ? 20 : 5}}"
                                id="longer-description"
                                placeholder="Enter description for social event here"></textarea>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </tab>
                <tab heading="Image">
                  <ng-template #linkAndThumbnail>
                    <div class="form-group">
                      <label for="img-thumbnail">Thumbnail</label>
                      <input [disabled]="!display.allow.edits || editActive"
                             [(ngModel)]="socialEvent.thumbnail"
                             type="text" value="" class="form-control input-sm"
                             id="img-thumbnail"
                             placeholder="Enter a thumbnail image">
                    </div>
                    <div class="form-group">
                      <label for="link">Link</label>
                      <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.link"
                             type="text" value="" class="form-control input-sm" id="link"
                             placeholder="Enter a link">
                    </div>
                    <div class="form-group">
                      <label for="linkTitle">Display title for link</label>
                      <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.linkTitle"
                             type="text" value="" class="form-control input-sm" id="linkTitle"
                             placeholder="Enter a title for link">
                    </div>
                    <div class="form-group">
                      <label for="linkTitle" class="mr-2">Link Preview: </label>
                      <a [href]="socialEvent.link">{{ socialEvent.linkTitle || socialEvent.link }}</a>
                    </div>
                  </ng-template>
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <div class="row">
                      @if (!editActive) {
                        <div class="col-sm-6">
                          <ng-container *ngTemplateOutlet="linkAndThumbnail"/>
                        </div>
                      }
                      @if (editActive) {
                        <div class="col-sm-6">
                          <app-image-cropper-and-resizer
                            wrapButtons
                            [rootFolder]="RootFolder.socialEventsImages"
                            [preloadImage]="socialEvent.thumbnail"
                            (imageChange)="imageChanged($event)"
                            (error)="imageCroppingError($event)"
                            (cropError)="imageCroppingError($event)"
                            (quit)="exitImageEdit()"
                            (save)="imagedSaved($event)"/>
                        </div>
                      }
                      <div class="col-sm-6">
                        <div class="position-relative">
                          <app-social-card [socialEvent]="socialEvent"
                                           [imagePreview]="awsFileData?.image"/>
                          @if (!editActive) {
                            <div (click)="editImage()"
                                 delay=500 tooltip="edit image" class="button-form-right badge-button edit-image">
                              <fa-icon [icon]="faPencil"/>
                              <span>edit image</span>
                            </div>
                          }
                        </div>
                        @if (editActive) {
                          <div class="mt-3">
                            <ng-container *ngTemplateOutlet="linkAndThumbnail"/>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </tab>
                <tab heading="Organiser">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <div class="row">
                      <div class="col-sm-12">
                        <div class="form-group">
                          <label for="contact-member">Event Organiser</label>
                          <select [disabled]="!display.allow.edits" (ngModelChange)="selectMemberContactDetails($event)"
                                  class="form-control input-sm"
                                  [(ngModel)]="socialEvent.eventContactMemberId">
                            <option value="">(no event organiser yet)</option>
                            @for (selection of display.memberFilterSelections; track selection.id) {
                              <option
                                [ngValue]="selection.id"
                                [textContent]="selection.member | fullNameWithAlias"
                                class="form-control rounded spaced-controls" id="contact-member">
                                }
                          </select>
                        </div>
                        <div class="form-group">
                          <label for="contact-display-name">Display Name</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.displayName"
                                 type="text" class="form-control input-sm"
                                 id="contact-display-name"/>
                        </div>
                        <div class="form-group">
                          <label for="contact-phone">Contact Phone</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.contactPhone"
                                 type="text" class="form-control input-sm" id="contact-phone"
                                 placeholder="Enter contact phone here"/>
                        </div>
                        <div class="form-group">
                          <label for="contact-email">Contact Email</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.contactEmail"
                                 type="text" class="form-control input-sm" id="contact-email"
                                 placeholder="Enter contact email here"/>
                        </div>
                      </div>
                    </div>
                  </div>
                </tab>
                <tab heading="Attendees">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <div class="row">
                      <div class="col-sm-12" delay="2000"
                           [tooltip]="attendeeCaption()">
                        @if (display.allow.edits) {
                          <ng-select [items]="display.memberFilterSelections"
                                     bindLabel="text"
                                     bindValue="id"
                                     placeholder="Select one or more members"
                                     [disabled]="notifyTarget.busy"
                                     [dropdownPosition]="'bottom'"
                                     [groupBy]="groupBy"
                                     [groupValue]="groupValue"
                                     [multiple]="true"
                                     [closeOnSelect]="true"
                                     (change)="onChange()"
                                     [(ngModel)]="selectedMemberIds">
                            <ng-template ng-optgroup-tmp let-item="item">
                              <span class="group-header">{{ item.name }}</span>
                              <span class="ml-1 badge badge-secondary badge-group"> {{ item.total }}</span>
                            </ng-template>
                          </ng-select>
                        }
                      </div>
                      @if (!display.allow.edits) {
                        <p class="col-sm-12 rounded">
                          {{ display.attendeeList(socialEvent, display.memberFilterSelections) }}</p>
                      }
                    </div>
                  </div>
                </tab>
                @if (display.allow.edits) {
                  <tab heading="Attachment">
                    <div class="img-thumbnail thumbnail-admin-edit">
                      <div class="row">
                        <div class="col-md-12">
                          <input type="submit" [disabled]="notifyTarget.busy"
                                 value="Browse for attachment"
                                 (click)="browseToFile(fileElement)"
                                 class="button-form mb-10"
                                 [ngClass]="{'disabled-button-form': notifyTarget.busy}"/>
                          <input [disabled]="notifyTarget.busy" type="submit"
                                 value="Remove attachment" (click)="removeAttachment()" title="Remove attachment"
                                 [ngClass]="notifyTarget.busy ? 'disabled-button-form': 'button-form'"/>
                          <input #fileElement id="browse-to-file" name="attachment" class="d-none"
                                 type="file" value="Upload"
                                 ng2FileSelect (onFileSelected)="onFileSelect($event)" [uploader]="uploader"/>
                          <div ng2FileDrop [ngClass]="{'file-over': hasFileOver}"
                               (fileOver)="fileOver($event)"
                               (onFileDrop)="fileDropped($event)"
                               [uploader]="uploader"
                               class="drop-zone">Or drop file here
                          </div>
                          @if (notifyTarget.busy) {
                            <div class="progress">
                              <div class="progress-bar" role="progressbar"
                                   [ngStyle]="{ 'width': uploader.progress + '%' }">
                                uploading {{ uploader.progress }}%
                              </div>
                            </div>
                          }
                        </div>
                        @if (display.attachmentExists(socialEvent)) {
                          <div class="col-md-12">
                            <div class="form-group">
                              <label class="mt-2">Originally uploaded
                                as: {{ socialEvent.attachment.originalFileName }}</label>
                            </div>
                            <div class="form-group">
                              <label class="form-inline" for="attachment-title">Title</label>
                              @if (display.allow.edits) {
                                <input [(ngModel)]="socialEvent.attachment.title"
                                       [disabled]="notifyTarget.busy"
                                       type="text"
                                       id="attachment-title"
                                       class="form-control input-md"
                                       placeholder="Enter a title for this attachment"/>
                              }
                            </div>
                            <div class="form-group">
                              <label class="form-inline" for="attachment">Display:
                                <a class="ml-2" target="_blank" [href]="display.attachmentUrl(socialEvent)"
                                   id="attachment">
                                  {{ display.attachmentTitle(socialEvent) }}</a>
                              </label>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  </tab>
                }
              </tabset>
            </div>
            <div class="col-sm-12">
              @if (notifyTarget.showAlert) {
                <div class="alert {{notifyTarget.alertClass}}">
                  <fa-icon [icon]="notifyTarget.alert.icon"/>
                  @if (notifyTarget.alertTitle) {
                    <strong>
                      {{ notifyTarget.alertTitle }}: </strong>
                  } {{ notifyTarget.alertMessage }}
                </div>
              }
            </div>
            @if (display.socialEventLink(socialEvent, true)) {
              <div class="col-sm-12">
                <label><app-copy-icon [icon]="faCopy" title [value]="display.socialEventLink(socialEvent, false)"
                                      [elementName]="'event link'">copy link to this</app-copy-icon>
                  <a class="ml-1" [href]="display.socialEventLink(socialEvent, true)"
                     target="_blank">social event</a></label>
              </div>
            }
            <div class="col-sm-12">
              @if (display.allow.edits) {
                <input type="submit" value="Save" (click)="saveSocialEventDetails()"
                       [ngClass]="{'disabled-button-form': notifyTarget.busy}"
                       title="Save this social event" class="button-form button-form-left"/>
              }
              @if (display.allow.edits) {
                <input type="submit" value="Send Notification"
                       (click)="sendSocialEventNotification()" title="Send social event notification"
                       [ngClass]="{'disabled-button-form': notifyTarget.busy}"
                       class="button-form yellow-confirm"/>
              }
              @if (display.allow.delete) {
                <input type="submit" value="Delete" (click)="deleteSocialEventDetails()"
                       [ngClass]="{'disabled-button-form': notifyTarget.busy}"
                       title="Delete this social event" class="button-form button-form-left"/>
              }
              @if (display.confirm.deleteConfirmOutstanding()) {
                <input type="submit" value="Confirm Deletion"
                       [ngClass]="{'disabled-button-form': notifyTarget.busy}"
                       (click)="confirmDeleteSocialEventDetails()" title="Confirm delete of this social event"
                       class="button-form button-form-left button-confirm"/>
              }
              @if (display.allow.edits) {
                <input type="submit" value="Cancel" (click)="cancelSocialEventDetails()"
                       [ngClass]="{'disabled-button-form': notifyTarget.busy}"
                       title="Cancel and don't save social event" class="button-form button-form-left"/>
              }
              @if (display.allow.copy) {
                <input type="submit" value="Copy" (click)="copyDetailsToNewSocialEvent()"
                       [ngClass]="{'disabled-button-form': notifyTarget.busy}"
                       title="Copy details to new social event" class="button-form button-form-left"/>
              }
              @if (!display.allow.edits) {
                <input type="submit" value="Close" (click)="cancelSocialEventDetails()"
                       [ngClass]="{'disabled-button-form': notifyTarget.busy}"
                       title="Close this social event without saving" class="button-form button-form-left"/>
              }
            </div>
          </div>
        }
      </app-page>
    `,
    styleUrls: ["social-edit.component.sass"],
  imports: [PageComponent, TabsetComponent, TabDirective, FormsModule, DatePickerComponent, FontAwesomeModule, MarkdownComponent, NgTemplateOutlet, ImageCropperAndResizerComponent, SocialCardComponent, TooltipDirective, NgSelectComponent, NgOptgroupTemplateDirective, NgClass, FileUploadModule, NgStyle, FullNameWithAliasPipe, CopyIconComponent]
})
export class SocialEditComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialEditComponent", NgxLoggerLevel.ERROR);
  private fileUploadService = inject(FileUploadService);
  private pageService = inject(PageService);
  display = inject(SocialDisplayService);
  private notifierService = inject(NotifierService);
  private memberService = inject(MemberService);
  private modalService = inject(BsModalService);
  googleMapsService = inject(GoogleMapsService);
  private socialEventsService = inject(SocialEventsService);
  private urlService = inject(UrlService);
  protected dateUtils = inject(DateUtilsService);
  public socialEvent: SocialEvent;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  public hasFileOver = false;
  public eventDate: DateValue;
  private existingTitle: string;
  public uploader: FileUploader;
  public longerDescriptionPreview = true;
  public selectedMemberIds: string[] = [];
  faCopy = faCopy;
  faEye = faEye;
  faPencil = faPencil;
  editActive: boolean;
  public awsFileData: AwsFileData;
  private subscriptions: Subscription[] = [];
  protected readonly RootFolder = RootFolder;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    if (this.urlService.pathContainsEventId()) {
      this.notify.setBusy();
      const socialEventId = this.urlService.segmentWithMongoId();
      this.logger.debug("finding socialEvent from socialEventId:", socialEventId);
      this.socialEventsService.queryForId(socialEventId).then(data => {
        this.socialEvent = data;
        if (!this.socialEvent.attendees) {
          this.socialEvent.attendees = [];
        }
        this.eventDate = this.dateUtils.asDateValue(this.socialEvent.eventDate);
        this.existingTitle = this.socialEvent?.attachment?.title;
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
      const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
          this.socialEvent.attachment = awsFileUploadResponseData.fileNameData;
          this.socialEvent.attachment.title = this.existingTitle;
          this.logger.debug("JSON response:", awsFileUploadResponseData, "socialEvent:", this.socialEvent);
          this.notify.clearBusy();
          this.notify.success({title: "New file added", message: this.socialEvent.attachment.title});
      }
    ));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  pageTitle(): string {
    return this.urlService.lastPathSegment() === "new" ? "Create New Social Event" : "Social Event Edit";
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
      .then(() => this.removeSocialEventAndRefreshSocialEvents())
      .then(() => this.notify.clearBusy())
      .catch((error) => this.notify.error(error));
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
    this.logger.info("close:display.confirm", this.display.confirm);
    if (this.socialEvent.id) {
      this.urlService.navigateTo([this.pageService.socialPage()?.href, this.socialEvent.id]);
    } else {
      this.urlService.navigateTo([this.pageService.socialPage()?.href]);
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
    this.exitImageEdit();
  }

  editImage() {
    this.editActive = true;
  }
}
