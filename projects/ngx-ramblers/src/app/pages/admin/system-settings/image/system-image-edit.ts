import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faAdd, faEdit, faRemove, faSave } from "@fortawesome/free-solid-svg-icons";
import { remove } from "es-toolkit/compat";
import { FileUploader } from "ng2-file-upload";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertMessage, AlertTarget } from "../../../../models/alert-target.model";
import { AwsFileData } from "../../../../models/aws-object.model";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { Image, Images, RootFolder } from "../../../../models/system.model";
import { BroadcastService } from "../../../../services/broadcast-service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { FileUtilsService } from "../../../../file-utils.service";
import { FileTypeAttributes } from "../../../../models/content-metadata.model";
import { ImageCropperAndResizerComponent } from "../../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { FormsModule } from "@angular/forms";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgClass, NgStyle } from "@angular/common";

@Component({
    selector: "app-system-image-edit",
    template: `
      <div class="row mb-3 mt-3">
        <div class="col-md-12">
          <h5>{{ imageTitle() }}</h5>
          @if (logoEditActive) {
            <app-image-cropper-and-resizer
              [rootFolder]="images?.rootFolder"
              [preloadImage]="image.awsFileName"
              [cropperPosition]="image?.cropperPosition"
              nonDestructive
              (imageChange)="imageChange($event)"
              (cropperPositionChange)="imageCropperChange($event)"
              (quit)="exitImageEdit()"
              (apply)="exitImageEdit()"
              (save)="imagedSaved($event)">
            </app-image-cropper-and-resizer>
          }
        </div>
        <div class="col-md-6 mt-2">
          <div class="row">
            <div class="col-md-12">
              <label>Original Name</label>
              <input [(ngModel)]="image.originalFileName"
                     type="text" value="" class="form-control input-sm w-100" [id]="uniqueIdFor('originalFileName')">
            </div>
          </div>
          <div class="row mt-2">
            <div class="col-md-12">
              <label>Image Source Name</label>
              <input [(ngModel)]="image.awsFileName"
                     type="text" value="" class="form-control input-sm w-100" [id]="uniqueIdFor('awsFileName')">
            </div>
          </div>
          <div class="row mt-2">
            <div class="col-md-6">
              <div class="form-group">
                <label>Height:</label>
                <input [(ngModel)]="image.width"
                       type="number" class="form-control input-sm">
              </div>
            </div>
            <div class="col-md-6">
              <label>Padding:</label>
              <input [(ngModel)]="image.padding"
                     type="number" class="form-control input-sm">
            </div>
          </div>
          <div class="row mt-2">
            <div class="col">
              @if (logoMode) {
                <app-badge-button (click)="makeDefault()"
                                  [tooltip]="'Make ' + image.originalFileName + ' the default website logo'"
                                  [icon]="faSave" caption="Make this logo the website default"/>
              }
              <app-badge-button (click)="toggleImageEditor()"
                                [tooltip]="fileTypeAttributes?.croppable?'Edit '+image.originalFileName:image.originalFileName + ' is not editable'"
                                [icon]="faEdit" caption="Edit image" [disabled]="!fileTypeAttributes?.croppable"/>
              <app-badge-button (click)="delete()"
                                [tooltip]="headerLogoDefault?'Cant delete image that is set as the logo default':'Delete ' + image.originalFileName + ' from collection of ' + rootFolder"
                                [icon]="faRemove" [caption]="'Delete image'" [disabled]="headerLogoDefault"/>
            </div>
          </div>
        </div>
        @if (imageValid(image)) {
          <div class="col-md-6">
            <div class="row">
              <label>Image Preview</label>
            </div>
            <img [src]="imageSourceOrPreview()" [alt]="image.originalFileName"
                 [ngStyle]="imagePreviewStyles()"
                 [ngClass]="image.awsFileName.endsWith('png') ? 'image-border-png':'image-border'">
          </div>
        }
      </div>
    `,
    styleUrls: ["./system-image.sass"],
  imports: [ImageCropperAndResizerComponent, FormsModule, BadgeButtonComponent, TooltipDirective, NgClass, NgStyle]
})
export class SystemImageEditComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SystemImageEditComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private stringUtils = inject(StringUtilsService);
  private broadcastService = inject<BroadcastService<string>>(BroadcastService);
  private fileUtils = inject(FileUtilsService);
  private urlService = inject(UrlService);
  protected dateUtils = inject(DateUtilsService);
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  faAdd = faAdd;
  faSave = faSave;
  faEdit = faEdit;
  faRemove = faRemove;
  public awsFileData: AwsFileData;
  public logoEditActive: boolean;
  public uploader: FileUploader;
  public logoMode: boolean;
  protected fileTypeAttributes: FileTypeAttributes;
  @Input() headerLogoDefault: boolean;
  @Input() rootFolder: RootFolder;
  @Input() images: Images;
  @Input() image: Image;
  @Output() imageChanged: EventEmitter<Image> = new EventEmitter();
  @Input() index!: number;

  ngOnInit() {
    this.logger.debug("constructed with imageType:", this.rootFolder, "image:", this.image);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logoEditActive = !this.image.awsFileName;
    this.fileTypeAttributes = this.fileUtils.fileTypeAttributesForName(this.image.awsFileName);
    this.logoMode = this.rootFolder === RootFolder.logos;
  }

  throwOrNotifyError(message: AlertMessage) {
    this.logger.error("throwOrNotifyError:", message);
    this.notify.error(message);
  }

  toggleImageEditor() {
    if (this.fileTypeAttributes?.croppable) {
      this.logoEditActive = true;
    }
  }

  delete() {
    if (!this.headerLogoDefault) {
      remove(this.images.images, this.image);
    }
  }

  imageChange(awsFileData: AwsFileData) {
    this.logger.info("imageChanged:", awsFileData);
    this.awsFileData = awsFileData;
    if (!this.image.originalFileName) {
      this.image.originalFileName = awsFileData.file.name;
    }
    this.imageChanged.next(this.image);
  }

  exitImageEdit() {
    this.logoEditActive = false;
    this.awsFileData = null;
    if (!this.image.originalFileName && !this.image.awsFileName) {
      this.delete();
    }
  }

  imagedSaved(awsFileData: AwsFileData) {
    const logoImageSource = awsFileData.awsFileName;
    this.logger.info("imagedSaved:", awsFileData, "setting logoImageSource to", logoImageSource);
    this.image.awsFileName = logoImageSource;
    this.imageChanged.emit(this.image);
  }

  uniqueIdFor(prefix: string) {
    const uniqueIdFor = this.stringUtils.kebabCase(prefix, this.image.originalFileName || 0, this.index);
    this.logger.debug("uniqueIdFor:", prefix, "returning:", uniqueIdFor);
    return uniqueIdFor;
  }

  makeDefault() {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.DEFAULT_LOGO_CHANGED, this.image.originalFileName));
  }

  imageSourceOrPreview(): string {
    return this.urlService.imageSource(this.awsFileData?.image || this.image.awsFileName || this.image.originalFileName);
  }

  imageTitle() {
    return this?.images?.images ? `${this?.images.images.indexOf(this.image) + 1} of ${this.images.images.length} — ${this.image.originalFileName || "not named yet"} ${this.headerLogoDefault ? " (header logo default)" : ""}` : "";
  }

  imageValid(image: Image) {
    this.logger.debug("imageValid:", image?.awsFileName,"this?.images?.rootFolder:", this?.images?.rootFolder);
    return image?.awsFileName?.startsWith(this?.images?.rootFolder);
  }

  imageCropperChange(cropperPosition: any) {
    this.logger.info("imageCropperChange:", cropperPosition);
    this.image.cropperPosition = cropperPosition;
    this.imageChanged.emit(this.image);
  }

  imagePreviewStyles(): { [key: string]: string } {
    return {
      maxHeight: this.image.width ? `${this.image.width}px` : "300px",
      maxWidth: "100%",
      width: "auto",
      height: "auto",
      padding: this.image.padding ? `${this.image.padding}px` : "0"
    };
  }
}
