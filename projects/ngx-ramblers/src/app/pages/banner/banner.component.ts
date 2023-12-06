import { Component, OnDestroy, OnInit } from "@angular/core";
import range from "lodash-es/range";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../auth/auth.service";
import { AwsFileData } from "../../models/aws-object.model";
import {
  BannerConfig,
  BannerType,
  LogoAndTextLinesBanner,
  PapercutBackgroundBanner,
  TitleLine
} from "../../models/banner-configuration.model";
import { Member } from "../../models/member.model";
import { RootFolder, colourSelectors, Image, SystemConfig } from "../../models/system.model";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { sortBy } from "../../services/arrays";
import { BannerConfigService } from "../../services/banner-config.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { enumKeyValues, KeyValue } from "../../services/enums";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";
import { faTableCells } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-banner",
  styleUrls: ["./banner.component.sass"],
  template: `
      <app-page autoTitle>
          <div class="fixed-height">
              <div class="col-12">
                  <label for="banner-lookup">Existing Banners ({{banners?.length}}):</label>
                  <select class="form-control input-sm"
                          id="banner-lookup"
                          [(ngModel)]="editableBanner" (ngModelChange)="changedBanner($event)">
                      <option *ngFor="let banner of banners"
                              [ngValue]="banner">{{toBannerInformation(banner)}}</option>
                  </select>
              </div>
              <div class="col-sm-12 mt-3">
                  <div class="btn-group" dropdown>
                      <button aria-controls="dropdown-animated" class="dropdown-toggle btn btn-primary" dropdownToggle
                              type="button">
                          <span class="ml-2">New</span><span class="caret"></span>
                      </button>
                      <ul *dropdownMenu class="dropdown-menu"
                          id="dropdown-animated" role="menu">
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
                  <button [attr.aria-expanded]="!isCollapsed" (click)="isCollapsed = !isCollapsed"
                          class="btn btn-primary ml-2"
                          type="button">{{isCollapsed ? 'Edit' : 'Close Edit'}}</button>
                  <ng-container *ngIf="allowContentEdits">
                      <button *ngIf="!bannerPhotoEditActive" class="btn btn-primary ml-2" type="button"
                              (click)="editPhoto()">Edit
                          Photo
                      </button>
                      <button (click)="duplicate()" class="btn btn-primary ml-2"
                              type="button">Duplicate
                      </button>
                      <button (click)="delete()" class="btn btn-primary ml-2"
                              type="button">Delete
                      </button>
                      <button class="btn btn-primary ml-2" type="button" (click)="cancel()">Undo Changes</button>
                      <div class="float-right">
                          <button class="btn btn-primary" type="button" (click)="save()">Save All Changes</button>
                      </div>
                  </ng-container>
              </div>
              <div class="col-sm-12 mt-3">
                  <div class="collapse" [collapse]="isCollapsed" [isAnimated]="true">
                      <div class="card card-body mb-3">
                          <ng-container *ngIf="editableBanner">
                              <div class="row">
                                  <div class="col-6">
                                      <label for="name">Banner name</label>
                                      <input [disabled]="!allowContentEdits" [(ngModel)]="editableBanner.name"
                                             id="name"
                                             type="text" class="form-control input-sm"
                                             placeholder="Enter name of banner">
                                  </div>
                                  <div class="col-6">
                                      <label for="banner-type">Banner Type:</label>
                                      <select [disabled]="!allowContentEdits" class="form-control input-sm"
                                              id="banner-type"
                                              [(ngModel)]="editableBanner.bannerType"
                                              (ngModelChange)="changedBannerType($event)">
                                          <option *ngFor="let bannerType of bannerTypes"
                                                  [ngValue]="bannerType.value">{{stringUtils.asTitle(bannerType.value)}}</option>
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
                                                               [id]="'1'"></app-banner-title-config>
                                  </div>
                                  <div class="col-sm-6">
                                      <app-banner-title-config [titleLine]="editableBanner.banner.line2"
                                                               [id]="'2'"></app-banner-title-config>
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
                              <div class="row">
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
                                      <app-colour-selector [itemWithClass]="editableBanner.banner?.text">
                                      </app-colour-selector>
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
              <div class="col-sm-12 mt-3">
                  <app-papercut-output *ngIf="isPapercutBanner()" [banner]="editableBanner.banner"
                                       [tempImage]="bannerPhotoAwsFileData?.image"></app-papercut-output>
                  <app-banner-logo-and-text-lines-output *ngIf="isLogoAndTextLines()"
                                                         [banner]="editableBanner.banner"></app-banner-logo-and-text-lines-output>
              </div>
          </div>
      </app-page>`
})

export class BannerComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public bannerPhotos: RootFolder = RootFolder.bannerPhotos;
  public allowContentEdits: boolean;
  public showIcon = true;
  public config: SystemConfig;
  public logos: RootFolder = RootFolder.logos;
  public bannerTypes: KeyValue<string>[] = enumKeyValues(BannerType);
  public backgrounds: RootFolder = RootFolder.backgrounds;
  public banners: BannerConfig[];
  public editableBanner: BannerConfig;
  public isCollapsed = true;
  hide = colourSelectors[0].class;
  white = colourSelectors[1].class;
  public members: Member[] = [];
  public bannerPhotoAwsFileData: AwsFileData;
  public bannerPhotoEditActive: boolean;
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    public memberLoginService: MemberLoginService,
    private fullNamePipe: FullNamePipe,
    public stringUtils: StringUtilsService,
    private memberService: MemberService,
    private bannerConfigService: BannerConfigService,
    private systemConfigService: SystemConfigService,
    private dateUtils: DateUtilsService,
    public urlService: UrlService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BannerComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.refreshCachedData();
    this.refreshData();
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
    const background = this.editableBanner.banner as PapercutBackgroundBanner;
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
      this.selectFirstItem();
    });
  }

  private selectFirstItem() {
    if (this.banners.length > 0) {
      this.editableBanner = this.banners[0];
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
  };

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
  };

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
  };

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

  cancel() {
    this.logger.info("cancelling and undoing changes:", this.editableBanner);
    this.refreshData();
  }

  save() {
    this.logger.info("saving editableBanner:", this.editableBanner);
    this.bannerConfigService.createOrUpdate(this.editableBanner).then((response => this.logger.info("saved editableBanner:", response)));
  }

  toBannerInformation(bannerConfig: BannerConfig) {
    const createdBy = this.members.length > 0 ? `by ${this.fullNamePipe.transform(this.memberService.toMember(bannerConfig.createdBy, this.members))} ` : "";
    return `${bannerConfig.name || "Unnamed"} created ${createdBy} on ${this.dateUtils.displayDate(bannerConfig.createdAt)} (${this.stringUtils.asTitle(bannerConfig.bannerType)})`;
  }

  changedBanner(bannerConfig: BannerConfig) {
    this.logger.info("selected bannerConfig:", bannerConfig);
  }

  changedBannerType(bannerType: BannerType) {
    this.logger.info("selected bannerType:", bannerType);
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

  protected readonly faTableCells = faTableCells;
}
