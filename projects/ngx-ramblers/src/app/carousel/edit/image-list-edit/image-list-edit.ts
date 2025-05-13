import { HttpErrorResponse } from "@angular/common/http";
import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import min from "lodash-es/min";
import range from "lodash-es/range";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { PageChangedEvent, PaginationComponent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  faAdd,
  faCompress,
  faEraser,
  faFile,
  faPencil,
  faRemove,
  faSave,
  faSortNumericDown,
  faSortNumericUp,
  faTableCells,
  faTags,
  faUndo
} from "@fortawesome/free-solid-svg-icons";

import {
  ALL_PHOTOS,
  Base64File,
  CheckedImage,
  ContentMetadata,
  ContentMetadataItem,
  ContentMetadataResizeRequest,
  DuplicateImages,
  IMAGE_HEIC,
  ImageFilterType,
  ImageTag,
  RECENT_PHOTOS,
  S3Metadata
} from "../../../models/content-metadata.model";
import { MemberResourcesPermissions } from "../../../models/member-resource.model";
import { Confirm, StoredValue } from "../../../models/ui-actions";
import { move, sortBy } from "../../../functions/arrays";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { ImageDuplicatesService } from "../../../services/image-duplicates-service";
import { ImageTagDataService } from "../../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { RootFolder, SystemConfig } from "../../../models/system.model";
import {
  AwsFileUploadResponse,
  AwsFileUploadResponseData,
  DescribedDimensions
} from "../../../models/aws-object.model";
import { FileUtilsService } from "../../../file-utils.service";
import { base64ToFile } from "ngx-image-cropper";
import keys from "lodash-es/keys";
import isEmpty from "lodash-es/isEmpty";
import { BadgeButtonComponent } from "../../../modules/common/badge-button/badge-button";
import { NgClass, NgStyle } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TagManagerComponent } from "../../../pages/tag/tag-manager.component";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { AspectRatioSelectorComponent } from "../aspect-ratio-selector/aspect-ratio-selector";
import { ImageEditComponent } from "../image-edit/image-edit";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FileSizeSelectorComponent } from "../file-size-selector/file-size-selector";
import { SystemConfigService } from "../../../services/system/system-config.service";
import isUndefined from "lodash-es/isUndefined";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { ApiResponse } from "../../../models/api-response.model";
import isArray from "lodash-es/isArray";
import { EventType, MessageType, ProgressResponse } from "../../../models/websocket.model";

