import { Component, inject, Input, OnInit } from "@angular/core";
import { Gallery, GalleryItem, ImageItem } from "ng-gallery";
import { RootFolder } from "../../models/system.model";
import { ContentMetadata, ContentMetadataItem } from "../../models/content-metadata.model";
import { PageService } from "../../services/page.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { UrlService } from "../../services/url.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import take from "lodash-es/take";
import { DateUtilsService } from "../../services/date-utils.service";
import {
  faBorderAll,
  faBorderNone,
  faChevronCircleDown,
  faChevronCircleLeft,
  faChevronCircleRight,
  faChevronCircleUp,
  faCircleArrowDown,
  faCircleArrowLeft,
  faCircleArrowRight,
  faCircleArrowUp,
  faFileArrowUp,
  faGripHorizontal,
  faGripVertical,
  faHeader,
  faIdCard,
  faImage,
  faImages,
  faList,
  faMaximize,
  faMinimize,
  faPhotoFilm,
  faRectangleAd,
  faRectangleList,
  faSearch,
  faSortAlphaDownAlt,
  faSortAlphaUp,
  faSortNumericAsc,
  faSortNumericDesc,
  faTable,
  faTableCells,
  faTableCellsLarge,
  faTableColumns,
  faVrCardboard
} from "@fortawesome/free-solid-svg-icons";
import { AlbumData, AlbumView, GridViewOptions } from "../../models/content-text.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-album",
  styleUrls: ["../../pages/home/home.component.sass"],
  template: `
      <div class="row">
          <div *ngIf="album.allowSwitchView" class="col-sm-12">
              <div class="float-right mb-1">
                  <app-badge-button [tooltip]="'view as carousel'" [active]="albumView===AlbumView.CAROUSEL"
                                    [icon]="faImage"
                                    (click)="viewCarousel()" caption="carousel"/>
                  <app-badge-button [tooltip]="'view as gallery'" [active]="albumView===AlbumView.GALLERY"
                                    [icon]="faPhotoFilm"
                                    (click)="viewGallery()" caption="gallery"/>
                  <app-badge-button [tooltip]="'view as grid'" [active]="albumView===AlbumView.GRID"
                                    [icon]="faTableCells"
                                    [noRightMargin]="albumView!==AlbumView.GRID"
                                    (click)="viewAsGrid()" caption="grid"/>
                  <app-badge-button *ngIf="albumView===AlbumView.GRID" [tooltip]="'show titles'"
                                    [active]="gridViewOptions.showTitles" [icon]="faRectangleAd"
                                    noRightMargin
                                    (click)="toggleShowTitles()" caption="titles"/>
              </div>
          </div>
          <div class="col-sm-12">
              <ng-container *ngIf="false">
                  <app-icon-examples/>
                  <app-badge-button [icon]="faGripHorizontal" caption="faGripHorizontal"></app-badge-button>
                  <app-badge-button [icon]="faList" caption="faList"></app-badge-button>
                  <app-badge-button [icon]="faGripVertical" caption="faGripVertical"></app-badge-button>
                  <app-badge-button [icon]="faMaximize" caption="faMaximize"></app-badge-button>
                  <app-badge-button [icon]="faMinimize" caption="faMinimize"></app-badge-button>
                  <app-badge-button [icon]="faVrCardboard" caption="faVrCardboard"></app-badge-button>
                  <app-badge-button [icon]="faImages" caption="faImages"></app-badge-button>
                  <app-badge-button [icon]="faRectangleAd" caption="faRectangleAd"></app-badge-button>
                  <app-badge-button [icon]="faBorderAll" caption="faBorderAll"></app-badge-button>
                  <app-badge-button [icon]="faBorderNone" caption="faBorderNone"></app-badge-button>
                  <app-badge-button [icon]="faChevronCircleDown" caption="faChevronCircleDown"></app-badge-button>
                  <app-badge-button [icon]="faChevronCircleLeft" caption="faChevronCircleLeft"></app-badge-button>
                  <app-badge-button [icon]="faChevronCircleRight" caption="faChevronCircleRight"></app-badge-button>
                  <app-badge-button [icon]="faChevronCircleUp" caption="faChevronCircleUp"></app-badge-button>
                  <app-badge-button [icon]="faCircleArrowDown" caption="faCircleArrowDown"></app-badge-button>
                  <app-badge-button [icon]="faCircleArrowLeft" caption="faCircleArrowLeft"></app-badge-button>
                  <app-badge-button [icon]="faCircleArrowRight" caption="faCircleArrowRight"></app-badge-button>
                  <app-badge-button [icon]="faCircleArrowUp" caption="faCircleArrowUp"></app-badge-button>
                  <app-badge-button [icon]="faFileArrowUp" caption="faFileArrowUp"></app-badge-button>
                  <app-badge-button [icon]="faHeader" caption="faHeader"></app-badge-button>
                  <app-badge-button [icon]="faIdCard" caption="faIdCard"></app-badge-button>
                  <app-badge-button [icon]="faMinimize" caption="faMinimize"></app-badge-button>
                  <app-badge-button [icon]="faRectangleList" caption="faRectangleList"></app-badge-button>
                  <app-badge-button [icon]="faRectangleAd" caption="faRectangleAd"></app-badge-button>
                  <app-badge-button [icon]="faSearch" caption="faSearch"></app-badge-button>
                  <app-badge-button [icon]="faSortAlphaDownAlt" caption="faSortAlphaDownAlt"></app-badge-button>
                  <app-badge-button [icon]="faSortAlphaUp" caption="faSortAlphaUp"></app-badge-button>
                  <app-badge-button [icon]="faSortNumericAsc" caption="faSortNumericAsc"></app-badge-button>
                  <app-badge-button [icon]="faSortNumericDesc" caption="faSortNumericDesc"></app-badge-button>
                  <app-badge-button [icon]="faTable" caption="faTable"></app-badge-button>
                  <app-badge-button [icon]="faTableCellsLarge" caption="faTableCellsLarge"></app-badge-button>
                  <app-badge-button [icon]="faTableColumns" caption="faTableColumns"></app-badge-button>
              </ng-container>
              <gallery *ngIf="albumView===AlbumView.GALLERY" [items]="(preview? take(images,2):images)"
                       thumbPosition="left"
                       [imageSize]="'cover'"
                       [thumbImageSize]="'cover'" thumbPosition="bottom"></gallery>
              <div *ngIf="albumView===AlbumView.GRID" class="card-columns">
                  <div class="card"
                       *ngFor="let image of (preview? take(contentMetadata?.files,2):contentMetadata?.files)">
                      <img class="card-img-top" [src]="imageSourceFor(image.image)" [alt]="image.text">
                      <div *ngIf="gridViewOptions.showTitles" class="card-body">
                          <h6 class="card-title">{{image.text}}</h6>
                          <p class="card-text">{{dateUtils.displayDate(image.date)}}</p>
                      </div>
                  </div>
              </div>
              <app-carousel *ngIf="albumView===AlbumView.CAROUSEL" [carouselData]="album"
                            [index]="index"></app-carousel>
          </div>
      </div>
  `
})
export class AlbumComponent implements OnInit {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("GalleryComponent", NgxLoggerLevel.OFF);

