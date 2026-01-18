import { HttpErrorResponse } from "@angular/common/http";
import {
    AfterViewInit,
    Component,
    EventEmitter,
    inject,
    Input,
    OnDestroy,
    OnInit,
    Output,
    ViewChild
} from "@angular/core";
import {
    faArrowRightArrowLeft,
    faClose,
    faCompress,
    faExpand,
    faFile,
    faMagnifyingGlassMinus,
    faMagnifyingGlassPlus,
    faRedoAlt,
    faRemove,
    faRotateLeft,
    faRotateRight,
    faSave,
    faUpDown
} from "@fortawesome/free-solid-svg-icons";
import { first, isNumber } from "es-toolkit/compat";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import {
    Dimensions,
    CropperPosition,
    ImageCroppedEvent,
    ImageCropperComponent,
    ImageCropperModule,
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
    AwsFileUploadResponseData,
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
import { Base64File, FileType, FileTypeAttributes } from "../models/content-metadata.model";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { BadgeButtonComponent } from "../modules/common/badge-button/badge-button";
import { NgClass, NgStyle, NgTemplateOutlet } from "@angular/common";
import { AspectRatioSelectorComponent } from "../carousel/edit/aspect-ratio-selector/aspect-ratio-selector";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { ImageCropperPosition } from "../models/image-cropper.model";

@Component({
    selector: "app-image-cropper-and-resizer",
    templateUrl: "./image-cropper-and-resizer.html",
    styleUrls: ["./image-cropper-and-resizer.sass"],
    imports: [FontAwesomeModule, FormsModule, FileUploadModule, BadgeButtonComponent, NgClass, ImageCropperModule, AspectRatioSelectorComponent, NgStyle, TooltipDirective, NgTemplateOutlet]
})

export class ImageCropperAndResizerComponent implements OnInit, AfterViewInit, OnDestroy {
    private logger: Logger = inject(LoggerFactory).createLogger("ImageCropperAndResizerComponent", NgxLoggerLevel.ERROR);
    private broadcastService = inject<BroadcastService<Base64File[]>>(BroadcastService);
    private numberUtils = inject(NumberUtilsService);
    private fileUploadService = inject(FileUploadService);
    private urlService = inject(UrlService);
    private notifierService = inject(NotifierService);
    private fileUtils = inject(FileUtilsService);
    public wrapButtons: boolean;
    public hideFileSelection: boolean;
    public hideActionButtons: boolean;
    public nonDestructive = true;
    public allowPermanentSave = true;
    public cropOnlyMode = false;
    private noImageSave: boolean;
    private subscriptions: Subscription[] = [];
    public notify: AlertInstance;
    public notifyTarget: AlertTarget = {};
    canvasRotation = 0;
    rotation = 0;
    scale = 1;
    containWithinAspectRatio = false;
    transform: ImageTransform = {};
    public fileNameData: FileNameData;
    public hasFileOver = false;
    public eventDate: DateValue;
    private existingTitle: string;
    public uploader: FileUploader;
    public aspectRatio: number;
    public actionDisabled = false;
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
    public fileTypeAttributes: FileTypeAttributes = null;
    public cropperPosition: ImageCropperPosition = null;
    public resolvedCropperPosition: CropperPosition = null;
    private forceSavePermanently = false;
    protected readonly faRemove = faRemove;
    @ViewChild(ImageCropperComponent) imageCropperComponent: ImageCropperComponent;
    @Input() selectAspectRatio: string;
    @Input() preloadImage: string;
    @Input() rootFolder: RootFolder;
    @Output() quit: EventEmitter<void> = new EventEmitter();
    @Output() cropError: EventEmitter<ErrorEvent> = new EventEmitter();
    @Output() save: EventEmitter<AwsFileData> = new EventEmitter();
    @Output() apply: EventEmitter<void> = new EventEmitter();
    @Output() imageChange: EventEmitter<AwsFileData> = new EventEmitter();
    @Output() cropPositionChange: EventEmitter<number> = new EventEmitter();
    @Output() cropperPositionChange: EventEmitter<ImageCropperPosition> = new EventEmitter();
    @Output() multiImageLoad: EventEmitter<Base64File[]> = new EventEmitter();

    @Input("noImageSave") set noImageSaveValue(noImageSave: boolean) {
        this.noImageSave = coerceBooleanProperty(noImageSave);
    }

    @Input("wrapButtons") set noWrapButtonsValue(wrapButtons: boolean) {
        this.wrapButtons = coerceBooleanProperty(wrapButtons);
    }
    @Input("hideFileSelection") set hideFileSelectionValue(hideFileSelection: boolean) {
        this.hideFileSelection = coerceBooleanProperty(hideFileSelection);
    }
    @Input("hideActionButtons") set hideActionButtonsValue(hideActionButtons: boolean) {
        this.hideActionButtons = coerceBooleanProperty(hideActionButtons);
    }
    @Input("nonDestructive") set nonDestructiveValue(nonDestructive: boolean) {
        this.nonDestructive = coerceBooleanProperty(nonDestructive);
    }
    @Input("allowPermanentSave") set allowPermanentSaveValue(allowPermanentSave: boolean) {
        this.allowPermanentSave = coerceBooleanProperty(allowPermanentSave);
    }
    @Input("cropOnlyMode") set cropOnlyModeValue(cropOnlyMode: boolean) {
        this.cropOnlyMode = coerceBooleanProperty(cropOnlyMode);
    }
    @Input("cropperPosition") set cropperPositionValue(cropperPosition: ImageCropperPosition) {
        this.cropperPosition = cropperPosition || null;
        this.logger.info("cropperPositionValue set:", this.cropperPosition);
    }

    ngAfterViewInit(): void {
        this.imageCropperComponent?.loadImageFailed.subscribe(error => {
            this.throwOrNotifyError({title: "Image Load Failed", message: error});
        });
    }

    async ngOnInit(): Promise<void> {
        this.logger.info("constructed with fileNameData", this.fileNameData, "preloadImage:", this.preloadImage, "selectAspectRatio:", this.selectAspectRatio);
        this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
        const rootFolder = this.rootFolder || RootFolder.siteContent;
        this.uploader = this.fileUploadService.createUploaderFor(rootFolder, false);
        this.subscriptions.push(this.uploader.response.subscribe((response: string | HttpErrorResponse) => {
            const awsFileUploadResponseData: AwsFileUploadResponseData = this.fileUploadService.handleSingleResponseDataItem(response, this.notify, this.logger);
            this.fileNameData = awsFileUploadResponseData?.fileNameData;
            this.fileNameData.title = this?.existingTitle;
            this.notify.success({title: "File uploaded", message: this.fileNameData.title});
            // extra bit from other handler
            const awsFileName = `${awsFileUploadResponseData?.fileNameData?.rootFolder}/${awsFileUploadResponseData?.fileNameData?.awsFileName}`;
            this.croppedFile.awsFileName = awsFileName;
            this.logger.info("received response:", awsFileUploadResponseData, "awsFileName:", awsFileName, "local originalFile.name:", this.originalFile.name, "aws originalFileName", awsFileUploadResponseData?.fileNameData.originalFileName);
            this.save.next(this.croppedFile);
            this.notify.success({title: "File upload", message: "image was saved successfully"});
            this.quit.emit();
            this.action = null;
            // end of extra bit from other handler
        }));
        if (this.preloadImage) {
            this.notify.success({title: "Image Cropper", message: "loading file into editor"});
            if (this.urlService.isBase64Image(this.preloadImage)) {
                await this.processSingleFile(this.fileUtils.base64ToFileWithName(this.preloadImage, null));
            } else {
                this.fileUploadService.urlToFile(this.preloadImage, this.preloadImage)
                    .then(async (file: File) => await this.processSingleFile(file))
                    .catch(error => this.throwOrNotifyError({title: "Unexpected Error", message: error}));
            }
        } else {
            this.updateActionDisabled();
        }
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }

    format(): OutputFormat {
        return this.fileTypeAttributes?.cropperFormat;
    }

    private async calculateImageTypeAttributes(): Promise<void> {
        const initialFileAttributes = this.fileUtils.fileTypeAttributesForFile(this?.originalFile);
        if (initialFileAttributes.key === FileType.HEIC) {
            const heicBase64File: Base64File = await this.fileUtils.loadBase64ImageFromFile(this?.originalFile);
            const checkedImage = await this.fileUtils.convertHEICFile(heicBase64File);
            const jpegBase64File = checkedImage.file;
            this.logger.info("calculateImageTypeAttributes:replacing originalFile:", this?.originalFile, "with:", jpegBase64File.file);
            this.originalFile = jpegBase64File.file;
            this.fileTypeAttributes = this.fileUtils.fileTypeAttributesForFile(jpegBase64File.file);
        } else {
            this.fileTypeAttributes = initialFileAttributes;
        }
        this.logger.info("calculateImageTypeAttributes:originalFile:", this?.originalFile, "fileTypeAttributes:", this.fileTypeAttributes);
        if (!this.fileTypeAttributes?.croppable) {
            const base64File: Base64File = await this.fileUtils.loadBase64ImageFromFile(this?.originalFile);
            this.croppedFile = this.fileUtils.awsFileData(this.preloadImage, base64File.base64Content, this.originalFile);
            this.imageChange.emit(this.croppedFile);
            this.logger.info("calculateImageTypeAttributes:fileExtension", this.fileTypeAttributes?.contentType, "is not croppable so auto-generating and imageChange.emit(croppedFile):", this.croppedFile);
        }
    }

    imageCropped(event: ImageCroppedEvent) {
        if (!this.originalFile) {
            this.logger.warn("imageCropped called but originalFile is not set yet, ignoring");
            return;
        }
        if (!event.base64) {
            this.logger.warn("imageCropped called but event.base64 is not set, ignoring");
            return;
        }
        const awsFileData: AwsFileData = this.fileUtils.awsFileData(this.preloadImage, event.base64, this.originalFile);
        this.croppedFile = awsFileData;
        this.logger.info("imageCropped:quality,", this.imageQuality, "original size,", this.originalFile.size, this.originalSize(), "croppedFile size", this.croppedFile.file.size, "croppedSize:", this.croppedSize());
        this.imageChange.emit(awsFileData);
        this.updateActionDisabled();
        const cropPosition = this.coverImagePosition(event);
        if (cropPosition !== null) {
            this.cropPositionChange.emit(cropPosition);
        }
        this.logger.info("imageCropped - raw positions:", {
            cropperPosition: event?.cropperPosition,
            imagePosition: event?.imagePosition,
            imageSize: this.originalImageData?.size
        });
        const normalizedCropperPosition = this.normalizedCropperPosition(event?.imagePosition);
        if (normalizedCropperPosition) {
            this.logger.info("imageCropped - emitting cropperPositionChange:", normalizedCropperPosition);
            this.cropperPositionChange.emit(normalizedCropperPosition);
        }
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
        this.logger.info("Image loaded:", this.originalImageData);
        this.updateResolvedCropperPosition();
        this.manuallySubmitCrop();
    }

    private cropForCurrentCompression() {
        this.logger.debug("imageCropperComponent.crop() triggered with image quality:", this.imageQuality);
        this.imageCropperComponent.crop();
    }

    cropperReady(sourceImageDimensions: Dimensions) {
        this.logger.info("Cropper ready", sourceImageDimensions, "resolvedCropperPosition:", this.resolvedCropperPosition);
        this.notify.hide();
        if (this.isValidCropperPosition(this.resolvedCropperPosition) && this.imageCropperComponent) {
            this.logger.info("Applying saved cropper position:", this.resolvedCropperPosition);
            setTimeout(() => {
                this.imageCropperComponent.cropper = this.resolvedCropperPosition;
                this.manuallySubmitCrop();
            }, 0);
        } else {
            this.logger.info("Invalid or missing cropper position, using default");
        }
    }

    private isValidCropperPosition(position: CropperPosition): boolean {
        if (!position) return false;
        const width = position.x2 - position.x1;
        const height = position.y2 - position.y1;
        return width > 10 && height > 10; // Minimum 10px crop area
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

    async onFileDropped(fileList: any) {
        const base64Files: Base64File[] = await this.fileUtils.fileListToBase64Files(fileList);
        const firstFile: File = first(base64Files).file;
        this.logger.info("filesDropped:", fileList, "firstFile:", firstFile);
        this.notify.setBusy();
        this.uploader.clearQueue();
        if (base64Files.length > 1) {
            this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.FILES_DROPPED, base64Files));
        } else {
            await this.processSingleFile(firstFile);
        }
        this.updateActionDisabled();
    }

    onFileSelect(fileList: any) {
        this.logger.info("onFileSelect:files:", fileList);
        this.onFileDropped(fileList);
    }

    private async processSingleFile(file: File) {
        this.logger.info("processSingleFile:file:", file, "queue:", this.uploader.queue, "original file size:", this.numberUtils.humanFileSize(file.size));
        if (this?.croppedFile?.awsFileName) {
            this.logger.info("processSingleFile:retaining existing loaded filename:", this.croppedFile.awsFileName, "file being processed:", file.name, " will be ignored");
            const myRenamedFile = this.fileUploadService.createImageFileFrom(file, this.croppedFile.awsFileName);
            this.logger.info("processSingleFile:renamed file:", myRenamedFile);
            this.originalFile = myRenamedFile;
        } else {
            this.logger.info("processSingleFile:no existing loaded filename to retain - file being processed:", file.name, " will be used as original");
            this.originalFile = file;
        }
        this.notify.progress({title: "File upload", message: `loading preview for ${file.name}...`});
        await this.calculateImageTypeAttributes();
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
        this.logger.info("changeAspectRatioSettings:selectedDescribedDimensions:", selectedDescribedDimensions, "containWithinAspectRatio:", this.containWithinAspectRatio);
        this.changeAspectRatioSettings(selectedDescribedDimensions.describedDimensions);
        if (!selectedDescribedDimensions.preselected) {
            this.containWithinAspectRatio = false;
        }
    }

    public changeAspectRatioSettings(dimension: DescribedDimensions) {
        this.logger.info("changeAspectRatioSettings:dimension:", dimension);
        this.dimension = dimension;
        this.aspectRatio = this.isFreeSelection(dimension) ? 1 : this.dimension.width / this.dimension.height;
        this.maintainAspectRatio = !this.isFreeSelection(this.dimension);
    }

    manuallySubmitCrop() {
        setTimeout(() => {
            this.cropForCurrentCompression();
        }, 0);
    }

    applyCrop() {
        this.apply.emit();
        this.action = null;
    }

    saveImagePermanently() {
        this.forceSavePermanently = true;
        this.saveImage();
        this.forceSavePermanently = false;
    }

    saveImage() {
        try {
            if (!this.croppedFile) {
                this.throwOrNotifyError({
                    title: "File upload",
                    message: "No image available to save. Please wait for the image to load and be processed."
                });
                return;
            }
            const shouldSavePermanently = this.forceSavePermanently || (!this.nonDestructive && !this.noImageSave);
            if (!shouldSavePermanently) {
                this.logger.info("emitting image changes but not saving:", this.croppedFile);
                this.apply.emit();
                this.action = null;
            } else {
                this.notify.success({title: "File upload", message: "saving image"});
                this.action = "saving";
                this.uploader.clearQueue();
                this.uploader.addToQueue([this.croppedFile.file]);
                this.uploader.uploadAll();
            }
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

    updateActionDisabled(): void {
        const actionDisabled = (!!this.action) || !this.fileTypeAttributes?.croppable || !this.croppedFile;
        this.logger.info("actionDisabled:action:", this.action, "fileNameData:", this.fileNameData, "croppedFile:", this.croppedFile, "croppable:", this.fileTypeAttributes?.croppable, "actionDisabled->", actionDisabled);
        this.actionDisabled = actionDisabled;
    }

    private isFreeSelection(dimensions: Dimensions): boolean {
        return dimensions.width === 0 && dimensions.height === 0;
    }

    transformChanged(imageTransform: ImageTransform) {
        this.logger.info("transformChanged:", imageTransform);
    }

    changeRange($event: any, crop: boolean) {
        this.logger.info("changeRange:", $event.target?.value);
        this.imageQuality = $event.target?.value;
        if (crop) {
            this.manuallySubmitCrop();
        }
    }

    private coverImagePosition(event: ImageCroppedEvent): number | null {
        const imagePosition = event?.imagePosition;
        const imageHeight = this.originalImageData?.size?.height;
        if (!imagePosition || !imageHeight) {
            return null;
        }
        const centerY = (imagePosition.y1 + imagePosition.y2) / 2;
        if (Number.isNaN(centerY)) {
            return null;
        }
        const position = (centerY / imageHeight) * 100;
        return Math.max(0, Math.min(100, position));
    }

    private updateResolvedCropperPosition() {
        const size = this.originalImageData?.size;
        if (this.cropperPosition) {
            this.resolvedCropperPosition = this.cropperPositionFromPercent(this.cropperPosition, size);
        } else if (this.validCropperSize(size)) {
            this.resolvedCropperPosition = this.defaultCropperPosition(size);
        } else {
            this.resolvedCropperPosition = null;
        }
        this.logger.info("updateResolvedCropperPosition - cropperPosition:", this.cropperPosition, "imageSize:", size, "resolvedCropperPosition:", this.resolvedCropperPosition);
    }

    private defaultCropperPosition(size: Dimensions): CropperPosition {
        const imageAspectRatio = size.width / size.height;
        const aspectRatio = (this.maintainAspectRatio && this.aspectRatio > 0) ? this.aspectRatio : imageAspectRatio;

        let cropWidth: number;
        let cropHeight: number;

        if (aspectRatio > imageAspectRatio) {
            cropWidth = size.width;
            cropHeight = size.width / aspectRatio;
        } else {
            cropHeight = size.height;
            cropWidth = size.height * aspectRatio;
        }

        const x1 = (size.width - cropWidth) / 2;
        const y1 = (size.height - cropHeight) / 2;
        const x2 = x1 + cropWidth;
        const y2 = y1 + cropHeight;

        this.logger.info("defaultCropperPosition - aspectRatio:", aspectRatio, "imageAspectRatio:", imageAspectRatio, "size:", size, "crop:", {x1, y1, x2, y2});
        return {x1, y1, x2, y2};
    }

    private cropperPositionFromPercent(position: ImageCropperPosition, size: Dimensions): CropperPosition | null {
        if (!position || !this.validCropperSize(size)) {
            return null;
        }
        const x1 = this.cropperValueFromPercent(position.x1, size.width);
        const y1 = this.cropperValueFromPercent(position.y1, size.height);
        const x2 = this.cropperValueFromPercent(position.x2, size.width);
        const y2 = this.cropperValueFromPercent(position.y2, size.height);
        if (x1 === null || y1 === null || x2 === null || y2 === null) {
            return null;
        }
        return {x1, y1, x2, y2};
    }

    private normalizedCropperPosition(position: CropperPosition): ImageCropperPosition | null {
        const size = this.originalImageData?.size;
        if (!position || !this.validCropperSize(size)) {
            return null;
        }
        const x1 = this.cropperPercent(position.x1, size.width);
        const y1 = this.cropperPercent(position.y1, size.height);
        const x2 = this.cropperPercent(position.x2, size.width);
        const y2 = this.cropperPercent(position.y2, size.height);
        if (x1 === null || y1 === null || x2 === null || y2 === null) {
            return null;
        }
        return {x1, y1, x2, y2};
    }

    private cropperPercent(value: number, total: number): number | null {
        if (!isNumber(value) || !isNumber(total) || total <= 0) {
            return null;
        }
        const percent = (value / total) * 100;
        return Math.max(0, Math.min(100, percent));
    }

    private cropperValueFromPercent(value: number, total: number): number | null {
        if (!isNumber(value) || !isNumber(total) || total <= 0) {
            return null;
        }
        const resolved = (value / 100) * total;
        return Math.max(0, Math.min(total, resolved));
    }

    private validCropperSize(size: Dimensions): boolean {
        return !!(size && isNumber(size.width) && isNumber(size.height) && size.width > 0 && size.height > 0);
    }
}
