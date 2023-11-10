import { HttpErrorResponse } from "@angular/common/http";
import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import {
  faArrowRightArrowLeft,
  faClose,
  faCompress,
  faExpand,
  faFile,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faRedoAlt, faRemove,
  faRotateLeft,
  faRotateRight,
  faSave,
  faUpDown
} from "@fortawesome/free-solid-svg-icons";
import first from "lodash-es/first";
import { FileUploader } from "ng2-file-upload";
import {
  base64ToFile,
  Dimensions,
  ImageCroppedEvent,
  ImageCropperComponent,
  ImageTransform,
  LoadedImage,
  OutputFormat
} from "ngx-image-cropper";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FileUtilsService } from "../file-utils.service";
import { AlertMessage, AlertTarget } from "../models/alert-target.model";
import {
  AwsFileData,
  AwsFileUploadResponse,
  AwsUploadErrorResponse,
  DescribedDimensions,
  FileNameData,
  ImageData,
  SelectedDescribedDimensions
} from "../models/aws-object.model";
import { DateValue } from "../models/date.model";
import { BroadcastService } from "../services/broadcast-service";
import { FileUploadService } from "../services/file-upload.service";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../services/notifier.service";
import { NumberUtilsService } from "../services/number-utils.service";
import { UrlService } from "../services/url.service";
import { RootFolder } from "../models/system.model";

@Component({
  selector: "app-image-cropper-and-resizer",
  templateUrl: "./image-cropper-and-resizer.html",
  styleUrls: ["./image-cropper-and-resizer.sass"]
})

export class ImageCropperAndResizerComponent implements OnInit, AfterViewInit, OnDestroy {