  public preview: boolean;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  @Input()
  public index: number;
  @Input()
  album: AlbumData;
  public gallery: Gallery = inject(Gallery);
  public pageService: PageService = inject(PageService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private urlService: UrlService = inject(UrlService);
  images: GalleryItem[];
  public contentMetadata: ContentMetadata;
  public galleryId: string;
  public albumView: AlbumView = AlbumView.GRID;
  protected readonly take = take;
  protected readonly faPhotoFilm = faPhotoFilm;
  protected readonly faList = faList;
  protected readonly faVrCardboard = faVrCardboard;
  protected readonly faImages = faImages;
  protected readonly faImage = faImage;
  protected readonly faRectangleAd = faRectangleAd;
  protected readonly faMaximize = faMaximize;
  protected readonly faMinimize = faMinimize;
  protected readonly faGripVertical = faGripVertical;
  protected readonly faTableColumns = faTableColumns;
  protected readonly faTableCellsLarge = faTableCellsLarge;
  protected readonly faTableCells = faTableCells;
  protected readonly faChevronCircleLeft = faChevronCircleLeft;
  protected readonly faChevronCircleDown = faChevronCircleDown;
  protected readonly faBorderNone = faBorderNone;
  protected readonly faBorderAll = faBorderAll;
  protected readonly faCircleArrowDown = faCircleArrowDown;
  protected readonly faChevronCircleRight = faChevronCircleRight;
  protected readonly faChevronCircleUp = faChevronCircleUp;
  protected readonly faCircleArrowLeft = faCircleArrowLeft;
  protected readonly faCircleArrowRight = faCircleArrowRight;
  protected readonly faCircleArrowUp = faCircleArrowUp;
  protected readonly faFileArrowUp = faFileArrowUp;
  protected readonly faHeader = faHeader;
  protected readonly faIdCard = faIdCard;
  protected readonly faRectangleList = faRectangleList;
  protected readonly faSearch = faSearch;
  protected readonly faSortAlphaDownAlt = faSortAlphaDownAlt;
  protected readonly faSortAlphaUp = faSortAlphaUp;
  protected readonly faSortNumericAsc = faSortNumericAsc;
  protected readonly faSortNumericDesc = faSortNumericDesc;
  protected readonly faTable = faTable;
  protected readonly faGripHorizontal = faGripHorizontal;
  public gridViewOptions: GridViewOptions = {showTitles: true, showDates: true};

  protected readonly AlbumView = AlbumView;

  ngOnInit() {
    this.galleryId = "myLightbox";
    this.logger.info("ngOnInit:album:", this.album);
    if (this.album.albumView) {
      this.albumView = this.album.albumView;
    }
    this.contentMetadataService.items(RootFolder.carousels, this.album.name)
      .then(contentMetadata => {
        this.contentMetadata = contentMetadata;
        this.logger.info("initialised with", this?.contentMetadata?.files?.length, "slides in total");
        this.images = this?.contentMetadata?.files.map(file => new ImageItem({
          src: this.imageSourceFor(file.image),
          thumb: this.imageSourceFor(file.image)
        }));
        const galleryRef = this.gallery.ref();
        galleryRef.load(this.images);
      });
  }

  imageWidth(media: ContentMetadataItem): string {
    return this?.contentMetadata?.files.indexOf(media) <= 1 ? "50%" : "25%";
  }

  imageHeight(media: ContentMetadataItem): string {
    return this?.contentMetadata?.files.indexOf(media) <= 1 ? "250px" : "130px";
  }

  imageSourceFor(file: string): string {
    return this.urlService.imageSource(this.contentMetadataService.qualifiedFileNameWithRoot(this.contentMetadata?.rootFolder, this.contentMetadata?.name, file));
  }

  viewCarousel() {
    this.albumView = AlbumView.CAROUSEL;
  }

  viewAsGrid() {
    this.albumView = AlbumView.GRID;
  }

  toggleShowTitles() {
    this.gridViewOptions.showTitles = !this.gridViewOptions.showTitles;
  }

  viewGallery() {
    this.albumView = AlbumView.GALLERY;
  }
}
