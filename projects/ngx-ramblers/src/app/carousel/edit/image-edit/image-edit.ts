import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import isArray from "lodash-es/isArray";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { AwsFileData } from "../../../models/aws-object.model";
import { GroupEvent, GroupEventType, groupEventTypeFor, uploadGroupEventType } from "../../../models/committee.model";
import {
  ContentMetadata,
  ContentMetadataItem,
  DuplicateImages,
  ImageTag,
  S3Metadata
} from "../../../models/content-metadata.model";
import { DateValue } from "../../../models/date.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { ImageDuplicatesService } from "../../../services/image-duplicates-service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import {
  faAdd,
  faAngleDown,
  faAngleUp,
  faBook,
  faImage,
  faLink,
  faLinkSlash,
  faPencil,
  faRemove
} from "@fortawesome/free-solid-svg-icons";
import isEmpty from "lodash-es/isEmpty";
import { BroadcastService } from "../../../services/broadcast-service";
import { KeyValue } from "../../../functions/enums";
import { ImageMessage } from "../../../models/images.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { ImageCropperAndResizerComponent } from "../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { NgClass } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { BadgeButtonComponent } from "../../../modules/common/badge-button/badge-button";
import { FormsModule } from "@angular/forms";
import { GroupEventTypeSelectorComponent } from "../../../group-events-selector/group-event-type-selector";
import { DatePickerComponent } from "../../../date-picker/date-picker.component";
import { TagEditorComponent } from "../../../pages/tag/tag-editor.component";
import { GroupEventSelectorComponent } from "../../../group-events-selector/group-event-selector";

