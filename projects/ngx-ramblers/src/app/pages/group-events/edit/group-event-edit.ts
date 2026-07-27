import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faCopy, faEye, faPencil } from "@fortawesome/free-solid-svg-icons";
import { cloneDeep, first, isNull, isString, values } from "es-toolkit/compat";
import { PathSegment } from "../../../models/content-text.model";
import { StoredValue } from "../../../models/ui-actions";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { ActivatedRoute, Router } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { AwsFileUploadResponseData } from "../../../models/aws-object.model";
import { DateValue } from "../../../models/date.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { UrlService } from "../../../services/url.service";
import { GroupEventDisplayService } from "../group-event-display.service";
import { PageComponent } from "../../../page/page.component";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { DatePicker } from "../../../date-and-time/date-picker";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MarkdownComponent } from "ngx-markdown";
import { NgClass, NgStyle } from "@angular/common";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { CopyIconComponent } from "../../../modules/common/copy-icon/copy-icon";
import { RootFolder, SystemConfig } from "../../../models/system.model";
import { ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { EventDefaultsService } from "../../../services/event-defaults.service";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { EditGroupEventImagesComponent } from "../../../common/walks-and-events/edit-group-event-images";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { TimePicker } from "../../../date-and-time/time-picker";
import { StringUtilsService } from "../../../services/string-utils.service";
import { Tag } from "../../../models/tag.model";
import { addTag } from "../../../functions/tags";
import { TagEditorComponent } from "../../tag/tag-editor.component";
import { convertTitleToSlug } from "../../../functions/strings";
import { Venue } from "../../walks/walk-venue/venue";
import { VenueLocationSource, VenueService } from "../../../services/venue/venue.service";
import { GroupEventDetailsSection, GroupEventEditTab } from "../../../models/group-events.model";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { enumValueForKey } from "../../../functions/enums";

@Component({
    selector: "app-group-event-edit",
    template: `
      <app-page [pageTitle]="pageTitle()">
        @if (groupEvent?.groupEvent) {
          <div class="row">
            <div class="col-sm-12">
              <tabset class="custom-tabset">
                <tab heading="{{GroupEventEditTab.EVENT_DETAILS}}"
                     [active]="tabActive(GroupEventEditTab.EVENT_DETAILS)"
                     (selectTab)="onTabSelect(GroupEventEditTab.EVENT_DETAILS)">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <app-section-toggle
                      [tabs]="detailsSections"
                      [(selectedTab)]="selectedDetailsSection"
                      [queryParamKey]="StoredValue.SUB_TAB"/>
                    @if (showDetailsSection(GroupEventDetailsSection.EVENT)) {
                    <div class="row thumbnail-heading-frame">
                      <div class="thumbnail-heading">Event</div>
                      <div class="col-sm-12">
                        <div class="row">
                          <div class="col-sm-7">
                            <div class="form-group">
                              <label for="title">Title</label>
                              <input [disabled]="!display.allow.edits"
                                     (change)="onTitleChange()"
                                     [(ngModel)]="groupEvent.groupEvent.title" type="text"
                                     class="form-control input-sm"
                                     id="title"
                                     placeholder="Enter event title"/>
                            </div>
                          </div>
                          <div class="col-sm-5">
                            <div class="form-group">
                              <label for="url">Url</label>
                              @if (groupEvent?.groupEvent?.url) {
                                <a [href]="display.groupEventLink(groupEvent, false)"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   class="form-control input-sm d-block text-truncate"
                                   id="url"
                                   [title]="display.groupEventLink(groupEvent, false)">
                                  {{ groupEvent.groupEvent.url }}
                                </a>
                              } @else {
                                <div class="form-control input-sm text-muted" id="url">
                                  Generated from the title when you leave the field or save
                                </div>
                              }
                            </div>
                          </div>
                        </div>
                        <div class="row align-items-center">
                          <div class="col-auto">
                            <div class="form-group">
                              <app-date-picker label="Event Date"
                                               size="md"
                                               (change)="startDateChanged($event)"
                                               [value]="groupEvent?.groupEvent?.start_date_time">
                              </app-date-picker>
                            </div>
                          </div>
                          <div class="col-auto">
                            <div class="form-group" app-time-picker id="start-time" label="Start Time"
                                 [disabled]="!display.allow.edits"
                                 [value]="groupEvent?.groupEvent?.start_date_time"
                                 (change)="onStartDateTimeChange($event)">
                            </div>
                          </div>
                          <div class="col-auto">
                            <div class="form-group">
                              <app-date-picker label="End Date"
                                               size="md"
                                               (change)="endDateChanged($event)"
                                               [value]="groupEvent?.groupEvent?.end_date_time">
                              </app-date-picker>
                            </div>
                          </div>
                          <div class="col-auto">
                            <div class="form-group" app-time-picker id="end-time" label="End Time"
                                 [disabled]="!display.allow.edits"
                                 [value]="groupEvent?.groupEvent?.end_date_time"
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
                        <div class="row align-items-center mt-2">
                          <div class="col-auto">
                            <div class="form-check mb-2">
                              <input [(ngModel)]="groupEvent.fields.bookingsEnabled"
                                     [disabled]="!display.allow.edits"
                                     type="checkbox"
                                     class="form-check-input"
                                     id="event-bookings-enabled">
                              <label class="form-check-label" for="event-bookings-enabled">Bookings enabled for this event</label>
                            </div>
                          </div>
                          <div class="col-auto">
                            <div class="form-group">
                              <label for="event-max-capacity">Max Capacity</label>
                              <input [(ngModel)]="groupEvent.fields.maxCapacity"
                                     [disabled]="!display.allow.edits"
                                     type="number" min="1"
                                     class="form-control input-sm"
                                     id="event-max-capacity"
                                     placeholder="e.g. 40">
                            </div>
                          </div>
                          <div class="col-auto">
                            <div class="form-group">
                              <label for="event-max-group-size">Max Per Booking</label>
                              <input [(ngModel)]="groupEvent.fields.maxGroupSize"
                                     [disabled]="!display.allow.edits"
                                     type="number" min="1" max="20"
                                     class="form-control input-sm"
                                     id="event-max-group-size"
                                     placeholder="default 3">
                            </div>
                          </div>
                          <div class="col-auto">
                            <div class="form-group">
                              <label for="event-member-priority-days">Member Priority (days before event)</label>
                              <input [(ngModel)]="groupEvent.fields.memberPriorityDays"
                                     [disabled]="!display.allow.edits"
                                     type="number" min="0" max="365"
                                     class="form-control input-sm"
                                     id="event-member-priority-days"
                                     placeholder="leave blank for no priority">
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    }
                    @if (showDetailsSection(GroupEventDetailsSection.VENUE)) {
                    <div class="row mt-3">
                      <div class="col-sm-12">
                        <app-venue
                          [event]="groupEvent"
                          [canEdit]="display.allow.edits"
                          [inputDisabled]="!display.allow.edits"
                          [showWalkLocationPrompts]="false"
                          [helpName]="'group-event-venue-help'"
                          [helpCategory]="'admin'"
                          [helpDescription]="'Event venue'"/>
                      </div>
                    </div>
                    }
                    @if (showDetailsSection(GroupEventDetailsSection.DESCRIPTION)) {
                    <div class="row thumbnail-heading-frame mt-3">
                      <div class="thumbnail-heading">Description</div>
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
                                   markdown [data]="groupEvent?.groupEvent?.description"
                                   id="longer-description-preview"></p>
                              }
                            </div>
                            @if (!longerDescriptionPreview) {
                              <textarea
                                [disabled]="!display.allow.edits"
                                (blur)="previewLongerDescription()"
                                [(ngModel)]="groupEvent.groupEvent.description"
                                type="text"
                                class="form-control input-sm"
                                rows="{{groupEvent?.groupEvent?.media?.length>0 ? 20 : 5}}"
                                id="longer-description"
                                placeholder="Enter event description"></textarea>
                            }
                          </div>
                        </div>
                        @if (config?.group) {
                          <div class="form-group">
                            <app-tag-editor [tagsForItem]="groupEvent.fields.tags || []"
                                            [availableTags]="config.group.eventTags || []"
                                            [text]="'event-' + (groupEvent.id || 'new')"
                                            label="Tags"
                                            [addTag]="addEventTag"
                                            (tagsChange)="onEventTagsChange($event)"/>
                          </div>
                        }
                      </div>
                    </div>
                    }
                  </div>
                </tab>
                <tab heading="{{GroupEventEditTab.ORGANISER}}"
                     [active]="tabActive(GroupEventEditTab.ORGANISER)"
                     (selectTab)="onTabSelect(GroupEventEditTab.ORGANISER)">
                  <div class="img-thumbnail thumbnail-admin-edit">
                    <div class="row">
                      <div class="col-sm-12">
                        <div class="form-group">
                          <label for="contact-member">Event Organiser</label>
                          <select [disabled]="!display.allow.edits" (ngModelChange)="selectMemberContactDetails($event)"
                                  class="form-control input-sm"
                                  [(ngModel)]="groupEvent.fields.contactDetails.memberId">
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
                                 [(ngModel)]="groupEvent.fields.contactDetails.displayName"
                                 type="text" class="form-control input-sm"
                                 id="contact-display-name"/>
                        </div>
                        <div class="form-group">
                          <label for="contact-phone">Contact Phone</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="groupEvent.fields.contactDetails.phone"
                                 type="text" class="form-control input-sm" id="contact-phone"
                                 placeholder="Enter contact phone here"/>
                        </div>
                        <div class="form-group">
                          <label for="contact-email">Contact Email</label>
                          <input [disabled]="!display.allow.edits" [(ngModel)]="groupEvent.fields.contactDetails.email"
                                 type="text" class="form-control input-sm" id="contact-email"
                                 placeholder="Enter contact email here"/>
                        </div>
                      </div>
                    </div>
                  </div>
                </tab>
                <tab app-edit-group-event-images [disallowImageSourceSelection]="true"
                     heading="{{GroupEventEditTab.IMAGES}}"
                     [active]="tabActive(GroupEventEditTab.IMAGES)"
                     (selectTab)="onTabSelect(GroupEventEditTab.IMAGES)"
                     [rootFolder]="RootFolder.socialEventsImages"
                     [extendedGroupEvent]="groupEvent"
                     [config]="config"/>
                @if (display.allow.edits) {
                  <tab heading="{{GroupEventEditTab.ATTACHMENT}}"
                       [active]="tabActive(GroupEventEditTab.ATTACHMENT)"
                       (selectTab)="onTabSelect(GroupEventEditTab.ATTACHMENT)">
                    <div class="img-thumbnail thumbnail-admin-edit">
                      <div class="row">
                        <div class="col-md-12">
                          <input type="submit" [disabled]="inputDisabled()"
                                 value="Browse for attachment"
                                 (click)="browseToFile(fileElement)"
                                 class="btn btn-primary mb-10"/>
                          @if (groupEvent?.fields?.attachment) {
                            <input [disabled]="inputDisabled()" type="submit"
                                   class="btn btn-primary ms-2" value="Remove attachment" (click)="removeAttachment()"
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
                        @if (display.attachmentExists(groupEvent)) {
                          <div class="col-md-12">
                            <div class="form-group">
                              <label class="mt-2">Originally uploaded
                                as: {{ groupEvent.fields.attachment.originalFileName }}</label>
                            </div>
                            <div class="form-group">
                              <label class="d-inline-flex align-items-center flex-wrap"
                                     for="attachment-title">Title</label>
                              @if (display.allow.edits) {
                                <input [(ngModel)]="groupEvent.fields.attachment.title"
                                       [disabled]="inputDisabled()"
                                       type="text"
                                       id="attachment-title"
                                       class="form-control input-md"
                                       placeholder="Enter a title for this attachment"/>
                              }
                            </div>
                            <div class="form-group">
                              <label class="d-inline-flex align-items-center flex-wrap" for="attachment">Display:
                                <a class="ms-2" target="_blank" [href]="display.attachmentUrl(groupEvent)"
                                   id="attachment">
                                  {{ display.attachmentTitle(groupEvent) }}</a>
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
            @if (display.groupEventLink(groupEvent, true)) {
              <div class="col-sm-12">
                <label>
                  <app-copy-icon [icon]="faCopy" title [value]="display.groupEventLink(groupEvent, false)"
                                 [elementName]="'event link'">copy link to this
                  </app-copy-icon>
                  <a class="ms-1" [href]="display.groupEventLink(groupEvent, true)"
                     target="_blank">event</a></label>
              </div>
            }
            <div class="col-sm-12">
              @if (display.allow.edits) {
                <input type="submit" value="Save" (click)="saveGroupEventDetails()"
                       title="Save this event" class="btn btn-primary"/>
              }
              @if (display.allow.edits) {
                <input type="submit" value="Send Notification"
                       [disabled]="inputDisabled()" (click)="sendGroupEventNotification()"
                       title="Send event notification"
                       class="btn btn-primary ms-2"/>
              }
              @if (display.allow.delete && display.confirm.noneOutstanding()) {
                <input type="submit" value="Delete" (click)="deleteGroupEventDetails()"
                       [disabled]="inputDisabled()"
                       title="Delete this event" class="btn btn-primary ms-2"/>
              }
              @if (display.confirm.deleteConfirmOutstanding()) {
                <input type="submit" value="Confirm Deletion"
                       [disabled]="inputDisabled()"
                       (click)="confirmDeleteGroupEventDetails()"
                       class="btn btn-primary ms-2"/>
              }
              @if (display.confirm.deleteConfirmOutstanding()) {
                <input type="submit" value="Cancel Deletion"
                       [disabled]="notifyTarget.busy"
                       (click)="cancelDeleteGroupEvent()"
                       class="btn btn-primary ms-2"/>
              }
              @if (display.allow.edits) {
                <input type="submit" value="Cancel" (click)="cancelGroupEventDetails()"
                       [disabled]="inputDisabled()"
                       title="Cancel and don't save" class="btn btn-primary ms-2"/>
              }
              @if (display.allow.copy) {
                <input type="submit" value="Copy" (click)="copyDetailsToNewGroupEvent()"
                       [disabled]="inputDisabled()"
                       title="Copy details to new event" class="btn btn-primary ms-2"/>
              }
              @if (!display.allow.edits) {
                <input type="submit" value="Close" (click)="cancelGroupEventDetails()"
                       [disabled]="notifyTarget.busy"
                       title="Close without saving" class="btn btn-primary ms-2"/>
              }
            </div>
          </div>
        }
      </app-page>
    `,
    styleUrls: ["group-event-edit.sass"],
  imports: [PageComponent, TabsetComponent, TabDirective, FormsModule, DatePicker, FontAwesomeModule, MarkdownComponent, NgClass, FileUploadModule, NgStyle, FullNameWithAliasPipe, CopyIconComponent, EditGroupEventImagesComponent, TimePicker, TagEditorComponent, Venue, SectionToggle]
})
export class GroupEventEdit implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("GroupEventEdit", NgxLoggerLevel.ERROR);
  private fileUploadService = inject(FileUploadService);
  display = inject(GroupEventDisplayService);
  private notifierService = inject(NotifierService);
  private memberService = inject(MemberService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  googleMapsService = inject(GoogleMapsService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private urlService = inject(UrlService);
  protected dateUtils = inject(DateUtilsService);
  private eventDefaultsService = inject(EventDefaultsService);
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  protected stringUtils: StringUtilsService = inject(StringUtilsService);
  private venueService = inject(VenueService);
  public groupEvent: ExtendedGroupEvent;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  public hasFileOver = false;
  private existingTitle: string;
  public uploader: FileUploader;
  public longerDescriptionPreview = true;
  faCopy = faCopy;
  faEye = faEye;
  faPencil = faPencil;
  editActive: boolean;
  private subscriptions: Subscription[] = [];
  protected readonly RootFolder = RootFolder;
  protected readonly StoredValue = StoredValue;
  protected readonly GroupEventEditTab = GroupEventEditTab;
  protected readonly GroupEventDetailsSection = GroupEventDetailsSection;
  protected config: SystemConfig;
  private endDateManuallySet = false;
  public currentTab: GroupEventEditTab = GroupEventEditTab.EVENT_DETAILS;
  public detailsSections: GroupEventDetailsSection[] = [
    GroupEventDetailsSection.ALL,
    GroupEventDetailsSection.EVENT,
    GroupEventDetailsSection.VENUE,
    GroupEventDetailsSection.DESCRIPTION
  ];
  public selectedDetailsSection: GroupEventDetailsSection = GroupEventDetailsSection.ALL;

  addEventTag = (subject: string): Tag => {
    if (!this.config.group.eventTags) {
      this.config.group.eventTags = [];
    }
    const newTag = addTag(this.config.group.eventTags, subject, (key, subject) => ({key, subject}));
    this.systemConfigService.saveConfig(this.config);
    return newTag;
  };

  onEventTagsChange(tags: Tag[]) {
    this.groupEvent.fields.tags = tags.map(tag => tag.key);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      const defaultValue = this.stringUtils.kebabCase(GroupEventEditTab.EVENT_DETAILS);
      const tabParameter = params[StoredValue.TAB];
      this.selectTab(tabParameter || defaultValue);
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe((config: SystemConfig) => this.config = config));
    if (this.urlService.pathContainsEventIdOrSlug()) {
      this.notify.setBusy();
      const groupEventId = this.urlService.eventIdentifier();
      this.logger.info("finding groupEvent from groupEventId:", groupEventId);
      this.walksAndEventsService.queryById(groupEventId).then(async data => {
        this.groupEvent = data;
        if (this.groupEvent) {
          if (!this?.groupEvent?.fields?.attendees) {
            this.groupEvent.fields.attendees = [];
          }
          if (!this?.groupEvent?.fields?.contactDetails) {
            this.groupEvent.fields.contactDetails = this.eventDefaultsService.defaultContactDetails();
          }
          this.venueService.ensureVenue(this.groupEvent, {source: VenueLocationSource.LOCATION, defaultVenuePublish: true});
          this.existingTitle = this.groupEvent?.fields?.attachment?.title;
          this.notify.hide();
        } else {
          this.logger.info("No event found given groupEventId:", groupEventId);
        }
      });
    } else if (this.display.inNewEventMode()) {
      this.eventDefaultsService.events().subscribe(ready => {
        this.groupEvent = this.eventDefaultsService.createDefault({
          fields: {
            inputSource: InputSource.MANUALLY_CREATED
          },
          groupEvent: {
            item_type: RamblersEventType.GROUP_EVENT,
            shape: null
          }
        });
        this.venueService.ensureVenue(this.groupEvent, {source: VenueLocationSource.LOCATION, defaultVenuePublish: true});
        this.logger.info("ngOnInit:created new groupEvent:", this.groupEvent);
      });
    } else {
      this.notify.error({title: "Cannot edit event", message: "path does not contain event id"});
    }
    this.uploader = this.fileUploadService.createUploaderFor("socialEvents");
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
      const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
      this.groupEvent.fields.attachment = awsFileUploadResponseData.fileNameData;
      this.groupEvent.fields.attachment.title = this.existingTitle;
          this.logger.debug("JSON response:", awsFileUploadResponseData, "groupEvent:", this.groupEvent);
          this.notify.clearBusy();
      this.notify.success({title: "New file added", message: this.groupEvent.fields.attachment.title});
      }
    ));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  pageTitle(): string {
    const eventType = this.stringUtils.asTitle(this.groupEvent?.groupEvent?.item_type || RamblersEventType.GROUP_EVENT);
    return this.urlService.lastPathSegment() === PathSegment.NEW ? `Create New ${eventType}` : `${eventType} Edit`;
  }

  onTabSelect(tab: GroupEventEditTab): void {
    this.selectTab(tab);
  }

  public selectTab(tab: string | GroupEventEditTab) {
    const tabValue = enumValueForKey(GroupEventEditTab, tab as string)
      ? tab as GroupEventEditTab
      : this.findTabByKebabCase(String(tab));
    const newTabKebab = this.stringUtils.kebabCase(tabValue);
    const currentTabKebab = this.stringUtils.kebabCase(this.currentTab);
    const queryParams: Record<string, string> = {[StoredValue.TAB]: newTabKebab};
    if (tabValue === GroupEventEditTab.EVENT_DETAILS && !this.route.snapshot.queryParams[StoredValue.SUB_TAB]) {
      queryParams[StoredValue.SUB_TAB] = this.stringUtils.kebabCase(GroupEventDetailsSection.ALL);
      this.selectedDetailsSection = GroupEventDetailsSection.ALL;
    }
    if (currentTabKebab === newTabKebab
      && this.route.snapshot.queryParams[StoredValue.TAB] === newTabKebab
      && (tabValue !== GroupEventEditTab.EVENT_DETAILS || this.route.snapshot.queryParams[StoredValue.SUB_TAB])) {
      return;
    }
    this.currentTab = tabValue;
    this.router.navigate([], {
      queryParams,
      queryParamsHandling: "merge",
      fragment: this.route.snapshot.fragment
    });
  }

  tabActive(tab: GroupEventEditTab): boolean {
    return this.stringUtils.kebabCase(this.currentTab) === this.stringUtils.kebabCase(tab);
  }

  showDetailsSection(section: GroupEventDetailsSection): boolean {
    return this.selectedDetailsSection === GroupEventDetailsSection.ALL
      || this.selectedDetailsSection === section;
  }

  private findTabByKebabCase(kebabValue: string): GroupEventEditTab {
    const found = values(GroupEventEditTab).find(
      tab => this.stringUtils.kebabCase(tab) === kebabValue
    );
    return found || GroupEventEditTab.EVENT_DETAILS;
  }

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  fileDropped($event: File[]) {
    this.logger.debug("fileDropped:", $event);
  }

  durationCalculated() {
    return this.dateUtils.formatDuration(this.dateUtils.asDateValue(this.groupEvent?.groupEvent?.start_date_time)?.value, this.dateUtils.asDateValue(this.groupEvent?.groupEvent?.end_date_time)?.value);
  }

  async saveGroupEvent() {
    this.notify.setBusy();
    this.logger.debug("saveGroupEvent ->", this.groupEvent);
    try {
      await this.syncUrlFromTitle();
      this.venueService.syncGroupEventLocationFromVenue(this.groupEvent);
      await this.venueService.persistToCollection(this.groupEvent?.fields?.venue);
      const saved = await this.walksAndEventsService.createOrUpdate(this.groupEvent);
      if (saved) {
        this.groupEvent = saved;
        this.venueService.ensureVenue(this.groupEvent, {source: VenueLocationSource.LOCATION, defaultVenuePublish: true});
      }
      this.navigateToEventView();
      this.notify.clearBusy();
    } catch (error) {
      this.handleError(error);
    }
  }

  deleteGroupEventDetails() {
    this.display.confirm.toggleOnDeleteConfirm();
  }

  cancelDeleteGroupEvent() {
    this.display.confirm.clear();
  }
  confirmDeleteGroupEventDetails() {
    Promise.resolve(this.notify.progress("Deleting event", true))
      .then(() => this.removeGroupEventAndRefreshGroupEvents())
      .then(() => this.notify.clearBusy())
      .catch((error) => this.notify.error(error));
  }

  removeGroupEventAndRefreshGroupEvents() {
    this.walksAndEventsService.delete(this.groupEvent).then(() => this.close());
  }

  selectMemberContactDetails(memberId: string) {
    const groupEvent = this.groupEvent;
    if (isNull(memberId)) {
      groupEvent.fields.contactDetails = this.eventDefaultsService.defaultContactDetails();
    } else {
      this.logger.debug("looking for member id", memberId, "in memberFilterSelections", this.display.memberFilterSelections);
      const selectedMember = this.display.memberFilterSelections.find(member => member.id === memberId).member;
      groupEvent.fields.contactDetails.displayName = selectedMember.displayName;
      groupEvent.fields.contactDetails.phone = selectedMember.mobileNumber;
      groupEvent.fields.contactDetails.email = selectedMember.email;
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

  saveGroupEventDetails() {
    Promise.resolve(this.notify.progress({title: "Save in progress", message: "Saving event"}, true))
      .then(() => this.saveGroupEvent())
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
      this.logger.info("onStartDateTimeChange:updated start_date_time from:", this.groupEvent?.groupEvent?.start_date_time, "to:", startTime, "of type", typeof startTime);
      this.groupEvent.groupEvent.start_date_time = startTime;
    } else {
      this.logger.warn("onStartDateTimeChange:invalid input received:", startTime, "of type", typeof startTime);
    }
  }

  onEndDateTimeChange(endTime: string) {
    if (isString(endTime)) {
      this.groupEvent.groupEvent.end_date_time = endTime;
      this.logger.info("onEndDateTimeChange:updated end_date_time to", endTime);
    } else {
      this.logger.warn("onEndDateTimeChange:invalid input received:", endTime, "of type", typeof endTime);
    }
  }

  startDateChanged(dateValue: DateValue) {
    if (dateValue) {
      this.logger.info("startDateChanged:", dateValue);
      const startDateTime = this.dateUtils.asDateTime(dateValue);
      this.groupEvent.groupEvent.start_date_time = startDateTime.toISO({suppressMilliseconds: true});
      if (!this.endDateManuallySet) {
        const currentEndDateTime = this.dateUtils.asDateTime(this.groupEvent.groupEvent.end_date_time);
        const newEndDateTime = startDateTime.set({
          hour: currentEndDateTime.hour,
          minute: currentEndDateTime.minute
        });
        const minimumEndDateTime = startDateTime.plus({hours: 1});
        const finalEndDateTime = newEndDateTime < minimumEndDateTime ? minimumEndDateTime : newEndDateTime;
        this.groupEvent.groupEvent.end_date_time = finalEndDateTime.toISO({suppressMilliseconds: true});
        this.logger.info("startDateChanged:synced end date to", this.groupEvent.groupEvent.end_date_time);
      }
    }
  }

  endDateChanged(dateValue: DateValue) {
    if (dateValue) {
      this.logger.info("endDateChanged:", dateValue);
      this.endDateManuallySet = true;
      this.groupEvent.groupEvent.end_date_time = this.dateUtils.isoDateTime(dateValue);
    }
  }

  browseToFile(fileElement: HTMLInputElement) {
    this.existingTitle = this.groupEvent?.fields?.attachment?.title;
    fileElement.click();
  }

  removeAttachment() {
    this.groupEvent.fields.attachment = {};
  }

  onFileSelect($file: File[]) {
    this.notify.setBusy();
    this.notify.progress({title: "Attachment upload", message: `uploading ${first($file).name} - please wait...`});
  }

  close() {
    this.display.confirm.clear();
    const segments = this.urlService.pathSegments();
    const lastSegment = segments[segments.length - 1];
    const viewPath = lastSegment === PathSegment.EDIT ? segments.slice(0, -1).join("/") : this.urlService.area();
    this.logger.info("close:viewPath:", viewPath);
    this.urlService.navigateTo([viewPath]);
  }

  navigateToEventView() {
    this.display.confirm.clear();
    const link = this.display.groupEventLink(this.groupEvent, true);
    if (link) {
      this.logger.info("navigateToEventView:link:", link);
      this.urlService.navigateTo([link]);
    } else {
      this.close();
    }
  }

  copyDetailsToNewGroupEvent() {
    const copiedGroupEvent = cloneDeep(this.groupEvent);
    delete copiedGroupEvent.id;
    copiedGroupEvent.fields.notifications = [];
    copiedGroupEvent.fields.attendees = [];
    this.groupEvent = copiedGroupEvent;
    this.display.confirm.clear();
    const existingRecordEditEnabled = this.display.allow.edits && "Copy Existing".startsWith("Edit");
    this.display.allow.copy = existingRecordEditEnabled;
    this.display.allow.delete = existingRecordEditEnabled;
    this.notify.success({
      title: "Existing event copied!",
      message: "Make changes here and save to create a new event."
    });
  }

  cancelGroupEventDetails() {
    this.close();
  }

  sendGroupEventNotification() {
    const segments = this.urlService.pathSegments();
    const lastSegment = segments[segments.length - 1];
    const viewSegments = lastSegment === PathSegment.EDIT ? segments.slice(0, -1) : segments;
    void this.urlService.navigateTo([...viewSegments, PathSegment.EMAIL_COMPOSER], { [StoredValue.EVENT]: this.groupEvent?.id });
  }

  inputDisabled() {
    return this.notifyTarget.busy || this.display.confirm.deleteConfirmOutstanding();
  }

  async onTitleChange() {
    await this.syncUrlFromTitle();
  }

  async syncUrlFromTitle() {
    const title = this.groupEvent?.groupEvent?.title?.trim();
    if (!title || !this.groupEvent?.groupEvent) {
      return;
    }
    const previousUrl = this.groupEvent.groupEvent.url;
    const baseSlug = convertTitleToSlug(title);
    this.groupEvent.groupEvent.url = baseSlug;
    const uniqueUrl = await this.walksAndEventsService.urlFor(this.groupEvent);
    if (uniqueUrl) {
      this.groupEvent.groupEvent.url = uniqueUrl;
    }
    this.logger.info("syncUrlFromTitle:updating groupEvent url based on title:", title, "from:", previousUrl, "to:", this.groupEvent.groupEvent.url);
  }
}
