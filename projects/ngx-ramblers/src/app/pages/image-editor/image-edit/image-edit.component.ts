import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { NgSelectComponent } from "@ng-select/ng-select";
import isArray from "lodash-es/isArray";
import map from "lodash-es/map";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { AwsFileData } from "../../../models/aws-object.model";
import {
  GroupEvent,
  GroupEventsFilter,
  GroupEventType,
  groupEventTypeFor,
  GroupEventTypes
} from "../../../models/committee.model";
import { ContentMetadataItem, IMAGES_HOME, ImageTag } from "../../../models/content-metadata.model";
import { DateValue } from "../../../models/date.model";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { ImageDuplicatesService } from "../../../services/image-duplicates-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { ImageMessage } from "../../../models/images.model";
import { faImage } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-edit-image",
  templateUrl: "./image-edit.component.html"
})
export class ImageEditComponent implements OnInit {

  @Input("index") set acceptChangesFromIndex(index: number) {
    this.index = index;
  }

  @Input("item") set acceptChangesFromItem(item: ContentMetadataItem) {
    this.item = item;
    this.checkDuplicates(item);
  }

  @Input("filteredFiles") set acceptChangesFrom(filteredFiles: ContentMetadataItem[]) {
    this.filteredFiles = filteredFiles;
  }

