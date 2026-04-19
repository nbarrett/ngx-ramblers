import { NgxCaptureService } from "ngx-capture";
import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { kebabCase, range } from "es-toolkit";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../auth/auth.service";
import { AwsFileData, AwsFileUploadResponse, AwsFileUploadResponseData } from "../../models/aws-object.model";
import {
  BannerConfig,
  BannerType,
  ensureTitleLine,
  LogoAndTextLinesBanner,
  PapercutBackgroundBanner,
  TitleLine
} from "../../models/banner-configuration.model";
import { Member } from "../../models/member.model";
import { colourSelectors, Image, RootFolder, SystemConfig } from "../../models/system.model";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { sortBy } from "../../functions/arrays";
import { BannerConfigService } from "../../services/banner-config.service";
import { ImageCropperPosition } from "../../models/image-cropper.model";
import { DateUtilsService } from "../../services/date-utils.service";
import { enumKeyValues, KeyValue } from "../../functions/enums";
import { LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { NumberUtilsService } from "../../services/number-utils.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";
import { faSpinner, faTableCells } from "@fortawesome/free-solid-svg-icons";
import { tap } from "rxjs/operators";
import { HttpErrorResponse } from "@angular/common/http";
import { FileUploader } from "ng2-file-upload";
import { FileUploadService } from "../../services/file-upload.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { AlertTarget } from "../../models/alert-target.model";
import { FileUtilsService } from "../../file-utils.service";
import { IMAGE_JPEG } from "../../models/content-metadata.model";
import { cloneDeep, isEqual } from "es-toolkit/compat";
import { PageComponent } from "../../page/page.component";
import { FormsModule } from "@angular/forms";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { ButtonCheckboxDirective } from "ngx-bootstrap/buttons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CollapseDirective } from "ngx-bootstrap/collapse";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BannerImageSelectorComponent } from "./banner-image-selector.component";
import { BannerTitleConfigComponent } from "./banner-title-config.component";
import { ColourSelectorComponent } from "./colour-selector";
import { ImageCropperAndResizerComponent } from "../../image-cropper-and-resizer/image-cropper-and-resizer";
import { BannerPapercutOutputComponent } from "./banner-papercut-output.component";
import { BannerLogoAndTextLinesOutputComponent } from "./banner-logo-and-text-lines-output";
import { FocalPointPickerComponent } from "../../modules/common/focal-point-picker/focal-point-picker";
import { FocalPoint } from "../../models/image-cropper.model";
import { StoredValue } from "../../models/ui-actions";

@Component({
    selector: "app-banner",
    styleUrls: ["./banner.component.sass"],
    template: `
    <app-page autoTitle [pageTitle]="pageTitle()">
      <div class="fixed-height">
        <div class="form-group">
          <label for="banner-lookup">Select a saved banner</label>
          <select class="form-control input-sm"
            id="banner-lookup"
            [(ngModel)]="editableBanner" (ngModelChange)="bannerSelected($event)"
            [compareWith]="compareBanners">
            @for (banner of banners; track banner.id) {
              <option
                [ngValue]="banner">{{ toBannerInformation(banner) }}
              </option>
            }
          </select>
        </div>
        <div class="btn-group" dropdown>
          <button aria-controls="dropdown-banner-animated" class="dropdown-toggle btn btn-primary" dropdownToggle
            type="button">
            <span class="ms-1">New</span><span class="caret"></span>
          </button>
          <ul *dropdownMenu class="dropdown-menu"
            id="dropdown-banner-animated" role="menu">
            <li role="menuitem">
              <a (click)="create(defaultPaperCutBackgroundBanner())" class="dropdown-item">
                Based on <b>Papercut background</b> design
              </a>
            </li>
            <li role="menuitem">
              <a (click)="create(defaultLogoAndTextLinesBanner())" class="dropdown-item">
                Based on <b>Logo and Text Lines</b> design
              </a>
            </li>
          </ul>
        </div>
        <button [attr.aria-expanded]="!isCollapsed" (click)="isCollapsed = !isCollapsed" [disabled]="saving"
          class="btn btn-primary ms-1"
          type="button">{{ isCollapsed ? 'Edit' : 'Close Edit' }}
        </button>
        @if (allowContentEdits) {
          @if (!bannerPhotoEditActive && !bannerSavedImageEditActive) {
            <button [disabled]="saving" class="btn btn-primary ms-1" type="button"
              (click)="editPhoto()">Edit
              Photo
            </button>
            @if (editableBanner?.fileNameData?.awsFileName) {
              <button [disabled]="saving" class="btn btn-primary ms-1" type="button"
                (click)="editSavedImage()">Edit Saved Image
              </button>
            } @else {
              <button class="btn btn-secondary ms-1" type="button" disabled
                tooltip="Image needs to be saved before it can be cropped and resized">Not Saved Yet
              </button>
            }
          }
          @if (editableBanner?.fileNameData?.awsFileName) {
            <img [src]="savedImageSrc()" class="d-none" (load)="onSavedImageLoad($event)" alt=""/>
          }
          <button (click)="duplicate()" [disabled]="saving" class="btn btn-primary ms-1"
            type="button">Duplicate
          </button>
          <button (click)="delete()" [disabled]="saving" class="btn btn-primary ms-1"
            type="button">Delete
          </button>
          <button class="btn btn-primary ms-1" [disabled]="saving||!this.dataChanged()" type="button" (click)="undo()">
            Undo
          </button>
          <button class="btn btn-primary ms-1" [disabled]="saving||!this.dataChanged()" type="button"
            (click)="saveImage()">Save
          </button>
          <button class="btn btn-primary ms-1" type="button" [disabled]="saving" (click)="exportBanner()">Export
          </button>
        }
        <button class="btn btn-primary ms-1" name="editable" [(ngModel)]="imageDisplay.editable"
          [class.active]="imageDisplay.editable"
          btnCheckbox tabindex="0" role="button">Editable
        </button>
        <button class="btn btn-primary ms-1" [(ngModel)]="imageDisplay.saved" [class.active]="imageDisplay.saved"
          btnCheckbox tabindex="0" name="saved" role="button">Saved
        </button>
        @if (editableBanner?.fileNameData?.awsFileName && savedImageSummary()) {
          <div class="row mt-2">
            <div class="col-sm-12 small text-muted">{{ savedImageSummary() }}</div>
          </div>
        }
        <div class="mt-3">
          @if (notifyTarget.showAlert) {
            <div class="row">
              <div class="col-sm-12">
                <div class="alert {{notifyTarget.alertClass}}">
                  @if (notifyTarget.busy) {
                    <fa-icon [icon]="faSpinner" animation="spin" class="me-2"/>
                  } @else {
                    <fa-icon [icon]="notifyTarget.alert.icon"/>
                  }
                  @if (notifyTarget.alertTitle) {
                    <strong
                      >
                    {{ notifyTarget.alertTitle }}: </strong>
                    } {{ notifyTarget.alertMessage }}
                  </div>
                </div>
              </div>
            }
            <div class="collapse" [collapse]="isCollapsed" [isAnimated]="true">
              <div class="card card-body mb-3">
                @if (editableBanner) {
                  <div class="row">
                    <div class="col-6">
                      <label for="name">Banner Name</label>
                      <input [disabled]="!allowContentEdits" [(ngModel)]="editableBanner.name"
                        id="name"
                        type="text" class="form-control input-sm"
                        placeholder="Enter name of banner">
                    </div>
                    <div class="col-6">
                      <label for="banner-type">Banner Type</label>
                      <select [disabled]="!allowContentEdits" class="form-control input-sm"
                        id="banner-type"
                        [(ngModel)]="editableBanner.bannerType"
                        (ngModelChange)="changedBannerType($event)">
                        @for (bannerType of bannerTypes; track bannerType.key) {
                          <option
                            [ngValue]="bannerType.value">{{ stringUtils.asTitle(bannerType.value) }}
                          </option>
                        }
                      </select>
                    </div>
                  </div>
                }
                @if (isLogoAndTextLines()) {
                  <div class="row mt-2">
                    <div class="col-sm-12">
                      <app-banner-image-selector
                        [bannerImageItem]="editableBanner.banner.logo"
                        [configurePadding]="true"
                        [configureColumns]="true">
                      </app-banner-image-selector>
                    </div>
                  </div>
                  <div class="row mt-3">
                    <div class="col-sm-6">
                      <app-banner-title-config [titleLine]="editableBanner.banner.line1"
                        [id]="'1'"/>
                    </div>
                    <div class="col-sm-6">
                      <app-banner-title-config [titleLine]="editableBanner.banner.line2"
                        [id]="'2'"/>
                    </div>
                  </div>
                }
                @if (isPapercutBanner()) {
                  <div class="row mt-2">
                    <div class="col-sm-6">
                      <app-banner-image-selector
                        [bannerImageItem]="editableBanner.banner?.logo"
                        [configureWidth]="true">
                      </app-banner-image-selector>
                    </div>
                    <div class="col-sm-6">
                      <app-banner-image-selector
                        [bannerImageItem]="editableBanner.banner?.background"
                        [configureWidth]="true">
                      </app-banner-image-selector>
                    </div>
                  </div>
                  @if (editableBanner?.banner) {
                    <div class="row">
                      <div class="col-sm-6">
                        <label>Banner Text:</label>
                        <textarea class="form-control input-sm" rows="3"
                        [(ngModel)]="editableBanner.banner.text.value"></textarea>
                      </div>
                      @if (editableBanner?.banner?.photo?.image) {
                        <div class="col-sm-6">
                          <label>Image Source:</label>
                          <input class="form-control input-sm"
                            [(ngModel)]="editableBanner.banner.photo.image.awsFileName"/>
                        </div>
                      }
                      <div class="col-sm-6">
                        <app-colour-selector [itemWithClassOrColour]="editableBanner.banner?.text"/>
                      </div>
                      @if (editableBanner?.banner?.photo?.image?.awsFileName && !bannerPhotoEditActive && !bannerSavedImageEditActive) {
                        <div class="col-sm-12 mt-4">
                          <label class="form-label">Photo focal point</label>
                          <div class="small text-muted mb-2">Click or drag on the image to set the focus point. Use mouse wheel or slider to zoom. Drag the bottom handle to set the photo height.
                            @if (photoNaturalWidth && photoNaturalHeight) {
                              Source image: {{ photoNaturalWidth }} × {{ photoNaturalHeight }} px.
                            }
                          </div>
                          <img [src]="photoImageSrc()" class="d-none" (load)="onPhotoImageLoad($event)"/>
                          <app-focal-point-picker
                            [imageSrc]="photoImageSrc()"
                            [focalPoint]="editableBanner.banner.photo.image.focalPoint || defaultFocalPoint"
                            [height]="editableBanner.bannerHeight || defaultBannerHeight"
                            [resizable]="true"
                            [minHeight]="200"
                            [maxHeight]="900"
                            (focalPointChange)="bannerPhotoFocalPointChange($event)"
                            (heightChange)="bannerPreviewHeightChange($event)"/>
                        </div>
                      }
                      <div class="col-sm-12 mt-4">
                        @if (bannerPhotoEditActive) {
                          <app-image-cropper-and-resizer
                            [rootFolder]="bannerPhotos"
                            [preloadImage]="preLoadImage()"
                            [cropperPosition]="editableBanner?.banner?.photo?.image?.cropperPosition"
                            nonDestructive
                            (imageChange)="imageChange($event)"
                            (cropperPositionChange)="bannerPhotoCropperChange($event)"
                            (quit)="exitImageEdit()"
                            (apply)="exitImageEdit()"
                            (save)="imagedSaved($event)">
                          </app-image-cropper-and-resizer>
                        }
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
          @if (bannerSavedImageEditActive) {
            <div class="mt-3">
              <label class="form-label">Edit saved banner image</label>
              <div class="small text-muted mb-2">
                @if (savedImageNaturalWidth && savedImageNaturalHeight) {
                  Source image: {{ savedImageNaturalWidth }} × {{ savedImageNaturalHeight }} px.
                }
              </div>
              <img [src]="savedImageSrc()" class="d-none" (load)="onSavedImageLoad($event)"/>
              <app-image-cropper-and-resizer
                [rootFolder]="bannerPhotos"
                [preloadImage]="preLoadSavedImage()"
                nonDestructive
                (imageChange)="savedImageChange($event)"
                (quit)="exitSavedImageEdit()"
                (apply)="exitSavedImageEdit()"
                (save)="savedImagedSaved($event)">
              </app-image-cropper-and-resizer>
            </div>
          }
          @if (imageDisplay.editable) {
            <div #bannerImage class="show-border">
              @if (isPapercutBanner()) {
                <app-papercut-output [banner]="editableBanner.banner"
                  [tempImage]="bannerPhotoAwsFileData?.image"
                  [bannerHeight]="editableBanner.bannerHeight"/>
              }
              @if (isLogoAndTextLines()) {
                <app-banner-logo-and-text-lines-output
                  [banner]="editableBanner.banner"/>
              }
            </div>
          }
          @if (editableBanner?.fileNameData && imageDisplay.saved) {
            <div class="mt-2">
              <img class="d-block w-100"
                [src]="savedImageSrc()"
                (load)="onSavedImageLoad($event)">
            </div>
          }
          </div>
        </app-page>`,
    imports: [PageComponent, FormsModule, BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, ButtonCheckboxDirective, FontAwesomeModule, CollapseDirective, BannerImageSelectorComponent, BannerTitleConfigComponent, ColourSelectorComponent, ImageCropperAndResizerComponent, BannerPapercutOutputComponent, BannerLogoAndTextLinesOutputComponent, FocalPointPickerComponent, TooltipDirective]
})

export class BannerComponent implements OnInit, OnDestroy {
  @ViewChild("bannerImage") bannerImage: ElementRef;
  private notifierService: NotifierService = inject(NotifierService);
  private fileUploadService: FileUploadService = inject(FileUploadService);
  private captureService: NgxCaptureService = inject(NgxCaptureService);
  private authService: AuthService = inject(AuthService);
  public memberLoginService: MemberLoginService = inject(MemberLoginService);
  private fullNamePipe: FullNamePipe = inject(FullNamePipe);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  private memberService: MemberService = inject(MemberService);
  private bannerConfigService: BannerConfigService = inject(BannerConfigService);
  private systemConfigService: SystemConfigService = inject(SystemConfigService);
  private dateUtils: DateUtilsService = inject(DateUtilsService);
  private router: Router = inject(Router);
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private fileUtils: FileUtilsService = inject(FileUtilsService);
  private numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public urlService: UrlService = inject(UrlService);
  private logger = inject(LoggerFactory).createLogger("BannerComponent", NgxLoggerLevel.ERROR);
  public bannerPhotos: RootFolder = RootFolder.bannerPhotos;
  public allowContentEdits: boolean;
  public config: SystemConfig;
  public logos: RootFolder = RootFolder.logos;
  public bannerTypes: KeyValue<string>[] = enumKeyValues(BannerType);
  public banners: BannerConfig[] = [];
  public editableBanner: BannerConfig;
  public lastSavedBanner: BannerConfig;
  public isCollapsed = true;
  hide = colourSelectors[0].class;
  white = colourSelectors[1].class;
  public members: Member[] = [];
  public bannerPhotoAwsFileData: AwsFileData;
  public bannerPhotoEditActive: boolean;
  public saving: boolean;
  private subscriptions: Subscription[] = [];
  public uploader: FileUploader;
  protected readonly faTableCells = faTableCells;
  protected readonly faSpinner = faSpinner;
  public notifyTarget: AlertTarget = {};
  public notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  imageDisplay: { editable?: boolean; saved?: boolean } = {editable: true, saved: false};

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify.warning({
      title: "Banners",
      message: "Querying data"
    });
    this.refreshCachedData();
    this.refreshData();
    this.uploader = this.fileUploadService.createUploaderFor(RootFolder.bannerPhotos, false);
    this.uploader.response.subscribe(async (response: string | HttpErrorResponse) => {
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
            this.editableBanner.fileNameData = responses[0].fileNameData;
            this.logger.info("editableBanner:", this.editableBanner);
            this.updateAudit();
            const bannerConfigSaveResponse: BannerConfig = await this.saveBanner();
            this.saving = false;
            this.uploader.clearQueue();
            this.logger.info("bannerConfigSaveResponse:", bannerConfigSaveResponse);
            this.notify.hide();
            const existingIndex = this.banners.findIndex(b => b.id && b.id === bannerConfigSaveResponse.id);
            if (existingIndex >= 0) {
              this.banners[existingIndex] = bannerConfigSaveResponse;
            } else {
              this.banners = [bannerConfigSaveResponse, ...this.banners];
            }
            this.bannerSelected(bannerConfigSaveResponse);
            this.savedImageVersion = Date.now();
            this.savedImageBytesSrc = null;
            this.imageDisplay.saved = true;
          } else {
            this.notify.warning({
              title: "File upload failed",
              message: "No files were uploaded"
            });
          }
        }
      }, (error) => {
        this.notify.error({title: "Upload failed", message: error});
      }
    );
    this.subscriptions.push(this.authService.authResponse().subscribe(() => this.refreshCachedData()));
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.logger.info("retrieved config", config);
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async refreshCachedData() {
    this.allowContentEdits = this.memberLoginService.allowContentEdits();
    if (this.memberLoginService.memberLoggedIn()) {
      this.members = await this.memberService.publicFields(this.memberService.filterFor.GROUP_MEMBERS);
    } else {
      this.members = [];
    }
  }

  imagedSaved(awsFileData: AwsFileData) {
    const background = this.editablePapercutBackgroundBanner();
    this.logger.info("imagedSaved:", awsFileData, "setting logoImageSource to", awsFileData.awsFileName);
    background.photo.image.awsFileName = awsFileData.awsFileName;
    background.photo.image.cropperPosition = null;
    this.exitImageEdit();
  }

  imageChange(awsFileData: AwsFileData) {
    this.bannerPhotoAwsFileData = awsFileData;
    const background: PapercutBackgroundBanner = this.editablePapercutBackgroundBanner();
    this.logger.info("imageChanged:", awsFileData, "background:", background);
    if (!background?.photo?.image?.originalFileName && awsFileData?.file?.name) {
      background.photo.image.originalFileName = awsFileData?.file?.name;
    }
  }

  bannerPhotoCropperChange(position: ImageCropperPosition) {
    const background = this.editablePapercutBackgroundBanner();
    if (background?.photo?.image) {
      background.photo.image.cropperPosition = position || null;
    }
  }

  bannerPhotoFocalPointChange(focalPoint: FocalPoint) {
    const background = this.editablePapercutBackgroundBanner();
    if (background?.photo?.image) {
      background.photo.image.focalPoint = focalPoint || null;
      this.logger.debug("bannerPhotoFocalPointChange:", focalPoint);
    }
  }

  photoImageSrc(): string {
    const banner = this.editableBanner?.banner as PapercutBackgroundBanner;
    return this.urlService.imageSource(banner?.photo?.image?.awsFileName, true);
  }

  defaultFocalPoint: FocalPoint = { x: 50, y: 50, zoom: 1 };
  defaultBannerHeight: number = 400;
  public bannerSavedImageEditActive: boolean;
  public bannerSavedImageAwsFileData: AwsFileData;
  public photoNaturalWidth: number;
  public photoNaturalHeight: number;
  public savedImageNaturalWidth: number;
  public savedImageNaturalHeight: number;
  public savedImageBytes: number;
  private savedImageBytesSrc: string;

  onPhotoImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    this.photoNaturalWidth = img?.naturalWidth || null;
    this.photoNaturalHeight = img?.naturalHeight || null;
    this.logger.debug("photo natural size:", this.photoNaturalWidth, "x", this.photoNaturalHeight);
  }

  onSavedImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    this.savedImageNaturalWidth = img?.naturalWidth || null;
    this.savedImageNaturalHeight = img?.naturalHeight || null;
    this.logger.debug("saved image natural size:", this.savedImageNaturalWidth, "x", this.savedImageNaturalHeight);
    this.refreshSavedImageBytes();
  }

  private async refreshSavedImageBytes() {
    const src = this.savedImageSrc();
    if (!src || src === this.savedImageBytesSrc) {
      return;
    }
    this.savedImageBytesSrc = src;
    try {
      const response = await fetch(src, {cache: "force-cache"});
      const blob = await response.blob();
      this.savedImageBytes = blob.size;
      this.logger.debug("saved image bytes:", this.savedImageBytes, "for", src);
    } catch (error) {
      this.logger.debug("refreshSavedImageBytes failed:", error);
      this.savedImageBytes = null;
    }
  }

  savedImageSummary(): string {
    if (!this.savedImageNaturalWidth || !this.savedImageNaturalHeight) {
      return null;
    }
    const dimensions = `${this.savedImageNaturalWidth} × ${this.savedImageNaturalHeight} px`;
    const size = this.savedImageBytes ? `, ${this.numberUtils.humanFileSize(this.savedImageBytes)}` : "";
    return `Saved image: ${dimensions}${size}.`;
  }

  editSavedImage() {
    this.isCollapsed = false;
    this.bannerSavedImageEditActive = true;
  }

  exitSavedImageEdit() {
    this.bannerSavedImageAwsFileData = null;
    this.bannerSavedImageEditActive = false;
  }

  preLoadSavedImage(): string {
    if (this.bannerSavedImageAwsFileData?.image) {
      return this.bannerSavedImageAwsFileData.image;
    }
    if (this.bannerSavedImageEditActive && this.editableBanner?.fileNameData) {
      return this.editableBanner.fileNameData.rootFolder + "/" + this.editableBanner.fileNameData.awsFileName;
    }
    return null;
  }

  savedImageChange(awsFileData: AwsFileData) {
    this.bannerSavedImageAwsFileData = awsFileData;
  }

  async savedImagedSaved(awsFileData: AwsFileData) {
    if (this.editableBanner?.fileNameData) {
      const rootFolder = this.editableBanner.fileNameData.rootFolder;
      const prefix = rootFolder ? `${rootFolder}/` : "";
      const awsFileName = prefix && awsFileData.awsFileName?.startsWith(prefix)
        ? awsFileData.awsFileName.substring(prefix.length)
        : awsFileData.awsFileName;
      this.editableBanner.fileNameData = {
        ...this.editableBanner.fileNameData,
        awsFileName
      };
      this.updateAudit();
      const saved = await this.saveBanner();
      this.bannerSelected(saved);
      this.savedImageVersion = Date.now();
      this.savedImageBytesSrc = null;
      this.imageDisplay.saved = true;
    }
    this.exitSavedImageEdit();
  }

  public savedImageVersion: number = Date.now();

  savedImageSrc(): string {
    if (!this.editableBanner?.fileNameData) {
      return null;
    }
    const fileName = this.editableBanner.fileNameData.rootFolder + "/" + this.editableBanner.fileNameData.awsFileName;
    const base = this.urlService.imageSource(fileName, true);
    return `${base}?v=${this.savedImageVersion}`;
  }

  bannerPreviewHeightChange(height: number) {
    this.editableBanner.bannerHeight = height || null;
    this.logger.debug("bannerPreviewHeightChange:", height);
  }

  private editablePapercutBackgroundBanner(): PapercutBackgroundBanner {
    const background: PapercutBackgroundBanner = this.editableBanner.banner as PapercutBackgroundBanner;
    if (!background?.photo?.image) {
      background.photo = this.defaultPaperCut().photo;
    }
    return background;
  }

  exitImageEdit() {
    this.bannerPhotoAwsFileData = null;
    this.bannerPhotoEditActive = false;
  }

  private refreshData() {
    this.bannerConfigService.all().then((banners) => {
      this.logger.info("retrieved banners:", banners);
      this.banners = banners.sort(sortBy("-createdAt"));
      this.notify.hide();
      this.selectFirstItem();
    });
  }

  private selectFirstItem() {
    if (this.banners.length === 0) {
      return;
    }
    if (this.syncBannerSelectionFromUrl()) {
      return;
    }
    this.bannerSelected(this.banners[0]);
  }

  create(defaultContent: BannerConfig) {
    const duplicatedBanner: BannerConfig = {
      ...defaultContent,
      id: null,
      name: "New Banner",
      createdAt: this.dateUtils.nowAsValue(),
      createdBy: this.memberLoginService.loggedInMember().memberId
    };
    this.banners = [duplicatedBanner].concat(this.banners);
    this.editableBanner = duplicatedBanner;
    this.isCollapsed = false;
  }

  duplicate() {
    const duplicatedBanner: BannerConfig = {
      ...this.editableBanner,
      id: null,
      name: "Copy of " + this.editableBanner.name,
      createdAt: this.dateUtils.nowAsValue(),
      createdBy: this.memberLoginService.loggedInMember().memberId
    };
    this.banners = [duplicatedBanner].concat(this.banners);
    this.editableBanner = duplicatedBanner;
  }

  defaultPaperCut(): PapercutBackgroundBanner {
    return {
      photo: {
        bannerImageType: RootFolder.bannerPhotos,
        show: true,
        image: {originalFileName: null, padding: 0, width: 300}
      },
      logo: {bannerImageType: RootFolder.logos, show: true, image: {padding: 0, width: 100}},
      background: {bannerImageType: RootFolder.backgrounds, show: true, image: {padding: 0, width: 100}},
      text: {show: true, value: "", padding: 0, fontSize: 15, class: null}
    };
  }

  defaultPaperCutBackgroundBanner(): BannerConfig {
    return {
      name: null,
      bannerType: BannerType.PAPERCUT_BACKGROUND,
      banner: this.defaultPaperCut(),
      createdAt: this.dateUtils.nowAsValue(),
      createdBy: this.memberLoginService.loggedInMember().memberId
    };
  }

  defaultLogoAndTextLinesBanner(): BannerConfig {
    return {
      name: null,
      bannerType: BannerType.LOGO_AND_TEXT_LINES,
      banner: this.defaultLogoAndTextLines(),
      createdAt: this.dateUtils.nowAsValue(),
      createdBy: this.memberLoginService.loggedInMember().memberId
    };
  }

  private defaultLogoAndTextLines(): LogoAndTextLinesBanner {
    const groupWords: string[] = this.config.group.longName.split(" ");
    return {
      logo: {columns: 2, bannerImageType: RootFolder.logos, show: true, image: {padding: 0, width: 100}},
      line1: {
        fontSize: 33,
        include: true,
        showIcon: true,
        part1: {value: this.wordsFor(0, 1, groupWords), class: this.white, show: true},
        part2: {value: this.wordsFor(1, 1, groupWords), class: this.white, show: true},
        part3: {value: this.wordsFor(2, null, groupWords), class: this.white, show: true},
      },
      line2: this.titleLine()
    };
  }

  public isPapercutBanner() {
    return this?.editableBanner?.bannerType === BannerType.PAPERCUT_BACKGROUND;
  }

  public isLogoAndTextLines() {
    return this?.editableBanner?.bannerType === BannerType.LOGO_AND_TEXT_LINES;
  }

  titleLine(): TitleLine {
    return {
      include: true,
      fontSize: 33,
      showIcon: true,
      part1: {value: "Walk", class: this.white, show: true},
      part2: {value: "Leader", class: this.white, show: true},
      part3: {value: "Notification", class: this.white, show: true}
    };
  }
  private wordsFor(indexFrom: number, indexTo: number, words: string[]) {
    const toIndex = indexTo ? indexFrom + indexTo : words.length;
    const indexRange = range(indexFrom, toIndex);
    const returnValue = words.length < 1 ? "Some Text" : indexRange.map(index => words[index]).join(" ");
    this.logger.info("wordsFor:indexFrom", indexFrom, "indexTo:", indexTo, "indexRange:", indexRange, "words:", words, "returnValue:", returnValue);
    return returnValue;
  }

  multiLineImageChange(image: Image) {
    this.logger.info("multiLineImageChange: ->", image);
    this.editableBanner.banner.logo.image = image;
  }

  undo() {
    this.logger.info("undoing changes and refreshing data:", this.editableBanner);
    this.refreshData();
  }

  saveImage() {
    this.saving = true;
    this.notify.success({
      title: "Banners",
      message: "Saving image for " + this.editableBanner.name
    }, true);
    if (this.bannerImage?.nativeElement) {
      this.logger.info("saving editableBanner:", this.editableBanner);
      this.captureService.getImage(this.bannerImage?.nativeElement, true)
        .pipe(
          tap((img: string) => {
            this.logger.info("image capture is", img);
            const awsFileData: AwsFileData = this.fileUtils.awsFileData(this.editableBanner?.fileNameData?.awsFileName || this.editableBanner.name, img, {
              type: IMAGE_JPEG,
              name: this.editableBanner.name,
              lastModified: null
            } as File);
            this.uploader.addToQueue([awsFileData.file]);
            this.uploader.uploadAll();
          })
        ).subscribe();
    } else {
      this.notify.warning({
        title: "Banners",
        message: `Cant save image for ${this.editableBanner.name} - try refreshing the page and trying again`
      });
      this.saving = false;
    }
  }

  private async saveBanner(): Promise<BannerConfig> {
    const response: BannerConfig = await this.bannerConfigService.createOrUpdate(this.editableBanner);
    this.logger.info("saved editableBanner:", response);
    return response;
  }

  exportBanner() {
    this.logger.info("exporting Banner:", this.editableBanner);
    this.captureService.getImage(this.bannerImage.nativeElement, true)
      .pipe(
        tap((img: string) => {
          this.logger.info("image capture is", img);
          this.captureService.downloadImage(img);
        })
      ).subscribe();
  }

  toBannerInformation(bannerConfig: BannerConfig) {
    const createdBy = this.members.length > 0 ? `by ${this.fullNamePipe.transform(this.memberService.toMember(bannerConfig.createdBy, this.members))} ` : "";
    return `${bannerConfig.name || "Unnamed"} created ${createdBy} on ${this.dateUtils.displayDate(bannerConfig.createdAt)} (${this.stringUtils.asTitle(bannerConfig.bannerType)})`;
  }

  bannerSelected(bannerConfig: BannerConfig) {
    this.logger.info("bannerSelected:", bannerConfig);
    const matchInList = bannerConfig?.id ? this.banners.find(b => b.id === bannerConfig.id) : null;
    const target = matchInList || bannerConfig;
    this.editableBanner = this.normaliseBanner(target);
    this.lastSavedBanner = cloneDeep(target);
    this.savedImageNaturalWidth = null;
    this.savedImageNaturalHeight = null;
    this.savedImageBytes = null;
    this.savedImageBytesSrc = null;
    const slug = this.bannerSlug(target);
    if (slug) {
      this.router.navigate([], {
        relativeTo: this.activatedRoute,
        queryParams: {[StoredValue.BANNER]: slug},
        queryParamsHandling: "merge"
      });
    }
  }

  private normaliseBanner(bannerConfig: BannerConfig): BannerConfig {
    if (!bannerConfig) {
      return bannerConfig;
    }
    if (bannerConfig.fileNameData?.rootFolder && bannerConfig.fileNameData?.awsFileName) {
      const prefix = `${bannerConfig.fileNameData.rootFolder}/`;
      const stripPrefixes = (name: string): string => name.startsWith(prefix) ? stripPrefixes(name.substring(prefix.length)) : name;
      bannerConfig.fileNameData.awsFileName = stripPrefixes(bannerConfig.fileNameData.awsFileName);
    }
    if (bannerConfig.bannerType === BannerType.LOGO_AND_TEXT_LINES) {
      const banner = bannerConfig.banner as LogoAndTextLinesBanner;
      banner.line1 = ensureTitleLine(banner.line1 || null);
      banner.line2 = ensureTitleLine(banner.line2 || null);
    }
    return bannerConfig;
  }

  dataChanged() {
    return !isEqual(this.lastSavedBanner, this.editableBanner) || !this.editableBanner?.fileNameData;
  }

  changedBannerType(bannerType: BannerType) {
    this.logger.info("changedBannerType:", bannerType);
  }

  delete() {
    if (this.editableBanner?.id) {
      this.bannerConfigService.delete(this.editableBanner).then(() => this.refreshData());
    } else {
      this.banners = this.banners.filter(item => item !== this.editableBanner);
      this.selectFirstItem();
    }

  }

  editPhoto() {
    this.isCollapsed = false;
    this.bannerPhotoEditActive = true;
  }

  preLoadImage() {
    const banner: PapercutBackgroundBanner = this?.editableBanner?.banner as PapercutBackgroundBanner;
    return this.bannerPhotoAwsFileData?.image || (this.bannerPhotoEditActive ? banner?.photo?.image?.awsFileName : null);
  }

  private updateAudit() {
    if (this.editableBanner.id) {
      this.editableBanner.createdAt = this.dateUtils.nowAsValue();
      this.editableBanner.createdBy = this.memberLoginService.loggedInMember().memberId;
    } else {
      this.editableBanner.updatedAt = this.dateUtils.nowAsValue();
      this.editableBanner.updatedBy = this.memberLoginService.loggedInMember().memberId;
    }
  }

  pageTitle() {
    const total = this.banners?.length || 0;
    if (!this.editableBanner || total === 0) {
      return `Banners - 0 of ${total}`;
    }
    const index = this.banners.findIndex(b => b.id && b.id === this.editableBanner.id);
    const ordinal = index >= 0 ? index + 1 : 1;
    return `Banners - ${ordinal} of ${total}`;
  }

  bannerSlug(bannerConfig: BannerConfig): string {
    return bannerConfig?.name ? kebabCase(bannerConfig.name) : (bannerConfig?.id || "");
  }

  compareBanners = (a: BannerConfig, b: BannerConfig): boolean => {
    if (!a || !b) {
      return a === b;
    }
    return a === b || (!!a.id && a.id === b.id);
  };

  private syncBannerSelectionFromUrl() {
    const slug = this.activatedRoute.snapshot.queryParams[StoredValue.BANNER];
    if (!slug || !this.banners?.length) {
      return false;
    }
    const match = this.banners.find(b => this.bannerSlug(b) === slug);
    if (match && match !== this.editableBanner) {
      this.bannerSelected(match);
      return true;
    }
    return false;
  }
}
