import { Component, Input, OnInit } from "@angular/core";
import { faAdd, faRemove, faSortAlphaAsc } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { Image, Images, RootFolder, SystemConfig } from "../../../../models/system.model";
import { sortBy } from "../../../../functions/arrays";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";

@Component({
  selector: "[app-image-collection-settings]",
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row img-thumbnail thumbnail-2">
        <div class="thumbnail-heading">{{ imageTypeDescription }} ({{ images?.images?.length || 0 }})</div>
        <div class="col-sm-12">
          <div class="badge-button mb-2" (click)="createNewImage()"
               delay=500 tooltip="Add new link">
            <fa-icon [icon]="faAdd"></fa-icon>
            <span>Add to {{ imageTypeDescription }}</span>
          </div>
          <div class="badge-button mb-2" (click)="sortImages()"
               delay=500 tooltip="Add new link">
            <fa-icon [icon]="faSortAlphaAsc"></fa-icon>
            <span>Sort {{ imageTypeDescription }}</span>
          </div>
        </div>
        <div class="col-sm-12" *ngFor="let image of images?.images; let imageIndex = index;">
          <app-system-image-edit
            [rootFolder]="rootFolder"
            [headerLogoDefault]="headerLogoDefault(image)"
            [images]="images"
            [image]="image"
            (imageChanged)="imageChanged($event, imageIndex)">
          </app-system-image-edit>
        </div>
      </div>
    </div>`
})
export class ImageCollectionSettingsComponent implements OnInit {
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  faAdd = faAdd;
  faSortAlphaAsc = faSortAlphaAsc;
  faRemove = faRemove;
  public imageTypeDescription: string;

  constructor(private systemConfigService: SystemConfigService,
              public stringUtils: StringUtilsService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ImageCollectionSettingsComponent, NgxLoggerLevel.OFF);
  }

  @Input() rootFolder: RootFolder;
  @Input() images: Images;
  @Input() config: SystemConfig;

  ngOnInit() {
    this.logger.info("constructed with:imageType:", this.rootFolder, "images:", this.images);
    this.imageTypeDescription = this.stringUtils.asTitle(this.rootFolder);
    if (!this.images) {
      this.images = this.systemConfigService.defaultImages(this.rootFolder);
    }
  }

  createNewImage() {
    this.images.images.splice(0, 0, {padding: 16, width: 150, originalFileName: null, awsFileName: null});
  }

  sortImages() {
    this.images.images = this.images.images.sort(sortBy("originalFileName"));
  }


  headerLogoDefault(image: Image): boolean {
    return this.config.header.selectedLogo === image.originalFileName;
  }

  imageChanged(imageFileData: Image, imageIndex: number) {
    this.logger.info("imageChanged:imageFileData:", imageFileData, "for imageIndex:", imageIndex, "images (before change):", this.images.images);
    this.images.images = this.images.images.map((item, index) => index === imageIndex ? imageFileData : item);
    this.config[this.rootFolder] = this.images;
    this.logger.info("imageChanged:imageFileData:", imageFileData, "for imageIndex:", imageIndex, "images (after change):", this.images.images);
  }
}
