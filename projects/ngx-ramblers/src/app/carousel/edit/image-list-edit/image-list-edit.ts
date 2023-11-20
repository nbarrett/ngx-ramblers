import { HttpErrorResponse } from "@angular/common/http";
import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import min from "lodash-es/min";
import range from "lodash-es/range";
import { FileUploader } from "ng2-file-upload";
import { PageChangedEvent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  faAdd,
  faEraser,
  faFile,
  faPencil,
  faRemove,
  faSave,
  faSortNumericDown,
  faSortNumericUp,
  faTags,
  faUndo
} from "@fortawesome/free-solid-svg-icons";

import {
  ALL_PHOTOS,
  Base64File,
  ContentMetadata,
  ContentMetadataItem,
  DuplicateImages,
  ImageFilterType,
  ImageTag,
  RECENT_PHOTOS,
  S3Metadata
} from "../../../models/content-metadata.model";
import { MemberResourcesPermissions } from "../../../models/member-resource.model";
import { Confirm, StoredValue } from "../../../models/ui-actions";
import { move, sortBy } from "../../../services/arrays";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { ImageDuplicatesService } from "../../../services/image-duplicates-service";
import { ImageTagDataService } from "../../../services/image-tag-data-service";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { RootFolder } from "../../../models/system.model";
import {
  AwsFileUploadResponse,
  AwsFileUploadResponseData,
  DescribedDimensions
} from "../../../models/aws-object.model";
import { FileUtilsService } from "../../../file-utils.service";
import { base64ToFile } from "ngx-image-cropper";

