import { Component, Input, OnInit } from "@angular/core";
import { faAdd, faRemove, faSortAlphaAsc } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { defaultImage, Image, Images, RootFolder, SystemConfig } from "../../../../models/system.model";
import { sortBy } from "../../../../functions/arrays";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import cloneDeep from "lodash-es/cloneDeep";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { SystemImageEditComponent } from "../image/system-image-edit";

@Component({
    selector: "[app-image-collection-settings]",
    template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row img-thumbnail thumbnail-2">
        <div class="thumbnail-heading">{{ imageTypeDescription }} ({{ images?.images?.length || 0 }})</div>
        <div class="col-sm-12">
          <app-badge-button [disabled]="oneOrMoreImagesNotSaved()" [icon]="faAdd" (click)="createNewImage()"
            [tooltip]="oneOrMoreImagesNotSaved()? 'Save currently edited '+imageTypeDescription + ' first': 'Add to ' + imageTypeDescription"
            [caption]="'Add to ' + imageTypeDescription"/>
          <app-badge-button [icon]="faSortAlphaAsc" (click)="sortImages()"
            caption="Sort {{ imageTypeDescription }}"/>
        </div>
        @for (image of images?.images; track image; let imageIndex = $index) {
          <div class="col-sm-12">
            <app-system-image-edit
              [rootFolder]="rootFolder"
              [headerLogoDefault]="headerLogoDefault(image)"
              [images]="images"
              [image]="image"
              (imageChanged)="imageChanged($event, imageIndex)">
            </app-system-image-edit>
          </div>
        }
      </div>
    </div>`,
    imports: [BadgeButtonComponent, TooltipDirective, SystemImageEditComponent]
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
    if (!this.oneOrMoreImagesNotSaved()) {
      this.images.images = [cloneDeep(defaultImage)].concat(this.images.images);
    }
  }

  protected oneOrMoreImagesNotSaved() {
    return !!this.images.images.find(item => !item.awsFileName);
  }

  sortImages() {
    this.images.images = this.images.images.sort(sortBy("originalFileName"));
  }


  headerLogoDefault(image: Image): boolean {
    return this.config?.header?.selectedLogo === image?.originalFileName;
  }

  imageChanged(imageFileData: Image, imageIndex: number) {
    this.logger.info("imageChanged:imageFileData:", imageFileData, "for imageIndex:", imageIndex, "images (before change):", this.images.images);
    this.images.images = this.images.images.map((item, index) => index === imageIndex ? imageFileData : item);
    this.config[this.rootFolder] = this.images;
    this.logger.info("imageChanged:imageFileData:", imageFileData, "for imageIndex:", imageIndex, "images (after change):", this.images.images);
  }
}