@Component({
    selector: "app-image-edit",
    template: `
      <div class="card mb-3">
        <div class="card-body">
          <div class="row">
            @if (editActive) {
              <div class="col-sm-12 mb-3">
                <app-image-cropper-and-resizer noImageSave
                                               [selectAspectRatio]="contentMetadata?.aspectRatio"
                                               [rootFolder]="contentMetadataService.rootFolderAndName(contentMetadata?.rootFolder, contentMetadata?.name)"
                                               [preloadImage]="imageSourceOrPreview()"
                                               (imageChange)="imageChanged($event)"
                                               (error)="imageCroppingError($event)"
                                               (cropError)="imageCroppingError($event)"
                                               (quit)="imageEditQuit()"
                                               (save)="imagedSaved($event)"/>
              </div>
            }
            <div class="col-sm-7">
              <div class="form-group">
                <div class="row mb-2">
                  <div class="col">Image {{ index + 1 }} of {{ filteredFiles?.length }}</div>
                  <div class="col text-right">
                    <div>Image Size {{ imageSize() }}</div>
                    @if (imagedIsCropped()) {
                      <div class="ml-2">Cropped Size {{ croppedSize() }}</div>
                    }
                  </div>
                </div>
                @if (!imageLoadText) {
                  <img (load)="imageLoaded($event)" (error)="imageError(item, $event)" loading="lazy"
                       [id]="'image-' + index" class="img-fluid w-100" [src]="imageSourceOrPreview()"
                       [alt]="item.text"/>
                }
                @if (imageLoadText) {
                  <div class="row no-image"
                       [ngClass]="{'small-icon-container': true}">
                    <div class="col align-self-center text-center">
                      <fa-icon [icon]="faImage" class="fa-icon fa-3x"/>
                      <div>{{ imageLoadText }}</div>
                    </div>
                  </div>
                }
              </div>
              <div class="row no-gutters">
                <div class="col pr-1">
                  <app-badge-button fullWidth [disabled]="editActive" [icon]="faRemove" caption="Delete"
                                    (click)="callDelete()"/>
                </div>
                <div class="col pr-1">
                  <app-badge-button fullWidth [disabled]="editActive" [icon]="faAdd" caption="Insert"
                                    (click)="callInsert()"/>
                </div>
                <div class="col">
                  <app-badge-button fullWidth [disabled]="editActive" [icon]="faPencil" caption="Edit image"
                                    (click)="editImage()"/>
                </div>
              </div>
              <div class="row no-gutters">
                <div class="col pr-1">
                  <app-badge-button fullWidth [disabled]="editActive|| !canMoveUp" [icon]="faAngleUp" caption="Move up"
                                    (click)="callMoveUp()"/>
                </div>
                <div class="col pr-1">
                  <app-badge-button fullWidth [disabled]="editActive|| !canMoveDown" [icon]="faAngleDown"
                                    caption="Move down"
                                    (click)="callMoveDown()"/>
                </div>
                <div class="col">
                  <app-badge-button fullWidth [disabled]="editActive" [icon]="faBook"
                                    [caption]="item.image && item.image===contentMetadata.coverImage? 'Clear Cover image':'Cover Image'"
                                    [active]="item.image && item.image===contentMetadata.coverImage"
                                    (click)="coverImageSet()"/>
                </div>
              </div>
              <div class="row no-gutters mb-2">
                <div class="col pr-1">
                  <app-badge-button fullWidth [disabled]="!canMoveUp" [icon]="faLink" caption="Image Data as Previous"
                                    (click)="imageDataAsPrevious()"/>
                </div>
                <div class="col pr-1">
                  <app-badge-button fullWidth [disabled]="editActive|| !canMoveDown" [icon]="faLink"
                                    caption="Image Data As Next"
                                    (click)="imageDataAsNext()"/>
                </div>
                <div class="col">
                  <app-badge-button fullWidth [disabled]="editActive" [icon]="faLinkSlash"
                                    caption="Clear Image Data"
                                    (click)="clearImageData()"/>
                </div>
              </div>
            </div>
            <div class="col-sm-5">
              <div class="form-group">
                <label [for]="stringUtils.kebabCase('image-title', index)">Image Title</label>
                <textarea [(ngModel)]="item.text" (ngModelChange)="callImageChange()" type="text"
                          class="form-control input-sm"
                          rows="2" [id]="stringUtils.kebabCase('image-title', index)"
                          placeholder="Enter title for image"></textarea>
              </div>
              <div class="row">
                <div class="col-sm-5">
                  <app-group-event-type-selector [dataSource]="item.dateSource" label="Date Source" includeUpload
                                                 (eventChange)="eventTypeChange($event)"
                                                 (initialValue)="groupEventType=$event"/>
                </div>
                <div class="col-sm-7 no-left-padding">
                  <div class="form-group no-left-padding">
                    <app-date-picker startOfDay [label]="'Image Date'"
                                     [size]="'md'"
                                     (dateChange)="dateChange($event)"
                                     [value]="item?.date"/>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <app-tag-editor [tagsForImage]="item?.tags"
                                [contentMetadataImageTags]="contentMetadataImageTags"
                                [text]="item?.text"
                                (tagsChange)="tagsChange($event)"/>
              </div>
              <div class="form-group">
                <label [for]="'name-' + index">Image Source {{ imageUnsaved(item) }}</label>
                @if (!item.base64Content) {
                  <input [(ngModel)]="item.image" type="text"
                         class="form-control input-sm"
                         [id]="'name-' + index" placeholder="Image source - updated automatically"/>
                }
              </div>
              @if (item.originalFileName) {
                <div class="form-group">
                  <label [for]="'original-name-' + index">Original Name</label>
                  <input class="form-control input-sm"
                         [value]="item.originalFileName" disabled [id]="'original-name-' + index"/>
                </div>
              }
            </div>
            @if (item?.dateSource !== 'upload') {
              <div class="col-sm-12">
                <app-group-event-selector [label]="'Link to ' + groupEventType?.description"
                                          [eventId]="item.eventId"
                                          [dataSource]="groupEventType?.area"
                                          (eventCleared)="item.eventId=null"
                                          (eventChange)="eventChange($event)"/>
              </div>
            }
            @if (notifyTarget.showAlert) {
              <div class="col-sm-12">
                <div class="alert {{notifyTarget.alertClass}} table-pointer">
                  <fa-icon [icon]="notifyTarget.alert.icon"/>
                  @if (notifyTarget.alertTitle) {
                    <strong>
                      {{ notifyTarget.alertTitle }}:</strong>
                  } {{ notifyTarget.alertMessage }}
                </div>
              </div>
            }
          </div>
        </div>
      </div>`,
    imports: [ImageCropperAndResizerComponent, NgClass, FontAwesomeModule, BadgeButtonComponent, FormsModule, GroupEventTypeSelectorComponent, DatePickerComponent, TagEditorComponent, GroupEventSelectorComponent]
})
export class ImageEditComponent implements OnInit {

  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public imageDuplicatesService: ImageDuplicatesService = inject(ImageDuplicatesService);
  public broadcastService: BroadcastService<KeyValue<boolean>> = inject(BroadcastService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private notifierService: NotifierService = inject(NotifierService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  private urlService: UrlService = inject(UrlService);
  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("ImageEditComponent", NgxLoggerLevel.ERROR);
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  private s3Metadata: S3Metadata;

  @Input("duplicateImages") set acceptDuplicateImagesFrom(duplicateImages: DuplicateImages) {
    this.duplicateImages = duplicateImages;
    this.logger.info("duplicateImages received for", this.item, duplicateImages);
  }

  @Input("contentMetadataImageTags") set acceptImageTagChangesFrom(imageTags: ImageTag[]) {
    this.logger.info("imageTags change:", imageTags);
    this.contentMetadataImageTags = imageTags;
  }

  @Input("index") set acceptChangesFromIndex(index: number) {
    this.index = index;
    this.logger.info("acceptChangesFromIndex:", index);
  }

  @Input("item") set acceptChangesFromItem(item: ContentMetadataItem) {
    this.item = item;
    this.logger.info("acceptChangesFromItem:", item);
    this.awsFileDataFromEdit = null;
    this.checkDuplicates(item);
  }

  @Input("filteredFiles") set acceptChangesFrom(filteredFiles: ContentMetadataItem[]) {
    this.filteredFiles = filteredFiles;
  }

  @Input("contentMetadata") set acceptContentMetadataChangesFrom(contentMetadata: ContentMetadata) {
    this.logger.info("contentMetadata change:", contentMetadata);
    this.contentMetadata = contentMetadata;
  }

  @Input("s3Metadata") set s3MetadataValue(s3Metadata: S3Metadata) {
    this.logger.info("s3Metadata change:", s3Metadata);
    this.s3Metadata = s3Metadata;
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
  private awsFileDataFromEdit: AwsFileData;
  protected readonly faImage = faImage;
  protected readonly faRemove = faRemove;
  protected readonly faAdd = faAdd;
  protected readonly faAngleUp = faAngleUp;
  protected readonly faPencil = faPencil;
  protected readonly faAngleDown = faAngleDown;
  protected readonly faBook = faBook;
  protected readonly faLink = faLink;
  protected readonly faLinkSlash = faLinkSlash;

  ngOnInit() {
    this.editActive = false;
    this.logger.info("ngOnInit:item", this.item, "index:", this.index, "this.aspectRatio:", this.contentMetadata?.aspectRatio, "editActive:", this.editActive);
    this.setEnablementProperties();
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
        message: this.imageDuplicatesService.duplicates(item, this.duplicateImages, this.filteredFiles),
        continue: true
      });
    } else {
      this.notify.hide();
    }
  }

