import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { faAdd, faEdit, faRemove, faSave } from "@fortawesome/free-solid-svg-icons";
import { remove } from "lodash-es";
import { FileUploader } from "ng2-file-upload";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertMessage, AlertTarget } from "../../../../models/alert-target.model";
import { AwsFileData } from "../../../../models/aws-object.model";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { RootFolder, Image, Images } from "../../../../models/system.model";
import { BroadcastService } from "../../../../services/broadcast-service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { FileUploadService } from "../../../../services/file-upload.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MemberLoginService } from "../../../../services/member/member-login.service";
import { MemberService } from "../../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { NumberUtilsService } from "../../../../services/number-utils.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { UrlService } from "../../../../services/url.service";

@Component({
  selector: "app-system-image-edit",
  templateUrl: "./system-image-edit.html",
  styleUrls: ["./system-image.sass"]
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

  constructor(private systemConfigService: SystemConfigService,
              private notifierService: NotifierService,
              private numberUtils: NumberUtilsService,
              private stringUtils: StringUtilsService,
              private memberService: MemberService,
              private memberLoginService: MemberLoginService,
              private broadcastService: BroadcastService<string>,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SystemImageEditComponent, NgxLoggerLevel.OFF);
  }

  @Input() headerLogoDefault: boolean;
  @Input() rootFolder: RootFolder;
  @Input() images: Images;
  @Input() image: Image;
  @Output() imageChanged: EventEmitter<Image> = new EventEmitter();

  ngOnInit() {
    this.logger.info("constructed with imageType:", this.rootFolder, "image:", this.image);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logoEditActive = !this.image.awsFileName;
    this.logoMode = this.rootFolder === RootFolder.logos;
  }

  throwOrNotifyError(message: AlertMessage) {
    this.logger.error("throwOrNotifyError:", message);
    this.notify.error(message);
  }

  toggleImageEditor() {
    this.logoEditActive = true;
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
  }

  imagedSaved(awsFileData: AwsFileData) {
    const logoImageSource = awsFileData.awsFileName;
    this.logger.info("imagedSaved:", awsFileData, "setting logoImageSource to", logoImageSource);
    this.image.awsFileName = logoImageSource;
    this.imageChanged.next(this.image);
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
    return this?.images?.images ? `${this?.images.images.indexOf(this.image) + 1} of ${this.images.images.length} — ${this.image.originalFileName || "New Logo"} ${this.headerLogoDefault ? " (header logo default)" : ""}` : "";
  }

  imageValid(image: Image) {
    this.logger.debug("imageValid:", image?.awsFileName,"this?.images?.rootFolder:", this?.images?.rootFolder);
    return image?.awsFileName?.startsWith(this?.images?.rootFolder);
  }
}
