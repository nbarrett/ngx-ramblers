import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { Gallery, GalleryComponent, GalleryImageDef, GalleryRef, GalleryState, ImageItem, IframeItem } from "ng-gallery";
import { ContentMetadata, ContentMetadataItem, LazyLoadingMetadata } from "../../models/content-metadata.model";
import { PageService } from "../../services/page.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { UrlService } from "../../services/url.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../../services/date-utils.service";
import { AlbumData, AlbumView } from "../../models/content-text.model";
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
                 imageSize="cover"
                 [thumbPosition]="album.galleryViewOptions?.thumbPosition ||'left'"
                 [thumbView]="'default'"
                 [thumbImageSize]="album.galleryViewOptions?.thumbImageSize || 'cover'"
                 [thumb]="!album.galleryViewOptions?.thumb"
                 [loadingStrategy]="album.galleryViewOptions?.loadingStrategy || 'lazy'"
                 [dots]="album?.galleryViewOptions?.dots||true"
                 (indexChange)="indexChange($event)"
                 [dotsPosition]="album?.galleryViewOptions?.dotsPosition ||'bottom'">
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
  private messageListener: any;
  private autoPlayEnabled = true;

  ngOnInit() {
    this.logger.info("ngOnInit:album:", this.album, "with galleryId:", this.galleryId);
    this.setupYouTubeMessageListener();
  }

  ngOnDestroy() {
    if (this.messageListener) {
      window.removeEventListener("message", this.messageListener);
    }
  }

  private setupYouTubeMessageListener() {
    this.logger.info("Setting up YouTube message listener");
    this.messageListener = (event: MessageEvent) => {
      this.logger.info("Received postMessage event from:", event.origin, "data:", event.data);

      if (event.origin !== "https://www.youtube-nocookie.com" && event.origin !== "https://www.youtube.com") {
        this.logger.info("Ignoring message from non-YouTube origin:", event.origin);
        return;
      }

      let data;
      if (typeof event.data === "string") {
        try {
          data = JSON.parse(event.data);
          this.logger.info("Parsed JSON data:", data);
        } catch (e) {
          this.logger.info("Failed to parse event data as JSON, ignoring");
          return;
        }
      } else {
        data = event.data;
        this.logger.info("Event data is already an object:", data);
      }

      if (data.event === "infoDelivery" && data.info?.playerState !== undefined) {
        this.logger.info("YouTube player state change via infoDelivery:", data.info.playerState);
        this.handlePlayerStateChange(data.info.playerState);
      } else if (data.event === "onStateChange" && data.info !== undefined) {
        this.logger.info("YouTube player state change via onStateChange:", data.info);
        this.handlePlayerStateChange(data.info);
      } else {
        this.logger.info("Event does not match expected YouTube state change format");
      }
    };

    window.addEventListener("message", this.messageListener);
    this.logger.info("YouTube message listener registered");
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
      this.galleryDomId = `${this.galleryId}-${Date.now()}`;
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
        this.enableYouTubePlayerTracking();
      });
    } else {
      this.logger.info("initialiseMetadata:lazyLoadingMetadata not initialised yet:");
    }
  }

  private enableYouTubePlayerTracking() {
    setTimeout(() => {
      this.logger.info("Searching for YouTube iframes in document");
      const allIframes = document.querySelectorAll(`iframe[src*="youtube"]`);
      this.logger.info("Found", allIframes.length, "YouTube iframes total in document");

      allIframes.forEach((iframe: HTMLIFrameElement, index: number) => {
        this.logger.info(`Processing iframe ${index + 1}:`, iframe.src);
        this.logger.info(`  Parent element:`, iframe.parentElement?.tagName, iframe.parentElement?.className);
        if (iframe.contentWindow) {
          const message = JSON.stringify({ event: "listening" });
          this.logger.info(`Sending 'listening' event to iframe ${index + 1}:`, message);
          iframe.contentWindow.postMessage(message, "*");

          const infoMessage = JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] });
          this.logger.info(`Sending addEventListener command to iframe ${index + 1}:`, infoMessage);
          iframe.contentWindow.postMessage(infoMessage, "*");
        } else {
          this.logger.warn(`Iframe ${index + 1} has no contentWindow`);
        }
      });
    }, 2000);
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
    this.enableYouTubePlayerTracking();
  }

}