@Component({
  selector: "app-image-list-edit",
  styleUrls: ["./image-list-edit.sass"],
  templateUrl: "./image-list-edit.html"
})
export class ImageListEditComponent implements OnInit, OnDestroy {

  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public imageTagDataService: ImageTagDataService = inject(ImageTagDataService);
  public numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public fileUtils: FileUtilsService = inject(FileUtilsService);
  private imageDuplicatesService: ImageDuplicatesService = inject(ImageDuplicatesService);
  private contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private notifierService: NotifierService = inject(NotifierService);
  private fileUploadService: FileUploadService = inject(FileUploadService);
  private memberLoginService: MemberLoginService = inject(MemberLoginService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  private urlService: UrlService = inject(UrlService);
  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("ImageListEditComponent", NgxLoggerLevel.OFF);

  @Input()
  name: string;
  @Output() exit: EventEmitter<ContentMetadata> = new EventEmitter();

  private queuedFileCount = 0;
  public duplicateImages: DuplicateImages;
  public base64Files: Base64File[] = [];
  public activeTag: ImageTag;
  private story: string;
  public notify: AlertInstance;
  public warnings: AlertInstance;
  public notifyTarget: AlertTarget = {};
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


  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
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
      if (name) {
        this.name = name;
        this.initialiseImageList();
      } else if (this.name) {
        this.initialiseImageList();
      }
    }));
    this.applyFilter();
    this.applyAllowEdits();
    this.searchChangeObservable.pipe(debounceTime(500))
      .pipe(distinctUntilChanged())
      .subscribe(() => this.applyFilter());
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
    const tag = this.imageTagDataService.findTag(this.contentMetadata?.imageTags, this.story);
    this.logger.info("received story parameter:", this.story, "setting activeTag to:", tag);
    this.activeTag = tag;
    if (tag) {
      this.imageTagDataService.updateUrlWith(tag);
      this.tagSelected(tag);
      this.applyFilter();
    }
  }

  private initialiseImageList() {
    this.logger.debug("name from route params:", this.name);
    this.refreshImageMetaData(this.name);
    this.uploader = this.fileUploadService.createUploaderFor(RootFolder.carousels + "/" + this.name, false);
    this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
        const awsFileUploadResponse: AwsFileUploadResponse = this.fileUploadService.handleAwsFileUploadResponse(response, this.notify, this.logger);
        this.logger.info("received awsFileUploadResponse:", awsFileUploadResponse);
        if (awsFileUploadResponse.errors.length > 0) {
          this.notify.error({title: "File upload failed", message: awsFileUploadResponse.errors});
        } else {
          const responses: AwsFileUploadResponseData[] = awsFileUploadResponse.responses;
          if (responses.length > 0) {
            this.notify.success({
              title: "File upload success",
              message: `${this.stringUtils.pluraliseWithCount(responses.length, "file")} ${this.stringUtils.pluraliseWithCount(responses.length, "was", "were")} uploaded`
            });
            const matches = responses.map(response => {
              const metadataItem: ContentMetadataItem = this.contentMetadata.files.find(item => item.originalFileName === response.uploadedFile.originalname);
              if (metadataItem) {
                metadataItem.image = response.fileNameData.awsFileName;
                delete metadataItem.base64Content;
                this.logger.info("matched image :", metadataItem?.originalFileName, "with aws file", response.fileNameData.awsFileName);
                return metadataItem;
              } else {
                this.logger.warn("could not find match in metadata items for:", response);
                return null;
              }
            }).filter(item => item);
            if (matches.length === responses.length) {
              if (this.uploader.progress < 100) {
                this.logger.info("uploader is still uploading with", this.stringUtils.pluraliseWithCount(this.uploader.queue.length, "queued item"), "remaining");
                this.alertWarnings();
              } else {
                const message = this.stringUtils.pluraliseWithCount(responses.length, "saved file") + " were matched to currently viewed images that have been uploaded";
                const title = "File upload success";
                this.logger.info(title, message);
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
                    message: `Save cannot take place as out of the ${this.stringUtils.pluraliseWithCount(this.queuedFileCount, "saved file")}), ${this.unsavedImages().length} appear to not have been saved`
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

  filterByTag(tagSubject: string) {
    this.logger.debug("filterByTag:tagSubject:", tagSubject);
    this.imageTagDataService.select(this.contentMetadata?.imageTags, tagSubject);
    this.applyFilter();
  }

  applyFilter() {
    this.logger.debug("applyFilters start:", this.filteredFiles?.length, "of", this.contentMetadata?.files?.length, "files", "tag:", this.activeTag, "showDuplicates:", this.showDuplicates, "filterText:", this.filterText);
    this.filterFiles();
    this.pageCount = this.calculatePageCount();
    this.applyPagination();
    this.duplicateImages = this.imageDuplicatesService.populateFrom(this.contentMetadata, this.filteredFiles);
    this.alertWarnings();
  }

  private filterFiles() {
    this.filteredFiles = this.contentMetadataService.filterSlides(this.contentMetadata?.imageTags, this.contentMetadata?.files, this.duplicateImages, this.filterType, this.activeTag, this.showDuplicates, this.filterText) || [];
  }

  refreshImageMetaData(name: string) {
    this.notify.setBusy();
    this.name = name;
    this.logger.info("image metadata refresh started for name:", name);
    const metadataPrefix = this.contentMetadataService.rootFolderAndName(RootFolder.carousels, this.name);
    return Promise.all([
        this.contentMetadataService.items(RootFolder.carousels, this.name)
          .then((contentMetaData: ContentMetadata) => {
            this.logger.info("contentMetaData:", contentMetaData);
            this.contentMetadata = contentMetaData;
            this.logger.info("this.contentMetadataService:returned:", contentMetaData);
          }),
        this.contentMetadataService.listMetaData(metadataPrefix)
          .then((s3Metadata: S3Metadata[]) => {
            this.s3Metadata = s3Metadata;
            this.logger.info("listMetaData:metadataPrefix:", metadataPrefix, "returned:", s3Metadata);
          })
      ]
    )
      .then(() => {
        this.logger.info("metadata query complete for:", this.name);
        this.postMetadataRetrieveMapping();
      })
      .catch(response => this.notify.error({title: "Failed to refresh images", message: response}));
  }

  private postMetadataRetrieveMapping() {
    if (this.contentMetadata.files) {
      this.contentMetadata.files = this.contentMetadata.files.map(file => {
        return {
          ...file,
          date: this.fileDate(file),
          dateSource: file.dateSource || "upload"
        };
      });
    } else {
      this.logger.info("no data exists for:", this.name);
    }
    this.logger.debug("refreshImageMetaData:name", this.name, "returning", this.contentMetadata?.files?.length, "ContentMetadataItem items");
    this.base64Files = [];
    this.applyFilter();
    this.notify.clearBusy();
  }

  fileDate(file: ContentMetadataItem): number {
    if (!file.date && !this.s3Metadata) {
      this.logger.warn("cant find date for", file);
    }
    const fileDate = file.date || this.s3Metadata?.find(metadata => file.image.includes(metadata.key))?.lastModified;
    this.logger.debug("fileDate:", fileDate, "original file.date", file.date);
    return fileDate;
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
    return this.contentMetadataService.createOrUpdate(this.contentMetadata)
      .then((savedContent: ContentMetadata) => {
        this.saveOrUpdateSuccessful();
        this.contentMetadata = savedContent;
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
    return this.refreshImageMetaData(this.name)
      .catch(response => this.notify.error({title: "Failed to undo changes", message: response}));
  }

  applyAllowEdits() {
    this.allow.edit = this.memberLoginService.allowContentEdits();
  }

  saveOrUpdateSuccessful() {
    this.notify.success(`${`${this.stringUtils.pluraliseWithCount(this.contentMetadata?.files?.length, "image")} ${this.stringUtils.pluralise(this.contentMetadata?.files?.length, "was", "were")}`} saved successfully`);
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

  imagedSavedOrReverted(item: ContentMetadataItem) {
    this.logger.debug("imagedSavedOrReverted:item.image", item.image);
    this.removeFromChangedItems(item);
    if (!item.image) {
      this.contentMetadata.files = this.contentMetadata.files.filter(changedItem => changedItem !== item);
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
    this.logger.info("delete:before count", this.contentMetadata?.files?.length, "item:", item);
    const index = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (index >= 0) {
      this.contentMetadata.files.splice(index, 1);
      this.logger.debug("delete:after count", this.contentMetadata?.files?.length);
      this.applyFilter();
    } else {
      this.logger.warn("cant delete", item);
    }
    return this.contentMetadataService.findIndex(this.contentMetadata.files, item);
  }

  imageEdit(item: ContentMetadataItem) {
    this.addToChangedItems(item);
  }

  imageInsert(...items: ContentMetadataItem[]) {
    this.logger.debug("insert:new items", items, "before:", this.contentMetadata.files);
    if (this.contentMetadata.files) {
      this.contentMetadata.files.splice(0, 0, ...items);
    } else {
      this.contentMetadata.files = items;
    }

    this.logger.debug("insert:new items", items, "after:", this.contentMetadata.files);
    this.addToChangedItems(...items);
  }

  alertWarnings() {
    if (this.unsavedImages().length > 0) {
      this.warnings.warning({title: "Unsaved Changes", message: this.alertText()});
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
    return `You have ${this.stringUtils.pluraliseWithCount(this.unsavedImages()?.length, "unsaved image")}`;
  }

  toggleManageTags() {
    this.manageTags = !this.manageTags;
  }

  browseToFile(fileElement: HTMLInputElement) {
    if (!this.uploader.isUploading) {
      fileElement.click();
    }
  }

  async onFileDropped(fileList: any) {
    if (!this.uploader.isUploading) {
      this.notify.success({
        title: "Uploading Files",
        message: "Processing " + this.stringUtils.pluraliseWithCount(fileList?.length, "image")
      });
      this.base64Files = await this.fileUtils.fileListToBase64Files(fileList);
      this.logger.info("filesDropped:", fileList);
      this.notify.setBusy();
      this.imageInsert(...this.base64Files.map(item => this.fileUtils.contentMetadataItemFromBase64File(item)));
      this.notify.clearBusy();
    }
  }

  public fileOver(e: any): void {
    if (!this.uploader.isUploading) {
      this.hasFileOver = e;
    }
  }

  onFileSelect(fileList: any) {
    this.logger.info("onFileSelect:files:", fileList);
    this.onFileDropped(fileList);
  }

  private prepareFilesAndPerformUpload() {
    const queuedFiles: File[] = this.unsavedImages()
      .map(item => this.fileUtils.awsFileData(item.originalFileName, item.base64Content, this.fileForBase64Content(item)))
      .map(item => item.file);
    this.queuedFileCount = queuedFiles.length;
    this.uploader.clearQueue();
    this.uploader.addToQueue(queuedFiles);
    this.logger.info("addedToQueue:", queuedFiles);
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
}