@Component({
  selector: "app-image-list-edit",
  styles: [`
    .horizontal
      display: flex

    .tags-input
      max-width: 100%
      line-height: 22px
      overflow-y: scroll
      overflow-x: scroll
      height: 65px
      cursor: text

    .no-right-padding
      padding-right: 0

    .no-left-padding
      padding-left: 0

    .visible-viewport
      height: 10000px
      width: auto

    .right-justify-ellipsis
      text-align: right
      direction: rtl
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap
  `],
  template: `
    @if (allow.edit && contentMetadata) {
      <div class="row mb-4 px-1">
        <div class="col-sm-12">
          <div class="form-group">
            <label for="name">Album Name</label>
            <input [delay]="1000"
                   [tooltip]="imagesExist() ? 'Album name cannot be changed after images have been created in it':''"
                   [disabled]="imagesExist()" type="text" [ngModel]="contentMetadata.name" id="name"
                   (ngModelChange)="albumNameChange($event)"
                   class="form-control">
          </div>
        </div>
        <div class="col-sm-6">
          <app-aspect-ratio-selector label="Default Aspect Ratio"
                                     [dimensionsDescription]="contentMetadata.aspectRatio"
                                     (dimensionsChanged)="dimensionsChanged($event)"/>
        </div>
        <div class="col-sm-6">
          <app-file-size-selector label="Auto-resize New Images To Maximum Size"
                                  [fileSize]="contentMetadata.maxImageSize"
                                  (fileSizeChanged)="contentMetadata.maxImageSize=$event"/>
        </div>
      </div>
      <input #fileElement class="d-none" type="file" ng2FileSelect multiple
             (onFileSelected)="onFileSelectOrDropped($event)"
             [uploader]="uploader">
      <div class="row no-gutters">
        <div class="col pr-1">
          <app-badge-button fullWidth="true" [icon]="faSave" caption="Save changes and exit"
                            (click)="requestSaveChangesAndExit()"
                            [disabled]="disabled()"/>
        </div>
        <div class="col pr-1">
          <app-badge-button fullWidth="true" [icon]="faSave" caption="Save" (click)="requestSaveChanges()"
                            [disabled]="disabled()"/>
        </div>
        <div class="col pr-1">
          <app-badge-button fullWidth="true" [icon]="faUndo" caption="Exit without saving"
                            [disabled]="disabled()"
                            (click)="exitBackWithoutSaving()"/>
        </div>
        <div class="col pr-1">
          <app-badge-button fullWidth [icon]="faUndo" [caption]="'Undo'" (click)="undoChanges()"
                            [disabled]="disabled()"/>
        </div>
        <div class="btn-group" dropdown>
          <button [disabled]="disabled()" aria-controls="dropdown-animated"
                  class="dropdown-toggle badge-button"
                  [ngClass]="{'disabled': disabled()}"
                  dropdownToggle
                  type="button">
            <fa-icon [icon]="faTableCells"/>
            <span class="ml-2">Image Actions</span><span class="caret"></span>
          </button>
          <ul *dropdownMenu class="dropdown-menu" role="menu">
            @if (imagesExist()) {
              @if (contentMetadata?.maxImageSize > 0) {
                <li role="menuitem">
                  <a (click)="resizeSavedImages()" class="dropdown-item">
                    <fa-icon [icon]="faCompress"/>
                    Resize Existing Images To {{ numberUtils.humanFileSize(contentMetadata.maxImageSize) }}
                  </a>
                </li>
              }
              <li role="menuitem">
                <a (click)="sortByDate()" class="dropdown-item">
                  <fa-icon [icon]="faSortNumericDown"/>
                  Sort by image date
                </a>
              </li>
              <li role="menuitem">
                <a (click)="reverseSortOrder()" class="dropdown-item">
                  <fa-icon [icon]="faSortNumericUp"/>
                  Reverse sort order
                </a>
              </li>
              <li role="menuitem">
                <a (click)="clearImages()" class="dropdown-item">
                  <fa-icon [icon]="faEraser"/>
                  Clear images
                </a>
              </li>
            } @else {
              <li role="menuitem">
                <a (click)="insertToEmptyList()" class="dropdown-item">
                  <fa-icon [icon]="faAdd"/>
                  Create First Image
                </a>
              </li>
            }
            @if (contentMetadata?.imageTags?.length > 0) {
              <li role="menuitem">
                <a (click)="toggleManageTags()" class="dropdown-item">
                  <fa-icon [icon]="faTags"/>
                  {{ manageTags ? "Close Tags" : "Manage Tags" }}
                </a>
              </li>
            }
          </ul>
        </div>
        <div class="col-auto">
          <app-badge-button fullWidth [disabled]="disabled()"
                            [icon]="faFile"
                            caption="Choose Files"
                            (click)="browseToFile(fileElement)"/>
        </div>
      </div>
      <div class="row mt-2">
        <div class="col-sm-12">
          <div ng2FileDrop [ngClass]="{'file-over': !uploader.isUploading && hasFileOver}"
               (fileOver)="fileOver($event)"
               (onFileDrop)="onFileSelectOrDropped($event)"
               [uploader]="uploader"
               class="badge-drop-zone">Drop new files here to add them
          </div>
        </div>
        @if (progressResponse) {
          <div class="col-sm-12 mt-2">
            <div class="progress">
              <div class="progress-bar" role="progressbar" [ngStyle]="{ 'width': progressResponse.percent + '%' }">
                {{ progressResponse.percent }}%
              </div>
            </div>
          </div>
        }
        @if (uploader.isUploading) {
          <div class="col-sm-12 mb-2 mt-2">
            <div class="progress">
              <div class="progress-bar" role="progressbar" [ngStyle]="{ 'width': uploader.progress + '%' }">
                {{ uploader.progress }} %
              </div>
            </div>
          </div>
        }
        <div class="col-sm-12 mt-4">
          @if (warningTarget.showAlert) {
            <div class="flex-grow-1 alert {{warningTarget.alertClass}}">
              <fa-icon [icon]="warningTarget.alert.icon"></fa-icon>
              @if (warningTarget.alertTitle) {
                <strong>
                  {{ warningTarget.alertTitle }}: </strong>
              } {{ warningTarget.alertMessage }}
            </div>
          }
        </div>
      </div>
      @if (manageTags) {
        <div class="row mb-2">
          <div class="col-sm-12">
            <h6>Tag Management</h6>
            <app-tag-manager [contentMetadata]="contentMetadata"/>
          </div>
        </div>
      }
      <h6>Image Filtering</h6>
      <div class="custom-control custom-radio custom-control-inline">
        <input [disabled]="disabled()" id="recent-photos-filter"
               type="radio"
               class="custom-control-input"
               [(ngModel)]="filterType"
               (ngModelChange)="filterFor('recent')"
               value="recent"/>
        <label class="custom-control-label" for="recent-photos-filter">Show recent photos</label>
      </div>
      <div class="custom-control custom-radio custom-control-inline">
        <input [disabled]="disabled()" id="all-photos-filter"
               type="radio"
               class="custom-control-input"
               [(ngModel)]="filterType"
               (ngModelChange)="filterFor('all')"
               value="all"/>
        <label class="custom-control-label" for="all-photos-filter">Show all photos</label>
      </div>
      @if (selectableTags()?.length > 0) {
        <div
          class="custom-control custom-radio custom-control-inline">
          <input [disabled]="disabled()" id="tag-filter"
                 type="radio"
                 class="custom-control-input"
                 [(ngModel)]="filterType"
                 (ngModelChange)="filterFor('tag')"
                 value="tag"/>
          <label class="custom-control-label" for="tag-filter">Show images tagged with:</label>
        </div>
        <div
          class="custom-control custom-radio custom-control-inline">
          <select [compareWith]="imageTagComparer" [disabled]="filterType !== 'tag'"
                  [(ngModel)]="activeTag"
                  id="filterByTag"
                  class="form-control"
                  (ngModelChange)="filterByTag($event)">
            @for (imageTag of selectableTags(); track tagTracker($index, imageTag)) {
              <option
                [ngValue]="imageTag">{{ imageTag.subject }}
              </option>
            }
          </select>
        </div>
      }
      <div class="row mb-3">
        <div class="col-sm-6">
          <label for="search">Filter images for text</label>
          <input [(ngModel)]="filterText" type="text"
                 (ngModelChange)="onSearchChange($event)" class="form-control input-md rounded ml-8 w-100"
                 id="search"
                 placeholder="any text">
        </div>
        <div class="col-sm-6 mt-auto">
          <div class="custom-control custom-checkbox">
            <input
              [(ngModel)]="showDuplicates"
              (ngModelChange)="applyFilter()"
              type="checkbox" class="custom-control-input"
              id="show-duplicates">
            <label class="custom-control-label" for="show-duplicates">Show duplicate images</label>
          </div>
        </div>
      </div>
      <h6>Pagination</h6>
      <div class="row">
        <div class="col-sm-12 mt-3 d-flex">
          <pagination class="pagination rounded" [boundaryLinks]=true [rotate]="true" [maxSize]="maxSize()"
                      [totalItems]="filteredFiles.length" [(ngModel)]="pageNumber"
                      (pageChanged)="pageChanged($event)"></pagination>
          @if (notifyTarget.showAlert) {
            <div class="flex-grow-1 alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"/>
              @if (notifyTarget.alertTitle) {
                <strong>
                  {{ notifyTarget.alertTitle }}: </strong>
              } {{ notifyTarget.alertMessage }}
            </div>
          }
        </div>
      </div>
      @for (imageMetaDataItem of currentPageImages; track metadataItemTracker(index, imageMetaDataItem); let index = $index) {
        <app-image-edit noImageSave
                        [index]="index"
                        [duplicateImages]="duplicateImages"
                        [contentMetadata]="contentMetadata"
                        [s3Metadata]="metaDataFor(imageMetaDataItem)"
                        [contentMetadataImageTags]="contentMetadata.imageTags"
                        [filteredFiles]="currentPageImages"
                        [item]="imageMetaDataItem"
                        (imageInsert)="imageInsert($event)"
                        (imageEdit)="imageEdit($event)"
                        (imageChange)="imageChange($event)"
                        (imagedSavedOrReverted)="imagedSavedOrReverted($event)"
                        (delete)="delete($event)"
                        (moveUp)="moveUp($event)"
                        (moveDown)="moveDown($event)">
        </app-image-edit>
      }
    }`,
  imports: [FileUploadModule, BadgeButtonComponent, NgClass, NgStyle, FontAwesomeModule, TagManagerComponent,
    FormsModule, PaginationComponent, TooltipDirective, AspectRatioSelectorComponent, ImageEditComponent,
    BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, FileSizeSelectorComponent]
})
export class ImageListEditComponent implements OnInit, OnDestroy {

