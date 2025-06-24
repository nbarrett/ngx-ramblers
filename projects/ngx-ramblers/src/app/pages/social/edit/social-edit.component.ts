import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faCopy, faEye, faPencil } from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { AwsFileUploadResponseData } from "../../../models/aws-object.model";
import { DateValue } from "../../../models/date.model";
import { MemberFilterSelection } from "../../../models/member.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { SocialSendNotificationModalComponent } from "../send-notification/social-send-notification-modal.component";
import { SocialDisplayService } from "../social-display.service";
import { PageService } from "../../../services/page.service";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { DatePicker } from "../../../date-and-time/date-picker";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownComponent } from "ngx-markdown";
import { NgClass, NgStyle } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgOptgroupTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { RootFolder, SystemConfig } from "../../../models/system.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { EventDefaultsService } from "../../../services/event-defaults.service";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { EditGroupEventImagesComponent } from "../../../common/walks-and-events/edit-group-event-images";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { TimePicker } from "../../../date-and-time/time-picker";
import isString from "lodash-es/isString";
import { EventsMigrationService } from "../../../services/migration/events-migration.service";

@Component({
    selector: "app-social-edit",
    template: `
      <app-page [pageTitle]="pageTitle()">
        @if (socialEvent?.groupEvent) {
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
                                 (ngModelChange)="onTitleChange($event)"
                                 [(ngModel)]="socialEvent.groupEvent.title" type="text"
                                 class="form-control input-sm"
                                 id="title"
                                 placeholder="Enter title for social event here"/>
                        </div>
                      </div>
                    </div>
                    @if (showUrl) {
                      <div class="row">
                        <div class="col-sm-12">
                          <div class="form-group">
                            <label for="url">Url</label>
                            <input [disabled]="!display.allow.edits"
                                   [(ngModel)]="socialEvent.groupEvent.url" type="text"
                                   class="form-control input-sm"
                                   id="url"/>
                          </div>
                        </div>
                      </div>
                    }
                    <div class="row align-items-center">
                      <div class="col-auto">
                        <div class="form-group">
                          <app-date-picker label="Social Event Date"
                                           size="md"
                                           (change)="startDateChanged($event)"
                                           [value]="socialEvent?.groupEvent?.start_date_time">
                          </app-date-picker>
                        </div>
                      </div>
                      <div class="col-auto">
                        <div class="form-group" app-time-picker id="start-time" label="Start Time"
                             [disabled]="!display.allow.edits"
                             [value]="socialEvent?.groupEvent?.start_date_time"
                             (change)="onStartDateTimeChange($event)">
                        </div>
                      </div>
                      <div class="col-auto">
                        <div class="form-group">
                          <app-date-picker label="End Date"
                                           size="md"
                                           (change)="endDateChanged($event)"
                                           [value]="socialEvent.groupEvent.end_date_time">
                          </app-date-picker>
                        </div>
                      </div>
                      <div class="col-auto">
                        <div class="form-group" app-time-picker id="end-time" label="End Time"
                             [disabled]="!display.allow.edits"
                             [value]="socialEvent.groupEvent.end_date_time"
                             (change)="onEndDateTimeChange($event)">
                        </div>
                      </div>
                      <div class="col">
                        <div class="form-group">
                          <label for="duration">Estimated Duration</label>
                          <input disabled
                                 [value]="durationCalculated()"
                                 type="text"
                                 class="form-control input-sm duration"
                                 id="duration">
                        </div>
                      </div>
                    </div>
                    <div class="row">
                      <div class="col-sm-8">
                        <div class="form-group">
                          <label for="location">Location</label>
                          <input [disabled]="!display.allow.edits"
                                 [(ngModel)]="socialEvent.groupEvent.location.description"
                                 type="text" class="form-control input-sm" id="location"
                                 placeholder="Enter Location here">
                        </div>
                      </div>
                      <div class="col-sm-4">
                        <div class="form-group">
                          <label for="post-code">Postcode</label>
                          <input [disabled]="!display.allow.edits"
                                 [(ngModel)]="socialEvent.groupEvent.location.postcode"
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
                                  <fa-icon [icon]="faEye" class="markdown-preview-icon"/>
                                  preview</a>
                              }
                              @if (longerDescriptionPreview) {
                                <a (click)="editLongerDescription()" [href]="">
                                  <fa-icon [icon]="faPencil" class="markdown-preview-icon"/>
                                  edit</a>
                              }
                            </label>
                            <div>
                              @if (longerDescriptionPreview) {
                                <p class="list-arrow"
                                   (click)="editLongerDescription()"
                                   markdown [data]="socialEvent.groupEvent.description"
                                   id="longer-description-preview"></p>
                              }
                            </div>
                            @if (!longerDescriptionPreview) {
                              <textarea
                                [disabled]="!display.allow.edits"
                                (blur)="previewLongerDescription()"
                                [(ngModel)]="socialEvent.groupEvent.description"
                                type="text"
                                class="form-control input-sm"
                                rows="{{socialEvent.groupEvent.media.length>0 ? 20 : 5}}"
                                id="longer-description"
                                placeholder="Enter description for social event here"></textarea>
                            }
                          </div>
                        </div>
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
                                  [(ngModel)]="socialEvent.fields.contactDetails.memberId">
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
                          <input [disabled]="!display.allow.edits"
                                 [(ngModel)]="socialEvent.fields.contactDetails.displayName"
                                 type="text" class="form-control input-sm"
                                 id="contact-display-name"/>
                        </div>
                        <div class="form-group">
                          <label for="contact-phone">Contact Phone</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.fields.contactDetails.phone"
                                 type="text" class="form-control input-sm" id="contact-phone"
                                 placeholder="Enter contact phone here"/>
                        </div>
                        <div class="form-group">
                          <label for="contact-email">Contact Email</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="socialEvent.fields.contactDetails.email"
                                 type="text" class="form-control input-sm" id="contact-email"
                                 placeholder="Enter contact email here"/>
                        </div>
                      </div>
                    </div>
                  </div>
                </tab>
                <tab app-edit-group-event-images disallowImageSourceSelection heading="Images"
                     [rootFolder]="RootFolder.socialEventsImages"
                     [extendedGroupEvent]="socialEvent"
                     [config]="config"/>
                @if (display.allow.edits) {
                  <tab heading="Attachment">
                    <div class="img-thumbnail thumbnail-admin-edit">
                      <div class="row">
                        <div class="col-md-12">
                          <input type="submit" [disabled]="inputDisabled()"
                                 value="Browse for attachment"
                                 (click)="browseToFile(fileElement)"
                                 class="btn btn-primary mb-10"/>
                          @if (socialEvent?.fields?.attachment) {
                            <input [disabled]="inputDisabled()" type="submit"
                                   class="btn btn-primary ml-2" value="Remove attachment" (click)="removeAttachment()"
                                   title="Remove attachment"/>
                          }
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
                            <div class="progress mt-2">
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
                                as: {{ socialEvent.fields.attachment.originalFileName }}</label>
                            </div>
                            <div class="form-group">
                              <label class="form-inline" for="attachment-title">Title</label>
                              @if (display.allow.edits) {
                                <input [(ngModel)]="socialEvent.fields.attachment.title"
                                       [disabled]="inputDisabled()"
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
                                     [disabled]="inputDisabled()"
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
                <label>
                  <app-copy-icon [icon]="faCopy" title [value]="display.socialEventLink(socialEvent, false)"
                                 [elementName]="'event link'">copy link to this
                  </app-copy-icon>
                  <a class="ml-1" [href]="display.socialEventLink(socialEvent, true)"
                     target="_blank">social event</a></label>
              </div>
            }
            <div class="col-sm-12">
              @if (display.allow.edits) {
                <input type="submit" value="Save" (click)="saveSocialEventDetails()"
                       title="Save this social event" class="btn btn-primary"/>
              }
              @if (display.allow.edits) {
                <input type="submit" value="Send Notification"
                       [disabled]="inputDisabled()" (click)="sendSocialEventNotification()"
                       title="Send social event notification"
                       class="btn btn-primary ml-2"/>
              }
              @if (display.allow.delete && display.confirm.noneOutstanding()) {
                <input type="submit" value="Delete" (click)="deleteSocialEventDetails()"
                       [disabled]="inputDisabled()"
                       title="Delete this social event" class="btn btn-primary ml-2"/>
              }
              @if (display.confirm.deleteConfirmOutstanding()) {
                <input type="submit" value="Confirm Deletion"
                       [disabled]="inputDisabled()"
                       (click)="confirmDeleteSocialEventDetails()"
                       class="btn btn-primary ml-2"/>
              }
              @if (display.confirm.deleteConfirmOutstanding()) {
                <input type="submit" value="Cancel Deletion"
                       [disabled]="notifyTarget.busy"
                       (click)="cancelDeleteSocialEvent()"
                       class="btn btn-primary ml-2"/>
              }
              @if (display.allow.edits) {
                <input type="submit" value="Cancel" (click)="cancelSocialEventDetails()"
                       [disabled]="inputDisabled()"
                       title="Cancel and don't save social event" class="btn btn-primary ml-2"/>
              }
              @if (display.allow.copy) {
                <input type="submit" value="Copy" (click)="copyDetailsToNewSocialEvent()"
                       [disabled]="inputDisabled()"
                       title="Copy details to new social event" class="btn btn-primary ml-2"/>
              }
              @if (!display.allow.edits) {
                <input type="submit" value="Close" (click)="cancelSocialEventDetails()"
                       [disabled]="notifyTarget.busy"
                       title="Close this social event without saving" class="btn btn-primary ml-2"/>
              }
            </div>
          </div>
        }
      </app-page>
    `,
    styleUrls: ["social-edit.component.sass"],
  imports: [PageComponent, TabsetComponent, TabDirective, FormsModule, DatePicker, FontAwesomeModule, MarkdownComponent, TooltipDirective, NgSelectComponent, NgOptgroupTemplateDirective, NgClass, FileUploadModule, NgStyle, FullNameWithAliasPipe, CopyIconComponent, EditGroupEventImagesComponent, TimePicker]
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
  private walksAndEventsService = inject(WalksAndEventsService);
  protected eventsMigrationService = inject(EventsMigrationService);
  private urlService = inject(UrlService);
  protected dateUtils = inject(DateUtilsService);
  private eventDefaultsService = inject(EventDefaultsService);
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  public socialEvent: ExtendedGroupEvent;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  public hasFileOver = false;
  private existingTitle: string;
  public uploader: FileUploader;
  public longerDescriptionPreview = true;
  public selectedMemberIds: string[] = [];
  faCopy = faCopy;
  faEye = faEye;
  faPencil = faPencil;
  editActive: boolean;
  private subscriptions: Subscription[] = [];
  protected readonly RootFolder = RootFolder;
  protected config: SystemConfig;
  protected showUrl = false;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe((config: SystemConfig) => this.config = config));
    if (this.urlService.pathContainsEventIdOrSlug()) {
      this.notify.setBusy();
      const socialEventId = this.urlService.segmentWithMongoId();
      this.logger.debug("finding socialEvent from socialEventId:", socialEventId);
      this.walksAndEventsService.queryById(socialEventId).then(data => {
        this.socialEvent = data;
        if (this.config?.enableMigration?.events) {
          this.eventsMigrationService.migrateOneSocialEvent(data.fields.migratedFromId);
        }
        if (!this.socialEvent.fields.attendees) {
          this.socialEvent.fields.attendees = [];
        }
        this.existingTitle = this.socialEvent?.fields?.attachment?.title;
        this.notify.hide();
        this.selectedMemberIds = this.socialEvent.fields.attendees.map(attendee => attendee.id);
      });
    } else if (this.display.inNewEventMode()) {
      this.eventDefaultsService.events().subscribe(ready => {
        this.socialEvent = this.eventDefaultsService.createDefault({
        item_type: RamblersEventType.GROUP_EVENT,
        shape: null
        });
        this.logger.info("ngOnInit:created new socialEvent:", this.socialEvent);
      })
    } else {
      this.notify.error({title: "Cannot edit social event", message: "path does not contain social event id"});
    }
    this.uploader = this.fileUploadService.createUploaderFor("socialEvents");
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
      const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
      this.socialEvent.fields.attachment = awsFileUploadResponseData.fileNameData;
      this.socialEvent.fields.attachment.title = this.existingTitle;
          this.logger.debug("JSON response:", awsFileUploadResponseData, "socialEvent:", this.socialEvent);
          this.notify.clearBusy();
      this.notify.success({title: "New file added", message: this.socialEvent.fields.attachment.title});
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
    this.socialEvent.fields.attendees = this.selectedMemberIds.map(item => this.memberService.toIdentifiable(item));
    this.logger.debug("attendees: ", this.socialEvent.fields.attendees);
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

  durationCalculated() {
    return this.dateUtils.formatDuration(this.dateUtils.asDateValue(this.socialEvent.groupEvent.start_date_time)?.value, this.dateUtils.asDateValue(this.socialEvent.groupEvent.end_date_time)?.value);
  }

  saveSocialEvent() {
    this.notify.setBusy();
    this.logger.debug("saveSocialEvent ->", this.socialEvent);
    return this.walksAndEventsService.createOrUpdate(this.socialEvent)
      .then(() => this.close())
      .then(() => this.notify.clearBusy())
      .catch((error) => this.handleError(error));
  }

  deleteSocialEventDetails() {
    this.display.confirm.toggleOnDeleteConfirm();
  }

  cancelDeleteSocialEvent() {
    this.display.confirm.clear();
  }
  confirmDeleteSocialEventDetails() {
    Promise.resolve(this.notify.progress("Deleting social event", true))
      .then(() => this.removeSocialEventAndRefreshSocialEvents())
      .then(() => this.notify.clearBusy())
      .catch((error) => this.notify.error(error));
  }

  removeSocialEventAndRefreshSocialEvents() {
    this.walksAndEventsService.delete(this.socialEvent).then(() => this.close());
  }

  selectMemberContactDetails(memberId: string) {
    const socialEvent = this.socialEvent;
    if (memberId === null) {
      socialEvent.fields.contactDetails = this.eventDefaultsService.defaultContactDetails();
    } else {
      this.logger.debug("looking for member id", memberId, "in memberFilterSelections", this.display.memberFilterSelections);
      const selectedMember = this.display.memberFilterSelections.find(member => member.id === memberId).member;
      socialEvent.fields.contactDetails.displayName = selectedMember.displayName;
      socialEvent.fields.contactDetails.phone = selectedMember.mobileNumber;
      socialEvent.fields.contactDetails.email = selectedMember.email;
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

  handleError(errorResponse) {
    this.notify.error({
      title: "Your changes could not be saved",
      message: (errorResponse && errorResponse.error ? (". Error was: " + JSON.stringify(errorResponse.error)) : "")
    });
    this.notify.clearBusy();
  }

  onStartDateTimeChange(startTime: string) {
    if (isString(startTime)) {
      this.logger.info("onStartDateTimeChange:updated start_date_time from:", this.socialEvent.groupEvent.start_date_time, "to:", startTime, "of type", typeof startTime);
      this.socialEvent.groupEvent.start_date_time = startTime;
    } else {
      this.logger.warn("onStartDateTimeChange:invalid input received:", startTime, "of type", typeof startTime);
    }
  }

  onEndDateTimeChange(endTime: string) {
    if (isString(endTime)) {
      this.socialEvent.groupEvent.end_date_time = endTime;
      this.logger.info("onEndDateTimeChange:updated end_date_time to", endTime);
    } else {
      this.logger.warn("onEndDateTimeChange:invalid input received:", endTime, "of type", typeof endTime);
    }
  }

  startDateChanged(dateValue: DateValue) {
    if (dateValue) {
      this.logger.debug("eventDateChanged", dateValue);
      this.socialEvent.groupEvent.start_date_time = this.dateUtils.isoDateTimeString(dateValue);
    }
  }

  endDateChanged(dateValue: DateValue) {
    if (dateValue) {
      this.logger.debug("eventDateChanged", dateValue);
      this.socialEvent.groupEvent.end_date_time = this.dateUtils.isoDateTimeString(dateValue);
    }
  }

  browseToFile(fileElement: HTMLInputElement) {
    this.existingTitle = this.socialEvent?.fields?.attachment?.title;
    fileElement.click();
  }

  removeAttachment() {
    this.socialEvent.fields.attachment = {};
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

  copyDetailsToNewSocialEvent() {
    const copiedSocialEvent = cloneDeep(this.socialEvent);
    delete copiedSocialEvent.id;
    copiedSocialEvent.fields.notifications = [];
    copiedSocialEvent.fields.attendees = [];
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
    return this.socialEvent && this.socialEvent.fields.attendees.length + (this.socialEvent.fields.attendees.length === 1 ? " member is attending" : " members are attending"
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

  inputDisabled() {
    return this.notifyTarget.busy || this.display.confirm.deleteConfirmOutstanding();
  }

  async onTitleChange(title: string) {
    const url = await this.walksAndEventsService.urlFromTitle(title, this.socialEvent.id);
    this.logger.info("onTitleChange:updating socialEvent groupEvent url based on title:", title, "from:", this.socialEvent.groupEvent.url, "to:", url);
    this.socialEvent.groupEvent.url = url;
  }
}
