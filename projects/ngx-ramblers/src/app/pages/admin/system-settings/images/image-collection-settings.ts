import { Component, inject, Input, OnInit } from "@angular/core";
import { faAdd, faPaste, faRemove, faSortAlphaAsc } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
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
import { CopyIconComponent } from "../../../../modules/common/copy-icon/copy-icon";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

@Component({
    selector: "[app-image-collection-settings]",
    template: `
      <div class="img-thumbnail thumbnail-admin-edit">
        <div class="row img-thumbnail thumbnail-2">
          <div class="thumbnail-heading">{{ imageTypeDescription }} ({{ images?.images?.length || 0 }})</div>
          <div class="col-sm-12">
            @if (pasteActive) {
              <div class="form-group">
                <label for="paste-field">File Type</label>
                <input id="paste-field" type="text"
                       class="form-control input-sm"
                       placeholder="Enter Pasted content for {{imageTypeDescription}}" [(ngModel)]="pasteField"
                       (ngModelChange)="transformPastedContent($event)"/>
              </div>
            }
            <app-badge-button [disabled]="oneOrMoreImagesNotSaved()" [icon]="faAdd" (click)="createNewImage()"
                              [tooltip]="oneOrMoreImagesNotSaved()? 'Save currently edited '+imageTypeDescription + ' first': 'Add to ' + imageTypeDescription"
                              [caption]="'Add to ' + imageTypeDescription"/>
            <app-badge-button [icon]="faSortAlphaAsc" (click)="sortImages()" caption="Sort {{ imageTypeDescription }}"/>
            <app-badge-button [icon]="faPaste" (click)="activatePaste()"
                              caption="Paste {{ imageTypeDescription }} data from clipboard"/>
            <app-copy-icon title [value]="JSON.stringify(images.images)"
                           elementName="These  {{stringUtils.pluraliseWithCount(images.images.length, imageTypeDescription.slice(0, -1))}}"/>
          </div>
          @for (image of images?.images; track image.awsFileName; let imageIndex = $index) {
            <div class="col-sm-12">
              <app-system-image-edit
                [index]="imageIndex"
                [rootFolder]="rootFolder"
                [headerLogoDefault]="headerLogoDefault(image)"
                [images]="images"
                [image]="image"
                (imageChanged)="imageChanged($event, imageIndex)"/>
            </div>
          }
        </div>
      </div>`,
  imports: [BadgeButtonComponent, TooltipDirective, SystemImageEditComponent, CopyIconComponent, ReactiveFormsModule, FormsModule]
})
export class ImageCollectionSettingsComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("ImageCollectionSettingsComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  stringUtils = inject(StringUtilsService);
  protected dateUtils = inject(DateUtilsService);
  faAdd = faAdd;
  faSortAlphaAsc = faSortAlphaAsc;
  faRemove = faRemove;
  public imageTypeDescription: string;
  public pasteActive: boolean;
  @Input() rootFolder: RootFolder;
  @Input() images: Images;
  @Input() config: SystemConfig;

  protected readonly JSON = JSON;
  protected readonly faPaste = faPaste;
  public pasteField: string;

  ngOnInit() {
    this.logger.info("constructed with:imageType:", this.rootFolder, "images:", this.images, "config:", this.config);
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

  activatePaste() {
    this.pasteActive = true;
  }

  transformPastedContent($event: string) {
    try {
      this.images.images = JSON.parse($event) as Image[];
      this.pasteActive = false;
    } catch (e) {
      this.logger.error("Failed to parse pasted content as JSON", $event, e);
    }
  }
}