  @Input("name") set nameValue(name: string) {
    this.logger.info("name changed:", name);
    this.initialiseImagesForName(name);
  }

  @Output() exit: EventEmitter<ContentMetadata> = new EventEmitter();

  private logger: Logger = inject(LoggerFactory).createLogger("ImageListEditComponent", NgxLoggerLevel.ERROR);
  public notifyTarget: AlertTarget = {};
  private notifierService: NotifierService = inject(NotifierService);
  private webSocketClientService: WebSocketClientService = inject(WebSocketClientService);
  public notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public imageTagDataService: ImageTagDataService = inject(ImageTagDataService);
  public numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public fileUtils: FileUtilsService = inject(FileUtilsService);
  private imageDuplicatesService: ImageDuplicatesService = inject(ImageDuplicatesService);
  private contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private fileUploadService: FileUploadService = inject(FileUploadService);
  private memberLoginService: MemberLoginService = inject(MemberLoginService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  private urlService: UrlService = inject(UrlService);
  public name: string;
  private changeUrlOnChangeOfTag = false;
  private queuedFileCount = 0;
  public duplicateImages: DuplicateImages;
  public base64Files: Base64File[] = [];
  public nonImageFiles: Base64File[] = [];
  public activeTag: ImageTag;
  private story: string;
  public warnings: AlertInstance;
  public warningTarget: AlertTarget = {};
  public confirm = new Confirm();
  public destinationType: string;
  public filterType: ImageFilterType;
  public uploader: FileUploader;
  public contentMetadata: ContentMetadata;
  public s3Metadata: S3Metadata[] = [];
  public filteredFiles: ContentMetadataItem[] = [];
  public changedItems: ContentMetadataItem[] = [];
  public currentPageImages: ContentMetadataItem[] = [];
  public allow: MemberResourcesPermissions = {};
  public showDuplicates = false;
  public filterText: string;
  public hasFileOver = false;
  public exitAfterSave = false;
  public currentImageIndex: number;
  private searchChangeObservable = new Subject<string>();
  public pageNumber = 1;
  private pageCount: number;
  private pageSize = 10;
  private pages: number[];
  private subscriptions: Subscription[] = [];
  public tags: number[];
  public manageTags: boolean;
  protected readonly faSave = faSave;
  protected readonly faPencil = faPencil;
  protected readonly faRemove = faRemove;
  protected readonly faEraser = faEraser;
  protected readonly faUndo = faUndo;
  protected readonly faSortNumericDown = faSortNumericDown;
  protected readonly faSortNumericUp = faSortNumericUp;
  protected readonly faAdd = faAdd;
  protected readonly faTags = faTags;
  protected readonly faFile = faFile;
  protected readonly faTableCells = faTableCells;
  protected readonly faCompress = faCompress;
  protected readonly saveToNew = false;
  private systemConfig: SystemConfig;
  protected progressResponse: ProgressResponse;

  ngOnInit() {
    this.logger.info("ngOnInit:this.contentMetadata", this.contentMetadata, "name:", this.name, "story:", this.story);
    this.notify.setBusy();
    this.warnings = this.notifierService.createAlertInstance(this.warningTarget);
    this.destinationType = "";
    this.filterType = ImageFilterType.ALL;
    this.subscriptions.push(this.contentMetadataService.s3Notifications().subscribe(data => this.logger.debug("contentMetadataService.notifications.s3:", data)));
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      this.story = params[StoredValue.STORY];
      this.logger.info("route.queryParams:", this.story);
      this.syncTagWithStory();
    }));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const name = paramMap.get("name");
      this.logger.info("paramMap:subscribe:", paramMap, "name from paramMap:", name, "existing name:", this.name);
      this.initialiseImagesForName(name);
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => this.systemConfig = systemConfig));
    this.subscriptions.push(this.webSocketClientService.receiveMessages<ProgressResponse>(MessageType.PROGRESS).subscribe((progressResponse: ProgressResponse) => {
      this.progressResponse = progressResponse;
      this.logger.info(`Progress: ${progressResponse.message}`);
      this.notify.success({title: "Progress", message: progressResponse.message});
    }));
    this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.ERROR).subscribe(error => {
      this.logger.error(`Error:`, error);
      this.notify.error({title: "Error", message: error});
      })
    );
    this.subscriptions.push(this.webSocketClientService.receiveMessages(MessageType.COMPLETE).subscribe((message: ApiResponse) => {
        this.logger.info(`Task completed:`, message);
      this.progressResponse = null;
        if (isArray(message.response)) {
          this.processResizeItemsResponse(message.response);
          this.clearBusy();
        } else {
          this.postSaveContentMetadata(Promise.resolve(message.response)).then(() => this.clearBusy());
        }
      })
    );
    this.applyFilter();
    this.applyAllowEdits();
    this.searchChangeObservable.pipe(debounceTime(500))
      .pipe(distinctUntilChanged())
      .subscribe(() => this.applyFilter());
  }

  private clearBusy() {
    this.logger.info("clearBusy called");
    this.notify.clearBusy();
  }

  private setBusy() {
    this.logger.info("setBusy called");
    this.notify.setBusy();
  }

  albumNameChange(albumName: string) {
    const reformattedPath = this.urlService.reformatLocalHref(albumName);
    this.logger.info("albumNameChange:", albumName, "reformattedPath:", reformattedPath);
    this.contentMetadata.name = reformattedPath;
  }

  private initialiseImagesForName(name: string) {
    if (name && this.name !== name) {
      this.name = name;
      this.initialiseImageList();
    } else if (this.name && this.name !== this.contentMetadata?.name) {
      this.initialiseImageList();
    }
  }

  public tagSelected(tag: ImageTag) {
    this.logger.debug("tag selected:", tag);
    if (tag) {
      if (tag === RECENT_PHOTOS) {
        this.filterType = ImageFilterType.RECENT;
      } else if (tag === ALL_PHOTOS) {
        this.filterType = ImageFilterType.ALL;
      } else {
        this.filterType = ImageFilterType.TAG;
      }
    }
  }

  private syncTagWithStory() {
    if (this.contentMetadata) {
      const tag = this.imageTagDataService.findTag(this.contentMetadata?.imageTags, this.story);
      this.logger.info("syncTagWithStory:contentMetadata:", this.contentMetadata, "received story parameter:", this.story, "setting activeTag to:", tag);
      this.activeTag = tag;
      if (tag) {
        this.imageTagDataService.updateUrlWith(tag);
        this.tagSelected(tag);
        this.applyFilter();
      }
    } else {
      this.logger.info("syncTagWithStory:story parameter:", this.story, "cant perform sync as no contentMetadata");
    }

  }

  private initialiseImageList() {
    this.logger.info("initialiseImageList for name:", this.name);
    this.refreshContentAndS3Metadata(this.name);
    this.uploader = this.fileUploadService.createUploaderFor(RootFolder.carousels + "/" + this.name, false);
    this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
        const awsFileUploadResponse: AwsFileUploadResponse = this.fileUploadService.handleAwsFileUploadResponse(response, this.notify, this.logger);
      this.logger.debug("received awsFileUploadResponse:", awsFileUploadResponse);
        if (awsFileUploadResponse.errors.length > 0) {
          this.notify.error({title: "File upload failed", message: awsFileUploadResponse.errors});
        } else {
          const responses: AwsFileUploadResponseData[] = awsFileUploadResponse.responses;
          if (responses.length > 0) {
            this.notify.success({
              title: "File upload success",
              message: `${this.stringUtils.pluraliseWithCount(responses.length, "file")} ${this.stringUtils.pluraliseWithCount(responses.length, "was", "were")} uploaded`
            });
            const matches: ContentMetadataItem[] = responses.map(response => {
              const metadataItem: ContentMetadataItem = this.contentMetadata.files.find(item => item.originalFileName === response.uploadedFile.originalname);
              if (metadataItem) {
                metadataItem.image = response.fileNameData.awsFileName;
                delete metadataItem.base64Content;
                this.logger.debug("matched image :", metadataItem?.originalFileName, "with aws file", response.fileNameData.awsFileName);
                return metadataItem;
              } else {
                this.logger.warn("could not find match in metadata items for:", response);
                return null;
              }
            }).filter(item => item);
            if (matches.length === responses.length) {
              if (this.uploader.progress < 100) {
                this.logger.debug("uploader is still uploading with", this.stringUtils.pluraliseWithCount(this.uploader.queue.length, "queued item"), "remaining");
                this.alertWarnings();
              } else {
                const message = this.stringUtils.pluraliseWithCount(responses.length, "saved file") + " were matched to currently viewed images that have been uploaded";
                const title = "File upload success";
                this.logger.debug(title, message);
                this.notify.success({
                  title,
                  message
                });
                this.clearUpload();
                if (this.readyToSaveMetadata()) {
                  if (this.exitAfterSave) {
                    this.saveChangeAndExit();
                  } else {
                    this.saveChanges();
                  }
                } else {
                  this.notify.warning({
                    title: "File upload",
                    message: `Save cannot take place as out of the ${this.stringUtils.pluraliseWithCount(this.queuedFileCount, "saved file")}, ${this.stringUtils.pluraliseWithCount(this.unsavedImages().length, "appears", "appear")} to not have been saved`
                  });
                }
              }
            } else {
              this.notify.warning({
                title: "File upload matching failed",
                message: `${this.stringUtils.pluraliseWithCount(matches.length, "viewed file")} of ${this.stringUtils.pluraliseWithCount(responses.length, "saved file")} were matched to images that have been uploaded`
              });
            }
          } else {
            this.notify.warning({
              title: "File upload",
              message: "no files were uploaded"
            });
          }
        }
      }, (error) => {
        this.notify.error({title: "Upload failed", message: error});
      }
    );
  }

  private clearUpload() {
    this.uploader.clearQueue();
    this.uploader.isUploading = false;
  }

  imagesExist() {
    return this.contentMetadata?.files?.filter(item => item.image)?.length > 0;
  }

  dimensionsChanged(dimensions: DescribedDimensions): void {
    this.logger.debug("dimensions changed:", dimensions);
    this.contentMetadata.aspectRatio = dimensions.description;
  }

  pageChanged(event: PageChangedEvent): void {
    this.logger.debug("event:", event);
    this.goToPage(event.page);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  insertToEmptyList() {
    this.logger.debug("inserting image with filteredFiles:", this.filteredFiles);
    const newItem: ContentMetadataItem = {date: this.dateUtils.momentNow().valueOf(), dateSource: "upload", tags: []};
    this.contentMetadata.rootFolder = RootFolder.carousels;
    this.contentMetadata.name = this.name;
    this.imageInsert(newItem);
  }

  goToPage(pageNumber) {
    this.logger.debug("goToPage", pageNumber);
    this.pageNumber = pageNumber;
    this.applyPagination();
  }

  paginate(contentMetadataItems: ContentMetadataItem[], pageSize, pageNumber): ContentMetadataItem[] {
    return contentMetadataItems.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  }

  private applyPagination() {
    this.pages = range(1, this.pageCount + 1);
    const filteredImageCount = this.filteredFiles?.length;
    this.currentPageImages = this.paginate(this.filteredFiles, this.pageSize, this.pageNumber) || [];
    this.logger.debug("applyPagination: filtered image count", filteredImageCount, "filtered image count", filteredImageCount, "current page image count", this.currentPageImages?.length, "pageSize:", this.pageSize, "pageCount", this.pageCount, "pages", this.pages);
    if (this.currentPageImages.length === 0) {
      this.notify.progress("No images found");
    } else {
      const offset = (this.pageNumber - 1) * this.pageSize + 1;
      const pageIndicator = this.pages.length > 1 ? `Page ${this.pageNumber} of ${this.pageCount}` : `Page ${this.pageNumber}`;
      const toNumber = min([offset + this.pageSize - 1, filteredImageCount]);
      this.notify.progress(`${pageIndicator}  — showing ${offset} to ${toNumber} of ${this.stringUtils.pluraliseWithCount(filteredImageCount, "image")}`);
    }
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  imageTagComparer(item1: ImageTag, item2: ImageTag): boolean {
    return item1?.key === item2?.key;
  }

  filterByTag(tagSubject: string) {
    this.logger.debug("filterByTag:tagSubject:", tagSubject);
    if (this.changeUrlOnChangeOfTag) {
      // causes full component reload so don't do this
      this.imageTagDataService.select(this.contentMetadata?.imageTags, tagSubject);
    }
    this.applyFilter();
  }

  applyFilter() {
    this.logger.info("applyFilters start:", this.filteredFiles?.length, "of", this.contentMetadata?.files?.length, "files", "tag:", this.activeTag, "showDuplicates:", this.showDuplicates, "filterText:", this.filterText);
    this.filterFiles();
    this.pageCount = this.calculatePageCount();
    this.applyPagination();
    this.detectDuplicates();
    this.alertWarnings();
  }

  private detectDuplicates() {
    this.duplicateImages = this.imageDuplicatesService.populateFrom(this.contentMetadata);
  }

  private filterFiles() {
    this.filteredFiles = this.contentMetadataService.filterSlides(this.contentMetadata?.imageTags, this.contentMetadata?.files, this.duplicateImages, this.filterType, this.activeTag, this.showDuplicates, this.filterText) || [];
    this.logger.info("filteredFiles:", this.filteredFiles);
  }

  refreshContentAndS3Metadata(name: string) {
    this.setBusy();
    this.name = name;
    this.logger.info("image metadata refresh started for name:", name);
    return Promise.all([
      this.contentMetadataService.items(RootFolder.carousels, this.name)
        .then((contentMetaData: ContentMetadata) => {
          this.contentMetadata = contentMetaData;
          this.logger.info("this.contentMetadataService:returned:", contentMetaData);
        }),
      this.refreshS3Metadata()]
    )
      .then(() => {
        this.logger.info("metadata query complete for:", this.name);
        this.postMetadataRetrieveMapping();
      })
      .catch(response => this.notify.error({title: "Failed to refresh images", message: response}));
  }

  private refreshS3Metadata() {
    const metadataPrefix = this.contentMetadataService.rootFolderAndName(RootFolder.carousels, this.name);
    return this.contentMetadataService.listMetaData(metadataPrefix)
      .then((s3Metadata: S3Metadata[]) => {
        this.s3Metadata = s3Metadata;
        this.logger.info("listMetaData:metadataPrefix:", metadataPrefix, "returned:", s3Metadata);
      });
  }

  private postMetadataRetrieveMapping() {
    this.syncTagWithStory();
    this.logger.info("postMetadataRetrieveMapping for:", this.name, "this.contentMetadata.maxImageSize", this.contentMetadata.maxImageSize, "this.contentMetadata.aspectRatio", this.contentMetadata.aspectRatio);
    if (isUndefined(this.contentMetadata.maxImageSize)) {
      this.contentMetadata.maxImageSize = this.systemConfig.images?.imageLists?.defaultMaxImageSize;
    }
    if (isUndefined(this.contentMetadata.aspectRatio)) {
      this.contentMetadata.aspectRatio = this.systemConfig.images?.imageLists?.defaultAspectRatio;
    }
    if (this.contentMetadata.files) {
      this.contentMetadata.files = this.contentMetadata.files.map(file => {
        return {
          ...file,
          date: this.fileDate(file),
          dateSource: file.dateSource || "upload"
        };
      });
    } else {
      this.logger.debug("no data exists for:", this.name);
    }
    this.logger.debug("refreshImageMetaData:name", this.name, "returning", this.contentMetadata?.files?.length, "ContentMetadataItem items");
    this.base64Files = [];
    this.applyFilter();
    this.clearBusy();
  }

  fileDate(file: ContentMetadataItem): number {
    if (!file.date && !this.s3Metadata) {
      this.logger.warn("cant find date for", file);
    }
    const fileDate = file.date || this.metaDataFor(file)?.lastModified;
    this.logger.debug("fileDate:", fileDate, "original file.date", file.date);
    return fileDate;
  }

  public metaDataFor(item: ContentMetadataItem): S3Metadata {
    const metadata = this.contentMetadataService.findMetadataFor(item, this.s3Metadata);
    this.logger.off("metaDataFor item:", item, this.s3Metadata, "found metadata:", metadata);
    return metadata;
  }

  reverseSortOrder() {
    this.contentMetadata.files = this.contentMetadata.files.reverse();
    this.applyFilter();
  }

  clearImages() {
    this.contentMetadata.files = [];
    this.base64Files = [];
    this.applyFilter();
  }

  sortByDate() {
    this.contentMetadata.files = this.contentMetadata.files.sort(sortBy("-date"));
    this.applyFilter();
  }

  requestSaveChangesAndExit() {
    if (this.readyToSaveMetadata()) {
      this.saveChangeAndExit();
    } else {
      this.exitAfterSave = true;
      this.prepareFilesAndPerformUpload();
    }
  }

  requestSaveChanges(): void {
    if (this.readyToSaveMetadata()) {
      this.saveChanges();
    } else {
      this.exitAfterSave = false;
      this.prepareFilesAndPerformUpload();
    }
  }

  saveChangeAndExit() {
    this.saveChanges()
      .then((saved: ContentMetadata) => {
        this.exit.next(saved);
      }).catch(response => this.notify.error({title: "Failed to save images", message: response}));
  }

  saveChanges(): Promise<ContentMetadata> {
    return this.postSaveContentMetadata(this.contentMetadataService.createOrUpdate(this.contentMetadata));
  }

  postSaveContentMetadata(savedContent: Promise<ContentMetadata>): Promise<ContentMetadata> {
    return savedContent
      .then(async (savedContent: ContentMetadata) => {
        this.saveOrUpdateSuccessful();
        this.logger.info("postSaveContentMetadata:saved content:", savedContent);
        this.contentMetadata = savedContent;
        await this.refreshS3Metadata();
        this.postMetadataRetrieveMapping();
        return savedContent;
      })
      .catch(response => {
        this.notify.error({title: "Failed to save changes", message: response});
        return null;
      });
  }

  public exitBackWithoutSaving() {
    this.exit.emit();
  }

  public undoChanges() {
    this.clearUpload();
    this.nonImageFiles = [];
    return this.refreshContentAndS3Metadata(this.name)
      .catch(response => this.notify.error({title: "Failed to undo changes", message: response}));
  }

  applyAllowEdits() {
    this.allow.edit = this.memberLoginService.allowContentEdits();
  }

  saveOrUpdateSuccessful() {
    this.notify.success(`${this.stringUtils.pluraliseWithCount(this.contentMetadata?.files?.length, "image")} ${this.stringUtils.pluralise(this.contentMetadata?.files?.length, "was", "were")} saved successfully`);
  }

  moveUp(item: ContentMetadataItem) {
    const currentIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (this.contentMetadataService.canMoveUp(this.contentMetadata.files, item)) {
      move(this.contentMetadata.files, currentIndex, currentIndex - 1);
      this.logger.debug("moved up item with index", currentIndex, "to", this.contentMetadataService.findIndex(this.contentMetadata.files, item), "in total of", this.contentMetadata?.files?.length, "items");
      this.applyFilter();
    } else {
      this.logger.warn("cant move up item with index", currentIndex);
    }
  }

  moveDown(item: ContentMetadataItem) {
    const currentIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (this.contentMetadataService.canMoveDown(this.contentMetadata.files, item)) {
      move(this.contentMetadata.files, currentIndex, currentIndex + 1);
      this.logger.debug("moved down item with index", currentIndex, "to", this.contentMetadataService.findIndex(this.contentMetadata.files, item), "for item", item.text, "in total of", this.contentMetadata?.files?.length, "items");
      this.applyFilter();
    } else {
      this.logger.warn("cant move down item", currentIndex);
    }
  }

  imagedSavedOrReverted(changedItem: ContentMetadataItem) {
    this.logger.debug("imagedSavedOrReverted:changedItem.image", changedItem.image);
    this.removeFromChangedItems(changedItem);
    if (!changedItem.image) {
      this.applyFilter();
    }
  }

  imageChange(item: ContentMetadataItem) {
    if (!item) {
      this.logger.debug("change:no item");
    } else {
      this.currentImageIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
      if (this.currentImageIndex >= 0) {
        this.logger.debug("change:existing item", item, "at index", this.currentImageIndex);
        this.contentMetadata.files[this.currentImageIndex] = item;
      } else {
        this.logger.warn("change:appears to be a new item", item, "at index", this.currentImageIndex);
      }
    }
  }

  delete(item: ContentMetadataItem): number {
    this.removeFromChangedItems(item);
    this.logger.debug("delete:before count", this.contentMetadata?.files?.length, "item:", item);
    const index = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (index >= 0) {
      this.contentMetadata.files.splice(index, 1);
      this.logger.debug("delete:after count", this.contentMetadata?.files?.length);
      this.applyFilter();
      this.detectDuplicates();
    } else {
      this.logger.warn("cant delete", item);
    }
    return this.contentMetadataService.findIndex(this.contentMetadata.files, item);
  }

  imageEdit(item: ContentMetadataItem) {
    this.addToChangedItems(item);
  }

  imageInsert(...items: ContentMetadataItem[]) {
    this.logger.info("insert:new items", items, "before:", this.contentMetadata.files);
    if (this.contentMetadata.files) {
      this.contentMetadata.files.splice(0, 0, ...items);
    } else {
      this.contentMetadata.files = items;
    }

    this.logger.info("insert:new items", items, "after:", this.contentMetadata.files);
    this.addToChangedItems(...items);
    this.resizeUnsavedImages(items);
  }

  alertWarnings() {
    if (this.unsavedImages().length > 0 || !isEmpty(this.nonImageMessage()) || !isEmpty(this.duplicateMessage())) {
      if (isEmpty(this.duplicateMessage())) {
        this.warnings.warning({title: "Unsaved Changes", message: this.alertText()});
      } else {
        this.warnings.error({title: "Unsaved Changes", message: this.alertText(), continue: true});
      }
    } else {
      this.warnings.hide();
    }
  }

  selectableTags(): ImageTag[] {
    return this.contentMetadata?.imageTags || [];
  }

  tagTracker(index: number, imageTag: ImageTag) {
    return imageTag.key;
  }

  metadataItemTracker(index: number, item: ContentMetadataItem) {
    return item._id || index;
  }

  filterFor(choice: any) {
    this.logger.debug("filterFor:choice:", choice);
    this.applyFilter();
  }

  maxSize() {
    return min([this.calculatePageCount(), 5]);
  }

  private calculatePageCount(): number {
    return Math.ceil(this.filteredFiles?.length / this.pageSize);
  }

  private addToChangedItems(...items: ContentMetadataItem[]) {
    const netChangedItems: ContentMetadataItem[] = this.changedItems.filter(item => !items.includes(item));
    if (netChangedItems.length > 0) {
      this.logger.debug("addToChangedItems:", netChangedItems);
      this.changedItems.push(...netChangedItems);
    }
    this.applyFilter();
  }

  private removeFromChangedItems(item: ContentMetadataItem) {
    if (this.changedItems.includes(item)) {
      this.logger.debug("removeFromChangedItems:", item);
      this.changedItems = this.changedItems.filter(changedItem => changedItem !== item);
    }
    this.alertWarnings();
  }

  alertText() {
    const duplicateMessage = this.duplicateMessage();
    const nonImageMessage = this.nonImageMessage();
    return `You have ${this.stringUtils.pluraliseWithCount(this.unsavedImages()?.length, "unsaved image")}${duplicateMessage}${nonImageMessage}`;
  }

  private duplicateMessage(): string {
    const duplicatedImages: string[] = keys(this.duplicateImages);
    return duplicatedImages.length > 0 ? ` and ${this.stringUtils.pluralise(duplicatedImages.length, "a duplicate", "duplicates")} on ${this.stringUtils.pluraliseWithCount(duplicatedImages.length, "image")} will need to be resolved before you can save this album` : "";
  }

  private nonImageMessage(): string {
    return this.nonImageFiles.length > 0 ? ` and ${this.stringUtils.pluraliseWithCount(this.nonImageFiles.length, "non-image")} that ${this.stringUtils.pluralise(this.nonImageFiles.length, "was", "were")} skipped` : "";
  }

  toggleManageTags() {
    this.manageTags = !this.manageTags;
  }

  browseToFile(fileElement: HTMLInputElement) {
    if (!this.uploader.isUploading) {
      fileElement.click();
    }
  }

  async onFileSelectOrDropped(fileList: any) {
    if (!this.uploader.isUploading) {
      this.logger.debug("onFileSelectOrDropped:", fileList);
      this.notify.success({
        title: "Uploading Files",
        message: "Processing " + this.stringUtils.pluraliseWithCount(fileList?.length, "file")
      });
      this.setBusy();
      const allBase64Files: Base64File[] = await this.fileUtils.fileListToBase64Files(fileList);
      const checkedResults: CheckedImage[] = await Promise.all(allBase64Files.map(async file => {
        if (file.file.type === IMAGE_HEIC) {
          return await this.fileUtils.convertHEICFile(file);
        } else {
          return {file, isImage: this.urlService.isBase64Image(file.base64Content)};
        }
      }));
      this.logger.debug("checkedResults:", checkedResults);
      this.base64Files = checkedResults.filter(result => result.isImage).map(result => result.file);
      this.nonImageFiles = checkedResults.filter(result => !result.isImage).map(result => result.file);
      this.logger.info("there are", this.stringUtils.pluraliseWithCount(this.base64Files.length, "image"), "and", this.stringUtils.pluraliseWithCount(this.nonImageFiles.length, "non-image"), "non-images:", this.nonImageFiles);
      this.setBusy();
      this.imageInsert(...this.base64Files.map(item => this.fileUtils.contentMetadataItemFromBase64File(item)));
    }
  }

  public fileOver(e: any): void {
    if (!this.uploader.isUploading) {
      this.hasFileOver = e;
    }
  }

  private prepareFilesAndPerformUpload() {
    const queuedFiles: File[] = this.unsavedImages()
      .map(item => this.fileUtils.awsFileData(item.originalFileName, item.base64Content, this.fileForBase64Content(item)))
      .map(item => item.file);
    this.queuedFileCount = queuedFiles.length;
    this.uploader.clearQueue();
    this.uploader.addToQueue(queuedFiles);
    this.logger.debug("addedToQueue:", queuedFiles);
    this.uploader.uploadAll();
  }

  private unsavedImages(): ContentMetadataItem[] {
    return (this.contentMetadata?.files && this.contentMetadata.files.filter(item => this.urlService.isBase64Image(item.base64Content))) || [];
  }

  private fileForBase64Content(item: ContentMetadataItem): File {
    const file = this.base64Files.find(file => file.base64Content === item.base64Content)?.file;
    const fileFromContentMetadata = new File([base64ToFile(item.base64Content)], item.originalFileName, {
      lastModified: item.date,
      type: this.fileUtils.fileExtension(item.originalFileName)
    });
    return file || fileFromContentMetadata;
  }

  readyToSaveMetadata() {
    return this.unsavedImages().length === 0;
  }

  public async resizeSavedImages(): Promise<void> {
    await this.saveChanges();
    const contentMetadataResizeRequest: ContentMetadataResizeRequest = {
      maxFileSize: this.contentMetadata.maxImageSize,
      id: this.contentMetadata.id,
      output: this.saveToNew ? {
        name: this.contentMetadata.name + "-resized",
        rootFolder: this.contentMetadata.rootFolder
      } : null
    };
    this.setBusy();
    this.webSocketClientService.connect()
      .then(() => this.webSocketClientService.sendMessage(EventType.RESIZE_SAVED_IMAGES, contentMetadataResizeRequest))
      .catch(error => this.handleResizeError(error));
  }

  private resizeUnsavedImages(items: ContentMetadataItem[]) {
    try {
      this.logger.info("resizeUnsavedImages called with items:", items);
      if (this.contentMetadata.maxImageSize || 0 > 0 && items?.length > 0) {
        this.setBusy();
        this.notify.success({
          title: "Auto-Resizing Uploaded Files",
          message: "Processing " + this.stringUtils.pluraliseWithCount(items?.length, "file")
        });
        const contentMetadataResizeRequest: ContentMetadataResizeRequest = {
          maxFileSize: this.contentMetadata.maxImageSize,
          input: items
        };
        this.logger.info("about to sendMessage:", EventType.RESIZE_UNSAVED_IMAGES, "with data:", contentMetadataResizeRequest);
        this.webSocketClientService.connect()
          .then(() => this.webSocketClientService.sendMessage(EventType.RESIZE_UNSAVED_IMAGES, contentMetadataResizeRequest))
          .catch(error => this.handleResizeError(error));
      } else {
        this.logger.info("image list not configured for auto-resizing or no images supplied for resizing");
        this.clearBusy();
      }
    } catch (error) {
      this.handleResizeError(error);
    }
  }

  private handleResizeError(error: Error) {
    this.logger.error(error);
    this.notify.error({title: "Image Resizing failed", message: error});
  }

  private processResizeItemsResponse(resizedItems: ContentMetadataItem[]) {
    resizedItems.forEach(resizedItem => {
      const metadataItem: ContentMetadataItem = this.contentMetadata.files.find(file => file.originalFileName === resizedItem.originalFileName);
      if (metadataItem) {
        this.logger.info("received resizedItems image related to :", metadataItem?.originalFileName, "with content", this.numberUtils.humanFileSize(resizedItem.base64Content.length));
        metadataItem.base64Content = resizedItem.base64Content;
      } else {
        this.logger.warn("could not find match in metadata items for:", resizedItem);
      }
    });
    this.notify.success({
      title: "Task completed",
      message: `Resized ${this.stringUtils.pluraliseWithCount(resizedItems.length, "image")}`
    });
  }

  disabled() {
    return this.uploader.isUploading || this.notifyTarget.busy;
  }
}