  constructor(private broadcastService: BroadcastService<any>, private numberUtils: NumberUtilsService,
              private fileUploadService: FileUploadService,
              private urlService: UrlService,
              private notifierService: NotifierService,
              private fileUtils: FileUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ImageCropperAndResizerComponent, NgxLoggerLevel.OFF);
  }

  private subscriptions: Subscription[] = [];

  @ViewChild(ImageCropperComponent) imageCropperComponent: ImageCropperComponent;
  @Input() selectAspectRatio: string;
  @Input() preloadImage: string;
  @Input() rootFolder: string;
  @Output() quit: EventEmitter<void> = new EventEmitter();
  @Output() cropError: EventEmitter<ErrorEvent> = new EventEmitter();
  @Output() save: EventEmitter<AwsFileData> = new EventEmitter();
  @Output() imageChange: EventEmitter<AwsFileData> = new EventEmitter();
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  canvasRotation = 0;
  rotation = 0;
  scale = 1;
  containWithinAspectRatio = true;
  transform: ImageTransform = {};
  private logger: Logger;
  public fileNameData: FileNameData;
  public hasFileOver = false;
  public eventDate: DateValue;
  private existingTitle: string;
  public uploader: FileUploader;
  public aspectRatio: number;

  faClose = faClose;
  faSave = faSave;
  faRotateRight = faRotateRight;
  faRotateLeft = faRotateLeft;
  faRedoAlt = faRedoAlt;
  faMagnifyingGlassMinus = faMagnifyingGlassMinus;
  faMagnifyingGlassPlus = faMagnifyingGlassPlus;
  faArrowRightArrowLeft = faArrowRightArrowLeft;
  faUpDown = faUpDown;
  faCompress = faCompress;
  faExpand = faExpand;
  faFile = faFile;
  action: string;
  maintainAspectRatio: boolean;
  imageQuality = 80;
  public dimension: DescribedDimensions;
  public originalFile: File;
  public croppedFile: AwsFileData;
  public originalImageData: ImageData;

  protected readonly faRemove = faRemove;


  static isAwsUploadResponse(response: AwsFileUploadResponse | AwsUploadErrorResponse): response is AwsFileUploadResponse {
    return (response as AwsFileUploadResponse)?.response !== undefined;
  }

  static isAwsUploadErrorResponse(response: AwsFileUploadResponse | AwsUploadErrorResponse): response is AwsUploadErrorResponse {
    return (response as AwsUploadErrorResponse)?.error !== undefined;
  }

  ngAfterViewInit(): void {
    this.imageCropperComponent.loadImageFailed.subscribe(error => {
      this.throwOrNotifyError({title: "Image Load Failed", message: error});
    });
  }

  ngOnInit(): void {
    this.logger.debug("constructed with fileNameData", this.fileNameData, "selectAspectRatio:", this.selectAspectRatio);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    const rootFolder = this.rootFolder || RootFolder.siteContent;
    this.uploader = this.fileUploadService.createUploaderFor(rootFolder, false);
    this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
      this.logger.debug("response", response, "type", typeof response);
      this.notify.clearBusy();
      if (response instanceof HttpErrorResponse) {
        this.throwOrNotifyError({title: "Upload failed", message: response.error});
      } else if (response === "Unauthorized") {
        this.throwOrNotifyError({title: "Upload failed", message: response + " - try logging out and logging back in again and trying this again."});
      } else {
        const uploadResponse: AwsFileUploadResponse | AwsUploadErrorResponse = JSON.parse(response);
        if (ImageCropperAndResizerComponent.isAwsUploadErrorResponse(uploadResponse)) {
          this.notify.error({title: "File upload failed", message: uploadResponse});
        } else {
          this.fileNameData = uploadResponse.response?.fileNameData;
          this.fileNameData.title = this?.existingTitle;
          this.notify.success({title: "File uploaded", message: this.fileNameData.title});
        }
        this.logger.debug("JSON response:", uploadResponse, "fileNameData:", this.fileNameData);
        this.notify.clearBusy();
      }
    }));
    if (this.preloadImage) {
      this.notify.success({title: "Image Cropper", message: "loading file into editor"});
      this.fileUploadService.urlToFile(this.preloadImage, this.preloadImage)
        .then((file: File) => this.processSingleFile(file))
        .catch(error => this.throwOrNotifyError({title: "Unexpected Error", message: error}));
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  format(): OutputFormat {
    if (this?.originalFile?.name?.endsWith("png")) {
      return "png";
    } else {
      return "jpeg";
    }
  }

  imageCropped(event: ImageCroppedEvent) {
    const awsFileData: AwsFileData = this.awsFileData(this.preloadImage, event.base64);
    this.croppedFile = awsFileData;
    this.logger.info("imageCropped:quality,", this.imageQuality, "original size,", this.originalFile.size, this.originalSize(), "croppedFile size", this.croppedFile.file.size, "croppedSize:", this.croppedSize());
    this.imageChange.next(awsFileData);
  }

  awsFileData(awsFileName: string, croppedImage: string): AwsFileData {
    return {
      awsFileName,
      image: croppedImage,
      file: new File([base64ToFile(croppedImage)], this.originalFile.name, {lastModified: this.originalFile.lastModified, type: this.originalFile.type})
    };
  }

  imagePresent(): boolean {
    return !!(this?.croppedFile && this?.originalImageData);
  }

  croppedSize() {
    return this.numberUtils.humanFileSize(this?.croppedFile?.file.size);
  }

  originalSize() {
    return this.numberUtils.humanFileSize(this?.originalFile?.size);
  }

  imageLoaded(loadedImage: LoadedImage) {
    this.originalImageData = loadedImage.original;
    this.logger.debug("Image loaded:", this.originalImageData);
  }

  private cropForCurrentCompression() {
    this.logger.debug("imageCropperComponent.crop() triggered with image quality:", this.imageQuality);
    this.imageCropperComponent.crop();
  }

  cropperReady(sourceImageDimensions: Dimensions) {
    this.logger.debug("Cropper ready", sourceImageDimensions);
    this.notify.hide();
  }

  error(errorEvent: ErrorEvent) {
    this.throwOrNotifyError({title: "Unexpected Error", message: errorEvent});
  }

  loadImageFailed($event: any) {
    this.logger.debug("Load failed:", $event);
    this.throwOrNotifyError({title: "Load failed", message: $event});
  }

  rotateLeft() {
    this.canvasRotation--;
    this.flipAfterRotate();
  }

  rotateRight() {
    this.canvasRotation++;
    this.flipAfterRotate();
  }

  private flipAfterRotate() {
    const flippedH = this.transform.flipH;
    const flippedV = this.transform.flipV;
    this.transform = {
      ...this.transform,
      flipH: flippedV,
      flipV: flippedH
    };
  }

  flipHorizontal() {
    this.transform = {
      ...this.transform,
      flipH: !this.transform.flipH
    };
  }

  flipVertical() {
    this.transform = {
      ...this.transform,
      flipV: !this.transform.flipV
    };
  }

  resetImage() {
    this.scale = 1;
    this.rotation = 0;
    this.canvasRotation = 0;
    this.transform = {};
    this.imageQuality = 90;
    this.manuallySubmitCrop();
  }

  zoomOut() {
    this.scale -= .1;
    this.transform = {
      ...this.transform,
      scale: this.scale
    };
  }

  zoomIn() {
    this.scale += .1;
    this.transform = {
      ...this.transform,
      scale: this.scale
    };
  }

  toggleContainWithinAspectRatio() {
    this.logger.info("toggleContainWithinAspectRatio from:", this.containWithinAspectRatio, "to", !this.containWithinAspectRatio);
    this.containWithinAspectRatio = !this.containWithinAspectRatio;
  }

  updateRotation() {
    this.transform = {
      ...this.transform,
      rotate: this.rotation
    };
  }

  resized($event: UIEvent) {
    this.logger.debug("resized:", $event);
  }

  browseToFile(fileElement: HTMLInputElement) {
    this.existingTitle = this.fileNameData?.title;
    fileElement.click();
  }

  public fileOver(e: any): void {
    this.hasFileOver = e;
  }

  onFileDropped(files: File[]) {
    this.logger.debug("fileDropped:", files);
    this.processSingleFile(first(files));
  }

  onFileSelect(files: File[]) {
    this.processSingleFile(first(files));
  }

  private processSingleFile(file: File) {
    this.notify.setBusy();
    this.uploader.clearQueue();
    this.logger.debug("processSingleFile:file:", file, "queue:", this.uploader.queue, "original file size:", this.numberUtils.humanFileSize(file.size));
    if (this?.croppedFile?.awsFileName) {
      this.logger.debug("processSingleFile:retaining existing loaded filename:", this.croppedFile.awsFileName, "file being processed:", file.name, " will be ignored");
      const myRenamedFile = this.fileUploadService.createImageFileFrom(file, this.croppedFile.awsFileName);
      this.logger.debug("processSingleFile:renamed file:", myRenamedFile);
      this.originalFile = myRenamedFile;
    } else {
      this.logger.debug("processSingleFile:no existing loaded filename to retain - file being processed:", file.name, " will be used as original");
      this.originalFile = file;
    }
    this.notify.progress({title: "File upload", message: `loading preview for ${file.name}...`});
  }

  showAlertMessage(): boolean {
    return this.notifyTarget.busy || this.notifyTarget.showAlert;
  }

  changeAspectRatioSettingsAndCrop(dimension: DescribedDimensions) {
    this.changeAspectRatioSettings(dimension);
    this.logger.info("changeAspectRatio:dimension:", this.dimension, "aspectRatio ->", this.aspectRatio);
    this.imageCropperComponent.crop();
  }

  public initialiseAspectRatioSettings(selectedDescribedDimensions: SelectedDescribedDimensions) {
    this.logger.info("changeAspectRatioSettings:selectedDescribedDimensions:", selectedDescribedDimensions);
    this.changeAspectRatioSettings(selectedDescribedDimensions.describedDimensions);
    if (!selectedDescribedDimensions.preselected) {
      this.containWithinAspectRatio = false;
    }
  }

  public changeAspectRatioSettings(dimension: DescribedDimensions) {
    this.logger.info("changeAspectRatioSettings:dimension:", dimension);
    this.dimension = dimension;
    this.aspectRatio = this.dimension.width / this.dimension.height;
    this.maintainAspectRatio = !this.aspectRatioMaintained(this.dimension);
    ;
  }

  manuallySubmitCrop() {
    setTimeout(() => {
      this.cropForCurrentCompression();
    }, 0);
  }

  saveImage() {
    try {
      this.notify.success({title: "File upload", message: "saving image"});
      this.action = "saving";
      this.uploader.clearQueue();
      this.uploader.addToQueue([this.croppedFile.file]);
      this.uploader.uploadAll();
      this.uploader.response.subscribe((uploaderResponse: string) => {
        const response: AwsFileUploadResponse | AwsUploadErrorResponse = JSON.parse(uploaderResponse);
        if (ImageCropperAndResizerComponent.isAwsUploadErrorResponse(response)) {
          this.action = null;
          this.notify.error({title: "File upload failed", message: response});
        } else {
          this.fileNameData = response.response?.fileNameData;
          this.fileNameData.title = this?.existingTitle;
          this.notify.success({title: "File uploaded", message: this.fileNameData.title});
          const awsFileName = `${response?.response?.fileNameData?.rootFolder}/${response?.response?.fileNameData?.awsFileName}`;
          this.croppedFile.awsFileName = awsFileName;
          this.logger.debug("received response:", uploaderResponse, "awsFileName:", awsFileName, "local originalFile.name:", this.originalFile.name, "aws originalFileName", response?.response?.fileNameData.originalFileName);
          this.save.next(this.croppedFile);
          this.notify.success({title: "File upload", message: "image was saved successfully"});
          this.action = null;
        }
      });
    } catch (error) {
      this.logger.error("received error response:", error);
      this.action = null;
      this.throwOrNotifyError({title: "File upload", message: error});
    }
  }

  throwOrNotifyError(message: AlertMessage) {
    this.logger.error("throwOrNotifyError:", message);
    this.notify.error(message);
  }

  progress() {
    return this.uploader.progress;
  }

  busy() {
    return !!this.action;
  }

  private aspectRatioMaintained(dimensions: Dimensions): boolean {
    return dimensions.width === 1 && dimensions.height === 1;
  }

  transformChanged(imageTransform: ImageTransform) {
    this.logger.debug("transformChanged:", imageTransform);
  }

  changeRange($event: any, crop: boolean) {
    this.logger.info("changeRange:", $event.target?.value);
    this.imageQuality = $event.target?.value;
    if (crop) {
      this.manuallySubmitCrop();
    }
  }
}