  constructor(public stringUtils: StringUtilsService,
              public imageDuplicatesService: ImageDuplicatesService,
              private committeeQueryService: CommitteeQueryService,
              public contentMetadataService: ContentMetadataService,
              private authService: AuthService,
              private notifierService: NotifierService,
              private fileUploadService: FileUploadService,
              private route: ActivatedRoute,
              private memberLoginService: MemberLoginService,
              public dateUtils: DateUtilsService,
              private routerHistoryService: RouterHistoryService,
              private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ImageEditComponent, NgxLoggerLevel.OFF);
  }
  private logger: Logger;
  public groupEvents: GroupEvent[] = [];
  public item: ContentMetadataItem;
  public index: number;
  public filteredFiles: ContentMetadataItem[];
  public canMoveUp = true;
  public canMoveDown = true;
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public imageLoadText: string;

  @Input() rootFolder: string;
  @Output() imagedSavedOrReverted: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageChange: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() moveUp: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() moveDown: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() delete: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageInsert: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageEdit: EventEmitter<ContentMetadataItem> = new EventEmitter();
  public editActive: boolean;
  private awsFileData: AwsFileData;
  public aspectRatio: string;
  public dateSources: GroupEventType[];

  protected readonly faImage = faImage;

  ngOnInit() {
    this.aspectRatio = this.rootFolder === IMAGES_HOME ? "Home page" : null;
    this.editActive = !this.item.image;
    this.logger.debug("ngOnInit:item", this.item, "index:", this.index, "this.aspectRatio:", this.aspectRatio, "editActive:", this.editActive);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.dateSources = [{
      area: "upload",
      eventType: "Upload Date",
      description: "Upload Date"
    }].concat(map(GroupEventTypes, (item) => item));
  }

  onImageDateChange(dateValue: DateValue) {
    if (dateValue) {
      this.logger.debug("date changed from:", this.dateUtils.displayDateAndTime(this.item.date), "to", this.dateUtils.displayDateAndTime(dateValue.date));
      this.item.date = dateValue.value;
      this.filterEventsBySourceAndDate(this.item.dateSource, this.item.date);
    }
  }

  tagsChange(stories: ImageTag[]) {
    this.logger.debug("tagChange:stories", stories);
    if (isArray(stories)) {
      this.item.tags = stories.map(story => story.key);
      this.logger.debug("imageMetaDataItem now:", this.item);
    } else {
      this.logger.debug("ignoring event", stories);
    }
    this.callImageChange();
  }

  callMoveUp() {
    this.moveUp.emit(this.item);
  }

  callImageChange() {
    this.imageChange.emit(this.item);
  }

  callMoveDown() {
    this.moveDown.emit(this.item);
  }

  callDelete() {
    this.delete.emit(this.item);
  }

  callInsert() {
    this.logger.debug("inserting image  with filteredFiles:", this.filteredFiles);
    const newItem: ContentMetadataItem = {date: this.dateUtils.momentNow().valueOf(), dateSource: "upload", tags: this.item?.tags || []};
    this.imageInsert.emit(newItem);
  }

  checkDuplicates(item: ContentMetadataItem) {
    if (this.imageDuplicatesService.duplicatedContentMetadataItems(item).length > 0) {
      this.notify.error({
        title: this.imageDuplicatesService.duplicateCount(item),
        message: this.imageDuplicatesService.duplicates(item)
      });
    }
  }

  filterEventsBySourceAndDate(dateSource: string, date: number) {
    this.logger.debug("eventsFilteredFrom:", dateSource, "date:", date);
    const groupEventsFilter: GroupEventsFilter = {
      selectAll: true,
      fromDate: this.dateUtils.asDateValue(this.dateUtils.asMoment(date).add(-520, "weeks").valueOf()),
      toDate: this.dateUtils.asDateValue(this.dateUtils.asMoment(date).add(2, "day")),
      includeContact: true,
      includeDescription: true,
      includeLocation: true,
      includeWalks: dateSource === GroupEventTypes.WALK.area,
      includeSocialEvents: dateSource === GroupEventTypes.SOCIAL.area,
      includeCommitteeEvents: dateSource === GroupEventTypes.COMMITTEE.area,
      sortBy: "-eventDate"
    };

    this.committeeQueryService.groupEvents(groupEventsFilter)
      .then(events => {
        this.groupEvents = events.map(event => ({
          ...event,
          description: this.dateUtils.displayDate(event.eventDate) + ", " + event.contactName + ", " + event.title
        }));
        this.logger.debug("groupEvents", events);
        return events;
      });
  }

  selectClick(select: NgSelectComponent) {
    this.logger.debug("select", select, "imageMetaDataItem:", this.item);
  }

  onChange() {
    const event = this.groupEvents.find(event => event.id === this.item.eventId);
    if (event) {
      this.item.date = event.eventDate;
      this.logger.debug("onChange:imageMetaDataItem.date", this.dateUtils.displayDate(this.item.date), "imageMetaDataItem:", this.item);
    } else {
      this.logger.debug("onChange:not event found from", this.item);
    }
    this.imageChange.emit(this.item);
  }

  refreshGroupEventsIfRequired() {
    const groupEventType = groupEventTypeFor(this.item.dateSource);
    if (groupEventType) {
      this.logger.debug("filterEventsBySourceAndDate as group event type is", groupEventType);
      this.filterEventsBySourceAndDate(this.item.dateSource, this.item.date);
    } else {
      this.logger.debug("not refreshing as group event type is", groupEventType);
    }
  }

  refreshGroupEvents() {
    this.filterEventsBySourceAndDate(this.item.dateSource, this.item.date);
  }

  imageChanged(awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData);
    this.awsFileData = awsFileData;
    this.callImageChange();
  }

  imageCroppingError(errorEvent: ErrorEvent) {
    this.logger.debug("errorEvent:", errorEvent);
    this.notify.error({
      title: "Image cropping error occurred",
      message: (errorEvent ? (". Error was: " + JSON.stringify(errorEvent)) : "")
    });
    this.notify.clearBusy();
  }

  exitImageEdit() {
    this.editActive = false;
    this.awsFileData = null;
    this.imagedSavedOrReverted.next(this.item);
  }

  imagedSaved(awsFileData: AwsFileData) {
    const thumbnail = awsFileData.awsFileName;
    this.logger.debug("imagedSaved:", awsFileData, "setting thumbnail to", thumbnail);
    this.item.image = thumbnail;
    this.imageLoadText = null;
    this.exitImageEdit();
  }

  imageSourceOrPreview(): string {
    return this.urlService.imageSource(this.awsFileData?.image || this.item.image);
  }

  editImage() {
    this.editActive = true;
    this.imageEdit.emit(this.item);
  }

  imageError(event: ErrorEvent) {
    this.logger.info("imageError:", event);
    this.imageLoadText = ImageMessage.IMAGE_LOAD_ERROR;
  }

  imageLoaded(event: Event) {
    this.logger.info("imageLoaded:", event);
    this.imageLoadText = null;
  }
}
