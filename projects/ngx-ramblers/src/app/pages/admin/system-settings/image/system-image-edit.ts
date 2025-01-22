import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { faAdd, faEdit, faRemove, faSave } from "@fortawesome/free-solid-svg-icons";
import { remove } from "lodash-es";
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

@Component({
  selector: "app-system-image-edit",
  templateUrl: "./system-image-edit.html",
  styleUrls: ["./system-image.sass"],
  standalone: false
})
export class SystemImageEditComponent implements OnInit {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  faAdd = faAdd;
  faSave = faSave;
  faEdit = faEdit;
  faRemove = faRemove;
  public awsFileData: AwsFileData;
  public logoEditActive: boolean;
  public uploader: FileUploader;
  public logoMode: boolean;
  protected fileTypeAttributes: FileTypeAttributes;

  constructor(private notifierService: NotifierService,
              private stringUtils: StringUtilsService,
              private broadcastService: BroadcastService<string>,
              private fileUtils: FileUtilsService,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SystemImageEditComponent, NgxLoggerLevel.ERROR);
  }

  @Input() headerLogoDefault: boolean;
  @Input() rootFolder: RootFolder;
  @Input() images: Images;
  @Input() image: Image;
  @Output() imageChanged: EventEmitter<Image> = new EventEmitter();

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
    remove(this.images.images, this.image);
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
    const uniqueIdFor = this.stringUtils.kebabCase(prefix, this.image.originalFileName || 0);
    this.logger.debug("uniqueIdFor:", prefix, "returning:", uniqueIdFor);
    return uniqueIdFor;
  }

  makeDefault() {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.DEFAULT_LOGO_CHANGED, this.image.originalFileName));
  }

  imageSourceOrPreview(): string {
    return this.urlService.imageSource(this.awsFileData?.image || this.image.awsFileName || this.image.originalFileName);
  }

  logoTitle() {
    return this?.images?.images ? `${this?.images.images.indexOf(this.image) + 1} of ${this.images.images.length} — ${this.image.originalFileName || "not named yet"} ${this.headerLogoDefault ? " (header logo default)" : ""}` : "";
  }

  imageValid(image: Image) {
    this.logger.debug("imageValid:", image?.awsFileName,"this?.images?.rootFolder:", this?.images?.rootFolder);
    return image?.awsFileName?.startsWith(this?.images?.rootFolder);
  }
}
