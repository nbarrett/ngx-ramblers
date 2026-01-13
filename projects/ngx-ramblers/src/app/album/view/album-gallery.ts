import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { Gallery, GalleryComponent, GalleryImageDef, GalleryRef, GalleryState, ImageItem, IframeItem } from "ng-gallery";
import { ContentMetadata, ContentMetadataItem, LazyLoadingMetadata } from "../../models/content-metadata.model";
import { PageService } from "../../services/page.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { UrlService } from "../../services/url.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../../services/date-utils.service";
import { AlbumData, AlbumView, ImageFit, LoadingStrategy, ThumbPosition, ThumbView, VerticalPosition } from "../../models/content-text.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { YouTubeService } from "../../services/youtube.service";
import { YouTubeQuality } from "../../models/youtube.model";

@Component({
    selector: "app-album-gallery",
    styleUrls: ["./album-gallery.sass"],
    template: `
      @if (showGallery && hasMediaItems) {
        <gallery class="gallery-customise mt-4"
                 [id]="galleryDomId || galleryId"
                 [autoPlay]="album?.slideInterval>0"
                 [playerInterval]="album?.slideInterval"
                 [imageSize]="ImageFit.COVER"
                 [thumbPosition]="album.galleryViewOptions?.thumbPosition || ThumbPosition.LEFT"
                 [thumbView]="ThumbView.DEFAULT"
                 [thumbImageSize]="album.galleryViewOptions?.thumbImageSize || ImageFit.COVER"
                 [thumb]="!album.galleryViewOptions?.thumb"
                 [loadingStrategy]="album.galleryViewOptions?.loadingStrategy || LoadingStrategy.LAZY"
                 [dots]="album?.galleryViewOptions?.dots||true"
                 (indexChange)="indexChange($event)"
                 [dotsPosition]="album?.galleryViewOptions?.dotsPosition || VerticalPosition.BOTTOM">
          <ng-container *galleryImageDef="let item; let active = active">
            @if (active) {
              <div class="item-panel-heading">
                <div>{{ item?.alt }}</div>
              </div>
            }
          </ng-container>
        </gallery>
      }`,
    imports: [GalleryComponent, GalleryImageDef]
})

export class AlbumGalleryComponent implements OnInit, OnDestroy {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumGalleryComponent", NgxLoggerLevel.ERROR);
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
  protected urlService: UrlService = inject(UrlService);
  private lazyLoadingMetadataService: LazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  private youtubeService: YouTubeService = inject(YouTubeService);
  public contentMetadata: ContentMetadata;
  public galleryId: string;
  public galleryDomId: string;
  public albumView: AlbumView = AlbumView.GRID;
  public showGallery = false;
  private autoPlayEnabled = true;
  protected readonly ImageFit = ImageFit;
  protected readonly ThumbPosition = ThumbPosition;
  protected readonly ThumbView = ThumbView;
  protected readonly LoadingStrategy = LoadingStrategy;
  protected readonly VerticalPosition = VerticalPosition;

  ngOnInit() {
    this.logger.info("ngOnInit:album:", this.album, "with galleryId:", this.galleryId);
    this.youtubeService.setupIframeTracking((state) => this.handlePlayerStateChange(state));
  }

  ngOnDestroy() {
    this.youtubeService.cleanupIframeTracking();
  }

  private handlePlayerStateChange(state: number) {
    const isPlaying = state === 1;
    if (isPlaying) {
      this.galleryRef?.stop();
      this.autoPlayEnabled = false;
      this.logger.info("Video playing - gallery autoplay paused");
    } else {
      if (!this.autoPlayEnabled && this.album?.slideInterval > 0) {
        this.galleryRef?.play();
        this.autoPlayEnabled = true;
        this.logger.info("Video stopped - gallery autoplay resumed");
      }
    }
  }

  private initialiseMetadata() {
    if (this.lazyLoadingMetadata?.selectedSlides && this.album) {
      if (this.album.albumView) {
        this.albumView = this.album.albumView;
      }
      this.showGallery = false;
      this.galleryId = this.stringUtils.kebabCase(this.album.name);
      this.galleryDomId = `${this.galleryId}-${this.dateUtils.dateTimeNowAsValue()}`;
      const items = this.mediaItems.map(item => this.toGalleryItem(item));
      setTimeout(() => {
        this.showGallery = true;
        this.galleryRef = this.gallery.ref(this.galleryDomId);
        if (this.galleryRef) {
          try {
            this.logger.info("initialiseMetadata:resetting galleryRef with galleryDomId:", this.galleryDomId);
            this.galleryRef.reset();
          } catch (e) {
            this.logger.error(e);
          }
        } else {
          this.logger.info("initialiseMetadata:not resetting galleryRef:", this.galleryRef);
        }
        this.logger.info("initialiseMetadata:lazyLoadingMetadata:", this.lazyLoadingMetadata, "loading items:", items);
        this.galleryRef.load(items);
        this.youtubeService.triggerIframeTracking();
      });
    } else {
      this.logger.info("initialiseMetadata:lazyLoadingMetadata not initialised yet:");
    }
  }

  private toGalleryItem(item: ContentMetadataItem): ImageItem | IframeItem {
    if (item.youtubeId) {
      return new IframeItem({
        src: this.youtubeService.embedUrl(item.youtubeId, true),
        thumb: this.youtubeService.thumbnailUrl(item.youtubeId, YouTubeQuality.HQ)
      });
    }
    return new ImageItem({
      alt: item.text,
      src: this.urlService.imageSourceFor(item, this?.lazyLoadingMetadata.contentMetadata),
      thumb: this.urlService.imageSourceFor(item, this?.lazyLoadingMetadata.contentMetadata)
    });
  }

  get mediaItems(): ContentMetadataItem[] {
    return this.lazyLoadingMetadata?.selectedSlides || [];
  }

  get hasMediaItems(): boolean {
    return this.mediaItems.length > 0;
  }

  indexChange(galleryState: GalleryState) {
    this.logger.debug("itemsChange:", galleryState, "selectedSlides:", this.lazyLoadingMetadata?.selectedSlides);
    const slideNumber = galleryState.currIndex + 1;
    if (slideNumber >= this.lazyLoadingMetadata?.selectedSlides?.length - 2) {
      this.lazyLoadingMetadataService.add(this.lazyLoadingMetadata, 1, "active slide change");
    } else {
      this.logger.info("Not adding new item as slide number is", slideNumber, "selectedSlide count:", this.lazyLoadingMetadata.selectedSlides.length);
    }
    this.youtubeService.triggerIframeTracking();
  }

}
