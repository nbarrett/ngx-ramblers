import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import isArray from "lodash-es/isArray";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { AwsFileData } from "../../../models/aws-object.model";
import { GroupEvent, GroupEventType } from "../../../models/committee.model";
import {
  ContentMetadata,
  ContentMetadataItem,
  DuplicateImages,
  ImageTag
} from "../../../models/content-metadata.model";
import { DateValue } from "../../../models/date.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { ImageDuplicatesService } from "../../../services/image-duplicates-service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { faAdd, faAngleDown, faAngleUp, faBook, faImage, faPencil, faRemove } from "@fortawesome/free-solid-svg-icons";
import isEmpty from "lodash-es/isEmpty";
import { BroadcastService } from "../../../services/broadcast-service";
import { KeyValue } from "../../../services/enums";
import { ImageMessage } from "../../../models/images.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-image-edit",
  templateUrl: "./image-edit.html"
})
export class ImageEditComponent implements OnInit {

  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public imageDuplicatesService: ImageDuplicatesService = inject(ImageDuplicatesService);
  public broadcastService: BroadcastService<KeyValue<boolean>> = inject(BroadcastService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private notifierService: NotifierService = inject(NotifierService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  private urlService: UrlService = inject(UrlService);
  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("ImageEditComponent", NgxLoggerLevel.OFF);
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  @Input("duplicateImages") set acceptDuplicateImagesFrom(duplicateImages: DuplicateImages) {
    this.duplicateImages = duplicateImages;
  }

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

  @Input("noImageSave") set noImageSaveValue(noImageSave: boolean) {
    this.noImageSave = coerceBooleanProperty(noImageSave);
  }

  @Output() imagedSavedOrReverted: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageChange: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() moveUp: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() moveDown: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() delete: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageInsert: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageEdit: EventEmitter<ContentMetadataItem> = new EventEmitter();

  private noImageSave: boolean;
  public duplicateImages: DuplicateImages;
  public groupEventType: GroupEventType;
  public contentMetadataImageTags: ImageTag[];
  public groupEvents: GroupEvent[] = [];
  public item: ContentMetadataItem;
  public index: number;
  public filteredFiles: ContentMetadataItem[];
  public canMoveUp = true;
  public canMoveDown = true;
  public imageLoadText: string;
  public contentMetadata: ContentMetadata;
  public editActive: boolean;
  private awsFileData: AwsFileData;
  protected readonly faImage = faImage;
  protected readonly faRemove = faRemove;
  protected readonly faAdd = faAdd;
  protected readonly faAngleUp = faAngleUp;
  protected readonly faPencil = faPencil;
  protected readonly faAngleDown = faAngleDown;
  protected readonly faBook = faBook;

  ngOnInit() {
    this.editActive = false;
    this.logger.info("ngOnInit:item", this.item, "index:", this.index, "this.aspectRatio:", this.contentMetadata?.aspectRatio, "editActive:", this.editActive);
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
    if (this.imageDuplicatesService.duplicatedContentMetadataItems(item, this.duplicateImages).length > 0) {
      this.notify.error({
        title: this.imageDuplicatesService.duplicateCount(item, this.duplicateImages),
        message: this.imageDuplicatesService.duplicates(item, this.duplicateImages, this.filteredFiles)
      });
    }
  }

  imageChanged(awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData, "before item base64Content change:", this.item);
    this.awsFileData = awsFileData;
    if (awsFileData) {
      this.imageLoadText = null;
      this.item.base64Content = awsFileData.image;
      this.logger.info("imageChanged after item base64Content change:", this.item);
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

  imageEditQuit() {
    this.editActive = false;
    this.awsFileData = null;
    if (this.item.base64Content && this.item.image) {
      delete this.item.base64Content;
    }
    this.imagedSavedOrReverted.next(this.item);
  }

  imagedSaved(awsFileData: AwsFileData) {
    if (this.noImageSave) {
      this.imagedSavedOrReverted.next(this.item);
      this.editActive = false;
    } else {
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
      this.imageEditQuit();
    }
  }

  imageSourceOrPreview(): string {
    const qualifiedFileNameWithRoot = this.urlService.qualifiedFileNameWithRoot(this.contentMetadata?.rootFolder, this.contentMetadata?.name, this.item);
    return this.urlService.imageSource(qualifiedFileNameWithRoot);
  }

  editImage() {
    this.editActive = true;
    this.imageEdit.emit(this.item);
  }

  imageError(item: ContentMetadataItem, event: ErrorEvent) {
    if (item.image) {
      this.logger.error("imageError:", event, "item:", item);
      this.imageLoadText = ImageMessage.IMAGE_LOAD_ERROR;
    } else {
      this.logger.info("imageError:", event, "item:", item);
      this.imageLoadText = ImageMessage.NO_IMAGE_SPECIFIED;
    }
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

  imageUnsaved(item: ContentMetadataItem) {
    return item.base64Content ? "(unsaved changes)" : "";
  }
}
