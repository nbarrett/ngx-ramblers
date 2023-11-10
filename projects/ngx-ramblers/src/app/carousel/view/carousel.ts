import { Component, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import {
  ContentMetadataItem,
  ImageTag,
  LazyLoadingMetadata,
  SlideInitialisation
} from "../../models/content-metadata.model";
import { groupEventTypeFor } from "../../models/committee.model";
import { PageService } from "../../services/page.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { SiteEditService } from "../../site-edit/site-edit.service";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { Subscription } from "rxjs";
import { RootFolder } from "../../models/system.model";
import { AlbumData } from "../../models/content-text.model";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";

@Component({
  selector: "app-carousel",
  templateUrl: "./carousel.html",
  styleUrls: ["./carousel.sass"]

})
export class CarouselComponent implements OnInit, OnDestroy, OnChanges {
  private logger: Logger;
  public lazyLoadingMetadata: LazyLoadingMetadata;
  public showIndicators: boolean;
  private subscriptions: Subscription[] = [];
  public faPencil = faPencil;
  public album: AlbumData;
  public activeTag: ImageTag;

  @Input("album") set acceptChangesFrom(carouselData: AlbumData) {
    this.carouselDataInput(carouselData);
  }

  @Input()
  public index: number;

  @Input()
  public hideStoryNavigator: boolean;

  @HostListener("window:resize", ["$event"])
  onResize(event) {
    this.configureShowIndicators(event?.target?.innerWidth);
  }

  constructor(
    public pageService: PageService,
    private memberLoginService: MemberLoginService,
    private lazyLoadingMetadataService: LazyLoadingMetadataService,
    private systemConfigService: SystemConfigService,
    public contentMetadataService: ContentMetadataService,
    private siteEditService: SiteEditService,
    public urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CarouselComponent", NgxLoggerLevel.INFO);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:querying metadata service with root folder", RootFolder.carousels, "album name:", this.album?.name);
    this.contentMetadataService.items(RootFolder.carousels, this.album?.name)
      .then(contentMetadata => {
        this.lazyLoadingMetadata = this.lazyLoadingMetadataService.initialise(contentMetadata);
        this.logger.info("initialised with", this?.lazyLoadingMetadata.contentMetadata?.files?.length, "slides in total", "lazyLoadingMetadata:", this.lazyLoadingMetadata, "activeTag:", this.activeTag);
        if (!this.activeTag) {
          this.lazyLoadingMetadataService.initialiseSlidesForTag(this.lazyLoadingMetadata, SlideInitialisation.COMPONENT_INIT);
        }
      });
  }

  ngOnChanges(changes: SimpleChanges) {
    this.logger.info("ngOnChanges:", changes);
  }

  private carouselDataInput(album: AlbumData) {
    this.logger.info("carouselDataInput:", album);
    this.album = album;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


  eventTooltip(slide: ContentMetadataItem) {
    return "Show details of this " + (groupEventTypeFor(slide.dateSource)?.description || slide.dateSource).toLowerCase();
  }

  activeSlideChange(force: boolean, $event: number) {
    this.logger.debug("activeSlideChange:force", force, "$event:", $event, "activeSlideIndex:", this.lazyLoadingMetadata?.activeSlideIndex || 0);
    this.lazyLoadingMetadataService.add(this.lazyLoadingMetadata);
    this.configureShowIndicators(window.innerWidth);
  }

  private configureShowIndicators(width: number) {
    this.logger.debug("configureShowIndicators:window.innerWidth", window.innerWidth, "provided width:", width, "setting:");
    this.showIndicators = width > 768 && this.lazyLoadingMetadata.availableSlides.length <= 20;
  }

  allowEdits() {
    return this.memberLoginService.allowContentEdits();
  }

  imageSourceFor(file: string): string {
    return this.urlService.imageSource(this.urlService.qualifiedFileNameWithRoot(this.lazyLoadingMetadata.contentMetadata?.rootFolder, this.lazyLoadingMetadata.contentMetadata?.name, file));
  }

  tagChanged(imageTag: ImageTag) {
    this.lazyLoadingMetadataService.initialiseSlidesForTag(this.lazyLoadingMetadata, SlideInitialisation.TAG_CHANGE, imageTag);
  }
}
