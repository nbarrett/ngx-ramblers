import { NgxCaptureService } from "ngx-capture";
import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import range from "lodash-es/range";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../auth/auth.service";
import { AwsFileData, AwsFileUploadResponse, AwsFileUploadResponseData } from "../../models/aws-object.model";
import {
  BannerConfig,
  BannerType,
  LogoAndTextLinesBanner,
  PapercutBackgroundBanner,
  TitleLine
} from "../../models/banner-configuration.model";
import { Member } from "../../models/member.model";
import { colourSelectors, Image, RootFolder, SystemConfig } from "../../models/system.model";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { sortBy } from "../../functions/arrays";
import { BannerConfigService } from "../../services/banner-config.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { enumKeyValues, KeyValue } from "../../functions/enums";
import { LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";
import { faTableCells } from "@fortawesome/free-solid-svg-icons";
import { tap } from "rxjs/operators";
import { HttpErrorResponse } from "@angular/common/http";
import { FileUploader } from "ng2-file-upload";
import { FileUploadService } from "../../services/file-upload.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { AlertTarget } from "../../models/alert-target.model";
import { FileUtilsService } from "../../file-utils.service";
import { IMAGE_JPEG } from "../../models/content-metadata.model";
import cloneDeep from "lodash-es/cloneDeep";
import isEqual from "lodash-es/isEqual";

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
                  [(ngModel)]="editableBanner" (ngModelChange)="bannerSelected($event)">
            <option *ngFor="let banner of banners"
                    [ngValue]="banner">{{ toBannerInformation(banner) }}
            </option>
          </select>
        </div>
        <div class="btn-group" dropdown>
          <button aria-controls="dropdown-banner-animated" class="dropdown-toggle btn btn-primary" dropdownToggle
                  type="button">
            <span class="ml-1">New</span><span class="caret"></span>
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
                class="btn btn-primary ml-1"
                type="button">{{ isCollapsed ? 'Edit' : 'Close Edit' }}
        </button>
        <ng-container *ngIf="allowContentEdits">
          <button *ngIf="!bannerPhotoEditActive" [disabled]="saving" class="btn btn-primary ml-1" type="button"
                  (click)="editPhoto()">Edit
            Photo
          </button>
          <button (click)="duplicate()" [disabled]="saving" class="btn btn-primary ml-1"
                  type="button">Duplicate
          </button>
          <button (click)="delete()" [disabled]="saving" class="btn btn-primary ml-1"
                  type="button">Delete
          </button>
          <button class="btn btn-primary ml-1" [disabled]="saving||!this.dataChanged()" type="button" (click)="undo()">
            Undo
          </button>
          <button class="btn btn-primary ml-1" [disabled]="saving||!this.dataChanged()" type="button"
                  (click)="saveImage()">Save
          </button>
          <button class="btn btn-primary ml-1" type="button" [disabled]="saving" (click)="exportBanner()">Export
          </button>
        </ng-container>
        <button class="btn btn-primary ml-1" name="editable" [(ngModel)]="imageDisplay.editable"
                [class.active]="imageDisplay.editable"
                btnCheckbox tabindex="0" role="button">Editable
        </button>
        <button class="btn btn-primary ml-1" [(ngModel)]="imageDisplay.saved" [class.active]="imageDisplay.saved"
                btnCheckbox tabindex="0" name="saved" role="button">Saved
        </button>
        <div class="mt-3">
          <div *ngIf="notifyTarget.showAlert" class="row">
            <div class="col-sm-12">
              <div class="alert {{notifyTarget.alertClass}}">
                <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
                <strong
                  *ngIf="notifyTarget.alertTitle">
                  {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
              </div>
            </div>
          </div>
          <div class="collapse" [collapse]="isCollapsed" [isAnimated]="true">
            <div class="card card-body mb-3">
              <ng-container *ngIf="editableBanner">
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
                      <option *ngFor="let bannerType of bannerTypes"
                              [ngValue]="bannerType.value">{{ stringUtils.asTitle(bannerType.value) }}
                      </option>
                    </select>
                  </div>
                </div>
              </ng-container>
              <ng-container *ngIf="isLogoAndTextLines()">
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
              </ng-container>
              <ng-container *ngIf="isPapercutBanner()">
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
                <div class="row" *ngIf="editableBanner?.banner">
                  <div class="col-sm-6">
                    <label>Banner Text:</label>
                    <textarea class="form-control input-sm" rows="3"
                              [(ngModel)]="editableBanner.banner.text.value"></textarea>
                  </div>
                  <div class="col-sm-6" *ngIf="editableBanner?.banner?.photo?.image">
                    <label>Image Source:</label>
                    <input class="form-control input-sm"
                           [(ngModel)]="editableBanner.banner.photo.image.awsFileName"/>
                  </div>
                  <div class="col-sm-6">
                    <app-colour-selector [itemWithClass]="editableBanner.banner?.text"/>
                  </div>
                  <div class="col-sm-12 mt-4">
                    <app-image-cropper-and-resizer
                      *ngIf="bannerPhotoEditActive"
                      [rootFolder]="bannerPhotos"
                      [preloadImage]="preLoadImage()"
                      (imageChange)="imageChange($event)"
                      (quit)="exitImageEdit()"
                      (save)="imagedSaved($event)">
                    </app-image-cropper-and-resizer>
                  </div>
                </div>
              </ng-container>
            </div>
          </div>
        </div>
        <div *ngIf="imageDisplay.editable" #bannerImage class="show-border">
          <app-papercut-output *ngIf="isPapercutBanner()" [banner]="editableBanner.banner"
                               [tempImage]="bannerPhotoAwsFileData?.image"/>
          <app-banner-logo-and-text-lines-output *ngIf="isLogoAndTextLines()"
                                                 [banner]="editableBanner.banner"/>
        </div>
        <div *ngIf="editableBanner?.fileNameData && imageDisplay.saved" class="row w-100 mx-0 mt-2">
          <img class="card-img"
               [src]="urlService.imageSource(editableBanner.fileNameData.rootFolder + '/' + editableBanner.fileNameData.awsFileName)">
        </div>
      </div>
    </app-page>`
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
  private fileUtils: FileUtilsService = inject(FileUtilsService);
  public urlService: UrlService = inject(UrlService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger(BannerComponent, NgxLoggerLevel.OFF);
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
            this.bannerSelected(bannerConfigSaveResponse);
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
    if (this.banners.length > 0) {
      this.editableBanner = this.banners[0];
      this.bannerSelected(this.editableBanner);
    }
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
    });
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
    this.lastSavedBanner = cloneDeep(bannerConfig);
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
    return "Banners (" + (this.banners?.length || 0) + " saved)";
  }
}
