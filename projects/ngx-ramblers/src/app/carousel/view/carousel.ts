import { Component, HostListener, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import {
  ALL_PHOTOS,
  ContentMetadataItem,
  DuplicateImages,
  ImageTag,
  LazyLoadingMetadata,
  SlideInitialisation
} from "../../models/content-metadata.model";
import { groupEventTypeFor } from "../../models/committee.model";
import { PageService } from "../../services/page.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { Subscription } from "rxjs";
import { AlbumData } from "../../models/content-text.model";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ImageDuplicatesService } from "../../services/image-duplicates-service";
import { RootFolder } from "../../models/system.model";

@Component({
  selector: "app-carousel",
  templateUrl: "./carousel.html",
  styleUrls: ["./carousel.sass"],
  standalone: false
})
export class CarouselComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public showIndicators: boolean;
  private subscriptions: Subscription[] = [];
  public faPencil = faPencil;
  public album: AlbumData;
  public preview: boolean;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  @Input("album") set acceptChangesFrom(albumData: AlbumData) {
    this.carouselDataInput(albumData);
  }

  @Input()
  public duplicateImages: DuplicateImages;

  @Input()
  public lazyLoadingMetadata: LazyLoadingMetadata;

  @Input()
  public index: number;

  @Input()
  public hideStoryNavigator: boolean;
  public noPause = true;

  @HostListener("window:resize", ["$event"])
  onResize(event) {
    this.configureShowIndicators(event?.target?.innerWidth);
  }

  constructor(
    public pageService: PageService,
    private memberLoginService: MemberLoginService,
    private lazyLoadingMetadataService: LazyLoadingMetadataService,
    private imageDuplicatesService: ImageDuplicatesService,
    public contentMetadataService: ContentMetadataService,
    public urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CarouselComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:querying metadata service with root folder", RootFolder.carousels, "album name:", this.album?.name, "lazyLoadingMetadata:", this.lazyLoadingMetadata);
    if (this.lazyLoadingMetadata) {
      this.logger.info("externally initialised with", this?.lazyLoadingMetadata?.contentMetadata?.files?.length, "slides in total", "lazyLoadingMetadata:", this.lazyLoadingMetadata, "duplicateImages:", this.duplicateImages);
    } else {
      this.contentMetadataService.items(RootFolder.carousels, this.album?.name)
        .then(contentMetadata => {
          this.duplicateImages = this.imageDuplicatesService.populateFrom(contentMetadata);
          this.lazyLoadingMetadata = this.lazyLoadingMetadataService.initialise(contentMetadata);
          this.lazyLoadingMetadataService.initialiseAvailableSlides(this.lazyLoadingMetadata, SlideInitialisation.COMPONENT_INIT, this.duplicateImages, ALL_PHOTOS);
          this.logger.info("internally initialised with", this?.lazyLoadingMetadata?.contentMetadata?.files?.length, "slides in total", "lazyLoadingMetadata:", this.lazyLoadingMetadata, "duplicateImages:", this.duplicateImages);
        });
    }
  }

  private carouselDataInput(album: AlbumData) {
    this.logger.info("carouselDataInput:", album);
    this.album = album;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


  eventTooltip(dateSource: string) {
    return "Show details of this " + (groupEventTypeFor(dateSource)?.description || dateSource).toLowerCase();
  }

  activeSlideChange(force: boolean, $event: number) {
    this.logger.debug("activeSlideChange:force", force, "$event:", $event, "activeSlideIndex:", this.lazyLoadingMetadata?.activeSlideIndex || 0);
    this.lazyLoadingMetadataService.add(this.lazyLoadingMetadata, 1, "active slide change");
    this.configureShowIndicators(window.innerWidth);
  }

  private configureShowIndicators(width: number) {
    this.logger.debug("configureShowIndicators:window.innerWidth", window.innerWidth, "provided width:", width, "setting:");
    this.showIndicators = width > 768 && this.lazyLoadingMetadata?.selectedSlides?.length <= 20;
  }

  allowEdits() {
    return this.memberLoginService.allowContentEdits();
  }

  imageSourceFor(item: ContentMetadataItem): string {
    return this.urlService.imageSource(this.urlService.qualifiedFileNameWithRoot(this.lazyLoadingMetadata?.contentMetadata?.rootFolder, this.lazyLoadingMetadata?.contentMetadata?.name, item));
  }

  tagChanged(imageTag: ImageTag) {
    this.lazyLoadingMetadataService.initialiseAvailableSlides(this.lazyLoadingMetadata, SlideInitialisation.TAG_CHANGE, this.duplicateImages, imageTag);
  }

  mouseEnter($event: MouseEvent) {
    this.noPause = false;
    this.logger.info("mouseEnter:", $event, "noPause:", this.noPause);
  }

  mouseLeave($event: MouseEvent) {
    this.noPause = true;
    this.logger.info("mouseLeave:", $event, "noPause:", this.noPause);
  }
}
