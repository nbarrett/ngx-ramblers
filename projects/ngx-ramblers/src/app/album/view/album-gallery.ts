import { Component, inject, Input, OnInit } from "@angular/core";
import { Gallery, GalleryRef, GalleryState, ImageItem } from "ng-gallery";
import { ContentMetadata, ContentMetadataItem, LazyLoadingMetadata } from "../../models/content-metadata.model";
import { PageService } from "../../services/page.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { UrlService } from "../../services/url.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../../services/date-utils.service";
import { faImages, faSearch } from "@fortawesome/free-solid-svg-icons";
import { AlbumData, AlbumView } from "../../models/content-text.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";
import { StringUtilsService } from "../../services/string-utils.service";

@Component({
  selector: "app-album-gallery",
  styleUrls: ["./album-gallery.sass"],
  template: `
      <gallery *ngIf="galleryId" class="gallery-customise"
               [id]="galleryId"
               [autoPlay]="album?.slideInterval>0"
               [playerInterval]="album?.slideInterval"
               imageSize="cover"
               [thumbPosition]="album.galleryViewOptions?.thumbPosition ||'left'"
               [thumbView]="'default'"
               [thumbImageSize]="album.galleryViewOptions?.thumbImageSize || 'cover'"
               [loadingStrategy]="album.galleryViewOptions?.loadingStrategy || 'lazy'"
               [dots]="album?.galleryViewOptions?.dots||true"
               (indexChange)="indexChange($event)"
               [dotsPosition]="album?.galleryViewOptions?.dotsPosition ||'bottom'">
          <ng-container *galleryImageDef="let item; let active = active">
              <div *ngIf="active" class="item-panel-heading">
                  <div>{{item?.alt}}</div>
              </div>
          </ng-container>
      </gallery>`
})

export class AlbumGalleryComponent implements OnInit {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumGalleryComponent", NgxLoggerLevel.OFF);
  public preview: boolean;
  private galleryRef: GalleryRef;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  @Input("lazyLoadingMetadata") set lazyLoadingMetadataValue(lazyLoadingMetadata: LazyLoadingMetadata) {
    this.lazyLoadingMetadata = lazyLoadingMetadata;
    this.initialiseMetadata();
  }

  @Input("album") set albumDataValue(album: AlbumData) {
    this.album = album;
    this.initialiseMetadata();
  }

  @Input()
  public index: number;
  public lazyLoadingMetadata: LazyLoadingMetadata;
  public album: AlbumData;
  public gallery: Gallery = inject(Gallery);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public pageService: PageService = inject(PageService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  private urlService: UrlService = inject(UrlService);
  private lazyLoadingMetadataService: LazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  public contentMetadata: ContentMetadata;
  public galleryId: string;
  public albumView: AlbumView = AlbumView.GRID;
  protected readonly faImages = faImages;
  protected readonly faSearch = faSearch;

  ngOnInit() {
    this.logger.info("ngOnInit:album:", this.album, "with galleryId:", this.galleryId);
  }

  private initialiseMetadata() {
    if (this.lazyLoadingMetadata?.selectedSlides && this.album) {
      if (this.album.albumView) {
        this.albumView = this.album.albumView;
      }
      this.galleryId = this.stringUtils.kebabCase(this.album.name);
      this.galleryRef = this.gallery.ref(this.galleryId);
      const images = this.lazyLoadingMetadata.selectedSlides.map(item => this.toImage(item));
      this.logger.info("lazyLoadingMetadata:", this.lazyLoadingMetadata, "loading images:", images);
      this.galleryRef.load(images);
    } else {
      this.logger.info("lazyLoadingMetadata not initialised yet:");
    }
  }

  private toImage(item: ContentMetadataItem) {
    return new ImageItem({
      alt: item.text,
      src: this.urlService.imageSourceFor(item, this?.lazyLoadingMetadata.contentMetadata),
      thumb: this.urlService.imageSourceFor(item, this?.lazyLoadingMetadata.contentMetadata)
    });
  }

  indexChange(galleryState: GalleryState) {
    this.logger.debug("itemsChange:", galleryState, "selectedSlides:", this.lazyLoadingMetadata?.selectedSlides);
    const slideNumber = galleryState.currIndex + 1;
    if (slideNumber >= this.lazyLoadingMetadata?.selectedSlides?.length - 2) {
      this.lazyLoadingMetadataService.add(this.lazyLoadingMetadata, 1, "active slide change").map(item => this.galleryRef.add(this.toImage(item)));
    } else {
      this.logger.info("Not adding new item as slide number is", slideNumber, "selectedSlide count:", this.lazyLoadingMetadata.selectedSlides.length);
    }
  }

}
