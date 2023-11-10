import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import isArray from "lodash-es/isArray";
import map from "lodash-es/map";
import { NgxLoggerLevel } from "ngx-logger";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { AwsFileData } from "../../../models/aws-object.model";
import { GroupEvent, GroupEventType, GroupEventTypes } from "../../../models/committee.model";
import { ContentMetadata, ContentMetadataItem, ImageTag } from "../../../models/content-metadata.model";
import { DateValue } from "../../../models/date.model";
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
import { faAdd, faAngleDown, faAngleUp, faBook, faImage, faPencil, faRemove } from "@fortawesome/free-solid-svg-icons";
import isEmpty from "lodash-es/isEmpty";
import { BroadcastService } from "../../../services/broadcast-service";
import { KeyValue } from "../../../services/enums";

@Component({
  selector: "app-image-edit",
  templateUrl: "./image-edit.html"
})
export class ImageEditComponent implements OnInit {

  @Input("contentMetadataImageTags") set acceptImageTagChangesFrom(imageTags: ImageTag[]) {
    this.logger.info("imageTags change:", imageTags);
    this.contentMetadataImageTags = imageTags;
  }

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

  @Input("contentMetadata") set acceptContentMetadataChangesFrom(contentMetadata: ContentMetadata) {
    this.logger.info("contentMetadata change:", contentMetadata);
    this.contentMetadata = contentMetadata;
  }

  @Output() imagedSavedOrReverted: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageChange: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() moveUp: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() moveDown: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() delete: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageInsert: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageEdit: EventEmitter<ContentMetadataItem> = new EventEmitter();

  constructor(public stringUtils: StringUtilsService,
              public imageDuplicatesService: ImageDuplicatesService,
              public broadcastService: BroadcastService<KeyValue<boolean>>,
              public contentMetadataService: ContentMetadataService,
              private authService: AuthService,
              private notifierService: NotifierService,
              private fileUploadService: FileUploadService,
              private route: ActivatedRoute,
              private memberLoginService: MemberLoginService,
              public dateUtils: DateUtilsService,
              private routerHistoryService: RouterHistoryService,
              private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ImageEditComponent", NgxLoggerLevel.OFF);
  }

  public groupEventType: GroupEventType;
  public contentMetadataImageTags: ImageTag[];
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
  public contentMetadata: ContentMetadata;
  public editActive: boolean;
  private awsFileData: AwsFileData;
  public dateSources: GroupEventType[];
  protected readonly faImage = faImage;
  protected readonly faRemove = faRemove;
  protected readonly faAdd = faAdd;
  protected readonly faAngleUp = faAngleUp;
  protected readonly faPencil = faPencil;
  protected readonly faAngleDown = faAngleDown;
  protected readonly faBook = faBook;

  ngOnInit() {
    this.editActive = !this.item.image;
    this.logger.info("ngOnInit:item", this.item, "index:", this.index, "this.aspectRatio:", this.contentMetadata?.aspectRatio, "editActive:", this.editActive);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.dateSources = [{
      area: "upload",
      eventType: "Upload Date",
      description: "Upload Date"
    }].concat(map(GroupEventTypes, (item) => item));
  }

  dateChange(dateValue: DateValue) {
    if (dateValue) {
      this.logger.debug("date changed from:", this.dateUtils.displayDateAndTime(this.item.date), "to", this.dateUtils.displayDateAndTime(dateValue.date));
      this.item.date = dateValue.value;
    }
  }

  tagsChange(imageTags: ImageTag[]) {
    this.logger.debug("tagChange:imageTags", imageTags);
    if (isArray(imageTags)) {
      this.item.tags = imageTags.map(story => story.key);
      this.logger.debug("imageMetaDataItem now:", this.item);
    } else {
      this.logger.debug("ignoring event", imageTags);
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

  imageChanged(awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData);
    this.awsFileData = awsFileData;
    if (awsFileData) {
      this.imageLoadText = null;
    }
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
    const image = this.contentMetadataService.truncatePathFromName(awsFileData.awsFileName);
    this.logger.info("imagedSaved:", awsFileData, "extracting filename from:", awsFileData.awsFileName, "image:", image, "originalFileName:", awsFileData.file.name);
    this.item.image = image;
    if (isEmpty(this.item.originalFileName) && awsFileData.file.name) {
      this.item.originalFileName = this.contentMetadataService.truncatePathFromName(awsFileData.file.name);
    }
    if (isEmpty(this.item.text) && this.item.originalFileName) {
      this.item.text = this.item.originalFileName;
    }
    this.imageLoadText = null;
    this.exitImageEdit();
  }

  imageSourceOrPreview(): string {
    const qualifiedFileNameWithRoot = this.urlService.qualifiedFileNameWithRoot(this.contentMetadata?.rootFolder, this.contentMetadata?.name, this.item.image);
    this.logger.off("imageSourceOrPreview:qualifiedFileNameWithRoot", qualifiedFileNameWithRoot, "awsFileData?.image:", this.awsFileData?.image);
    return this.urlService.imageSource(this.awsFileData?.image || qualifiedFileNameWithRoot);
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

  eventTypeChange(groupEventType: GroupEventType) {
    this.groupEventType = groupEventType;
    this.item.dateSource = groupEventType.area;
  }

  eventChange(groupEvent: GroupEvent) {
    this.item.date = groupEvent.eventDate;
    this.item.text = groupEvent.title;
    this.item.eventId = groupEvent.id;
  }

  coverImageSet() {
    const currentlySet: boolean = this.item.image === this.contentMetadata.coverImage;
    if (currentlySet) {
      this.contentMetadata.coverImage = null;
    } else {
      this.contentMetadata.coverImage = this.item.image;
    }
  }
}