  imageChanged(awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData, "before item base64Content change:", this.item);
    this.awsFileDataFromEdit = awsFileData;
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
      message: (errorEvent ? (". Error was: " + JSON.stringify(errorEvent)) : ""),
      continue: true
    });
    this.notify.clearBusy();
  }

  imageEditQuit() {
    this.editActive = false;
    this.awsFileDataFromEdit = null;
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
    this.logger.off("imageLoaded:", event);
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

  private setEnablementProperties() {
    this.canMoveUp = this.index > 0;
    this.canMoveDown = this.index < this.filteredFiles.length - 1;
  }

  clearImageData() {
    this.item.tags = [];
    this.item.text = null;
    this.item.dateSource = null;
    this.item.dateSource = uploadGroupEventType.area;
    this.item.date = this.s3Metadata?.lastModified;
    this.item.eventId = null;
  }

  imageDataAsPrevious() {
    this.setImageDataFromIndex(this.index - 1);
  }

  imageDataAsNext() {
    this.setImageDataFromIndex(this.index + 1);
  }

  private setImageDataFromIndex(index: number) {
    const referenceItem: ContentMetadataItem = this.filteredFiles[index];
    if (referenceItem) {
      this.logger.info("setImageDataFromIndex:", index, "referenceItem:", referenceItem);
      this.item.tags = referenceItem.tags;
      this.item.text = referenceItem.text;
      this.item.dateSource = referenceItem.dateSource;
      this.item.date = referenceItem.date;
      this.item.eventId = referenceItem.eventId;
      this.groupEventType = groupEventTypeFor(referenceItem.dateSource);
      this.callImageChange();
    } else {
      this.logger.info("setImageDataFromIndex: no referenceItem found for index:", index);
    }
  }


  imageUnsaved(item: ContentMetadataItem) {
    return item.base64Content ? "(unsaved changes)" : "";
  }

  imagedIsCropped() {
    return !this.editActive && !!this?.awsFileDataFromEdit;
  }

  imagedIsSaved() {
    return this.s3Metadata && !!this.item.image;
  }

  croppedSize() {
    return this.numberUtils.humanFileSize(this.awsFileDataFromEdit?.file?.size);
  }

  imageSize() {
    return this.s3Metadata?.size ? this.numberUtils.humanFileSize(this.s3Metadata?.size) : this.numberUtils.humanFileSize(this.item?.base64Content?.length);
  }

}
