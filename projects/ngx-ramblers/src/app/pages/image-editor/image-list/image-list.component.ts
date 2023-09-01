import { Location } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import first from "lodash-es/first";
import min from "lodash-es/min";
import range from "lodash-es/range";
import { FileUploader } from "ng2-file-upload";
import { PageChangedEvent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { ALL_PHOTOS, ContentMetadata, ContentMetadataItem, ImageFilterType, IMAGES_HOME, ImageTag, RECENT_PHOTOS, S3Metadata } from "../../../models/content-metadata.model";
import { MemberResourcesPermissions } from "../../../models/member-resource.model";
import { Confirm } from "../../../models/ui-actions";
import { move, sortBy } from "../../../services/arrays";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { FileUploadService } from "../../../services/file-upload.service";
import { ImageDuplicatesService } from "../../../services/image-duplicates-service";
import { ImageTagDataService } from "../../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { RouterHistoryService } from "../../../services/router-history.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";

@Component({
  selector: "app-list-editor",
  styleUrls: ["./image-list.component.sass"],
  templateUrl: "./image-list.component.html"
})
export class ImageListComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public notify: AlertInstance;
  public warnings: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public warningTarget: AlertTarget = {};
  public confirm = new Confirm();
  public destinationType: string;
  public imageSource: string;
  public filterType: ImageFilterType;
  public eventFilter: string;
  public uploader: FileUploader;
  public contentMetadata: ContentMetadata;
  public s3Metadata: S3Metadata[] = [];
  public filteredFiles: ContentMetadataItem[] = [];
  public changedItems: ContentMetadataItem[] = [];
  public currentPageImages: ContentMetadataItem[] = [];
  public allow: MemberResourcesPermissions = {};
  public showDuplicates = false;
  public toggled: boolean;
  public filterText: string;
  public hasFileOver = false;
  public currentImageIndex: number;
  private searchChangeObservable = new Subject<string>();
  public pageNumber = 1;
  private pageCount: number;
  private pageSize = 10;
  private pages: number[];
  private subscriptions: Subscription[] = [];
  public tags: number[];
  public manageTags: false;

  constructor(private stringUtils: StringUtilsService,
              public imageTagDataService: ImageTagDataService,
              public numberUtils: NumberUtilsService,
              private router: Router,
              private imageDuplicatesService: ImageDuplicatesService,
              private committeeQueryService: CommitteeQueryService,
              private contentMetadataService: ContentMetadataService,
              private siteEditService: SiteEditService,
              private authService: AuthService,
              private location: Location,
              private notifierService: NotifierService,
              private fileUploadService: FileUploadService,
              private route: ActivatedRoute,
              private memberLoginService: MemberLoginService,
              public dateUtils: DateUtilsService,
              private routerHistoryService: RouterHistoryService,
              private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ImageListComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    this.warnings = this.notifierService.createAlertInstance(this.warningTarget);
    this.destinationType = "";
    this.filterType = ImageFilterType.RECENT;
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.contentMetadataService.s3Notifications().subscribe(data => this.logger.debug("contentMetadataService.notifications.s3:", data)));
    this.subscriptions.push(this.contentMetadataService.contentMetadataNotifications().subscribe(data => this.logger.debug("contentMetadataService.notifications.contentMetadataNotifications:", data)));
    this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const imageSource = paramMap.get("image-source");
      if (imageSource) {
        this.imageSource = imageSource;
        this.logger.debug("imageSource from route params:", this.imageSource);
        this.refreshImageMetaData(this.imageSource);
        this.uploader = this.fileUploadService.createUploaderFor(imageSource);
        this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
            this.logger.info("response", response, "type", typeof response);
            this.notify.clearBusy();
            if (response instanceof HttpErrorResponse) {
              this.notify.error({title: "Upload failed", message: response.error});
            } else if (response === "Unauthorized") {
              this.notify.error({title: "Upload failed", message: response + " - try logging out and logging back in again and trying this again."});
            } else {
              const uploadResponse = JSON.parse(response);
              const contentMetadataItem: ContentMetadataItem = this.contentMetadata.files[this.currentImageIndex];
              this.logger.debug("image path prior to upload:", contentMetadataItem?.image);
              contentMetadataItem.image = this.contentMetadataService.baseUrl(this.imageSource) + "/" + uploadResponse.response.fileNameData.awsFileName;
              this.logger.debug("JSON response:", uploadResponse, "current contentMetadataItem[" + this.currentImageIndex + "]:", contentMetadataItem);
              this.logger.debug("image path at index position", this.currentImageIndex, "after upload:", contentMetadataItem?.image);
              this.notify.clearBusy();
              this.notify.success({title: "New file added", message: uploadResponse.response.fileNameData.title});
            }
          }, (error) => {
            this.notify.error({title: "Upload failed", message: error});
          }
        );
      }
    });
    this.subscriptions.push(this.imageTagDataService.selectedTag().subscribe((tag: ImageTag) => {
      this.logger.debug(tag, "selectedTag().subscribe");
      if (tag) {
        if (tag === RECENT_PHOTOS) {
          this.filterType = ImageFilterType.RECENT;
        } else if (tag === ALL_PHOTOS) {
          this.filterType = ImageFilterType.ALL;
        } else {
          this.filterType = ImageFilterType.TAG;
        }
      }
      this.applyFilter();
    }));
    this.applyFilter();
    this.subscriptions.push(this.imageTagDataService.imageTags()
      .subscribe((imageTags: ImageTag[]) => {
        if (this.contentMetadata) {
          this.contentMetadata.imageTags = imageTags.filter(tag => tag.key > 0);
          this.logger.debug("received imageTags:", imageTags, "contentMetadata imageTags:", this.contentMetadata.imageTags);
        }
      }));
    this.applyAllowEdits();
    this.searchChangeObservable.pipe(debounceTime(500))
      .pipe(distinctUntilChanged())
      .subscribe(() => this.applyFilter());
  }

  pageChanged(event: PageChangedEvent): void {
    this.logger.debug("event:", event);
    this.goToPage(event.page);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  insertToEmptyList() {
    this.logger.debug("inserting image  with filteredFiles:", this.filteredFiles);
    const newItem: ContentMetadataItem = {date: this.dateUtils.momentNow().valueOf(), dateSource: "upload", tags: []};
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
    const filteredImageCount = this.filteredFiles.length;
    this.currentPageImages = this.paginate(this.filteredFiles, this.pageSize, this.pageNumber) || [];
    this.logger.debug("applyPagination: filtered image count", filteredImageCount, "filtered image count", filteredImageCount, "current page image count", this.currentPageImages.length, "pageSize:", this.pageSize, "pageCount", this.pageCount, "pages", this.pages);
    if (this.currentPageImages.length === 0) {
      this.notify.progress("No images found");
    } else {
      const offset = (this.pageNumber - 1) * this.pageSize + 1;
      const pageIndicator = this.pages.length > 1 ? `Page ${this.pageNumber} of ${this.pageCount}` : `Page ${this.pageNumber}`;
      const toNumber = min([offset + this.pageSize - 1, filteredImageCount]);
      this.notify.progress(`${pageIndicator}  — showing ${offset} to ${toNumber} of ${this.stringUtils.pluraliseWithCount(filteredImageCount, "image")}`);
    }
  }

  onFileSelect($file: File[]) {
    if ($file) {
      this.notify.setBusy();
      this.notify.progress({title: "Image upload", message: `uploading ${first($file).name} - please wait...`});
    }
  }

  public fileOver(): void {
    this.hasFileOver = true;
    this.logger.debug("hasFileOver:", this.hasFileOver);
  }

  fileDropped($event: File[]) {
    this.logger.debug("fileDropped:", $event);
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  filterByTag(tagSubject: string) {
    this.logger.debug("filterByTag:tagSubject:", tagSubject);
    this.imageTagDataService.select(tagSubject);
    this.applyFilter();
  }

  applyFilter() {
    this.logger.debug("applyFilters start:", this.filteredFiles?.length, "of", this.contentMetadata?.files?.length, "files", "tag:", this.imageTagDataService.activeTag, "showDuplicates:", this.showDuplicates, "filterText:", this.filterText);
    this.filterFiles();
    this.pageCount = this.calculatePageCount();
    this.applyPagination();
    this.imageDuplicatesService.populateFrom(this.contentMetadata, this.filteredFiles);
    this.logger.debug("applyFilters finished:", this.filteredFiles?.length, "of", this.contentMetadata?.files?.length, "files", "tag:", this.imageTagDataService.activeTag, "showDuplicates:", this.showDuplicates, "filterText:", this.filterText);
    this.alertWarnings();
  }

  private filterFiles() {
    this.filteredFiles = this.contentMetadataService.filterSlides(this.contentMetadata?.files, this.filterType, this.imageTagDataService.activeTag, this.showDuplicates, this.filterText) || [];
  }

  refreshImageMetaData(imageSource: string) {
    this.notify.setBusy();
    this.imageSource = imageSource;
    this.urlService.navigateUnconditionallyTo("image-editor", imageSource);
    this.logger.debug("promise all started for imageSource:", imageSource);
    return Promise.all([
        this.contentMetadataService.items(imageSource)
          .then((contentMetaData: ContentMetadata) => {
            this.logger.debug("contentMetaData:", contentMetaData);
            this.contentMetadata = contentMetaData;
            this.imageTagDataService.populateFrom(contentMetaData.imageTags);
            this.logger.debug("this.contentMetadataService.items:return true:");
            return true;
          }),
        this.contentMetadataService.listMetaData(imageSource)
          .then((s3Metadata: S3Metadata[]) => {
            this.s3Metadata = s3Metadata;
            this.logger.debug("this.contentMetadataService.listMetaData:return true:");
            return true;
          })
      ]
    )
      .then((response) => {
        this.logger.debug("promise all for:", imageSource, "resolved to:", response);
        this.contentMetadata.files = this.contentMetadata.files.map(file => {
          return {
            ...file,
            date: this.fileDate(file),
            dateSource: file.dateSource || "upload"
          };
        });
        this.applyFilter();
        this.logger.debug("refreshImageMetaData:imageSource", imageSource, "returning", this.contentMetadata.files.length, "ContentMetadataItem items");
        this.notify.clearBusy();
      })
      .catch(response => this.notify.error({title: "Failed to refresh images", message: response}));
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

  sortByDate() {
    this.contentMetadata.files = this.contentMetadata.files.sort(sortBy("-date"));
    this.applyFilter();
  }

  imageTitleLength() {
    if (this.imageSource === IMAGES_HOME) {
      return 50;
    } else {
      return 20;
    }
  }

  saveChangeAndExit() {
    this.saveChanges()
      .then(() => {
        this.exitBackToPreviousWindow();
      }).catch(response => this.notify.error({title: "Failed to save images", message: response}));
  }

  saveChanges() {
    return this.contentMetadataService.createOrUpdate(this.contentMetadata)
      .catch(response => this.notify.error({title: "Failed to save images", message: response}));
  }

  public exitBackToPreviousWindow() {
    this.routerHistoryService.navigateBackToLastMainPage(true);
  }

  applyAllowEdits() {
    this.allow.edit = this.memberLoginService.allowContentEdits();
  }

  saveOrUpdateSuccessful() {
    this.notify.success("data for" + this.contentMetadata.files.length + " images was saved successfully.");
  }

  moveUp(item: ContentMetadataItem) {
    const currentIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (this.contentMetadataService.canMoveUp(this.contentMetadata.files, item)) {
      move(this.contentMetadata.files, currentIndex, currentIndex - 1);
      this.logger.debug("moved up item with index", currentIndex, "to", this.contentMetadataService.findIndex(this.contentMetadata.files, item), "in total of", this.contentMetadata.files.length, "items");
      this.applyFilter();
    } else {
      this.logger.warn("cant move up item with index", currentIndex);
    }
  }

  moveDown(item: ContentMetadataItem) {
    const currentIndex = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (this.contentMetadataService.canMoveDown(this.contentMetadata.files, item)) {
      move(this.contentMetadata.files, currentIndex, currentIndex + 1);
      this.logger.debug("moved down item with index", currentIndex, "to", this.contentMetadataService.findIndex(this.contentMetadata.files, item), "for item", item.text, "in total of", this.contentMetadata.files.length, "items");
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
    this.logger.debug("delete:before count", this.contentMetadata.files.length, "item:", item);
    const index = this.contentMetadataService.findIndex(this.contentMetadata.files, item);
    if (index >= 0) {
      this.contentMetadata.files.splice(index, 1);
      this.logger.debug("delete:after count", this.contentMetadata.files.length);
      this.applyFilter();
    } else {
      this.logger.warn("cant delete", item);
    }
    return this.contentMetadataService.findIndex(this.contentMetadata.files, item);
  }

  imageEdit(item: ContentMetadataItem) {
    this.addToChangedItems(item);
  }

  imageInsert(item: ContentMetadataItem) {
    this.logger.debug("insert:new item", item, "before:", this.contentMetadata.files);
    this.contentMetadata.files.splice(0, 0, item);
    this.logger.debug("insert:new item", item, "after:", this.contentMetadata.files);
    this.addToChangedItems(item);
  }

  alertWarnings() {
    if (this.changedItems.length > 0) {
      this.warnings.warning({title: "Unsaved Changes", message: this.alertText()});
    } else {
      this.warnings.hide();
    }
  }

  selectableTags(): ImageTag[] {
    return this.contentMetadata.imageTags;
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

  private addToChangedItems(item: ContentMetadataItem) {
    if (!this.changedItems.includes(item)) {
      this.logger.debug("addToChangedItems:", item);
      this.changedItems.push(item);
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
    return `Save or quit ${this.stringUtils.pluraliseWithCount(this.changedItems.length, "image")} before saving`;
  }

  newImageCaption() {
    return `No images exist for ${this.imageSource} - initialise images`;
  }
}
