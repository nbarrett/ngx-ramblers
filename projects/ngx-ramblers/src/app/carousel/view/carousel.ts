import { Component, HostListener, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import {
  ALL_PHOTOS,
  ContentMetadata,
  ContentMetadataItem,
  ImageFilterType,
  ImageTag,
  RECENT_PHOTOS,
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
import { CarouselData } from "../../models/content-text.model";

@Component({
  selector: "app-carousel",
  templateUrl: "./carousel.html",
  styleUrls: ["./carousel.sass"]

})
export class CarouselComponent implements OnInit, OnDestroy {
  public showEdit = false;
  private logger: Logger;
  public viewableSlides: ContentMetadataItem[] = [];
  public activeSlideIndex = 0;
  public showIndicators: boolean;
  public slideInterval = 5000;
  public contentMetadata: ContentMetadata;
  public selectedSlides: ContentMetadataItem[] = [];
  private subscriptions: Subscription[] = [];
  public faPencil = faPencil;
  public carouselData: CarouselData;
  public activeTag: ImageTag;


  @Input("carouselData") set acceptChangesFrom(carouselData: CarouselData) {
    this.carouselDataInput(carouselData);
  }

  @Input()
  public index: number;

  @HostListener("window:resize", ["$event"])
  onResize(event) {
    this.configureBasedOnWidth(event?.target?.innerWidth);
  }

  constructor(
    public pageService: PageService,
    private memberLoginService: MemberLoginService,
    private systemConfigService: SystemConfigService,
    public contentMetadataService: ContentMetadataService,
    private siteEditService: SiteEditService,
    private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CarouselComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.logger.debug("subscribing to systemConfigService events");
    this.contentMetadataService.items(RootFolder.carousels, this.carouselData?.name)
      .then(contentMetadata => {
        this.contentMetadata = contentMetadata;
        this.logger.debug("initialised with", this?.contentMetadata?.files?.length, "slides in total", "activeTag:", this.activeTag);
        if (!this.activeTag) {
          this.initialiseSlidesForTag(SlideInitialisation.COMPONENT_INIT);
        }
      });
  }

  private carouselDataInput(carouselData: CarouselData) {
    this.logger.debug("carouselDataInput:", carouselData);
    this.carouselData = carouselData;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public initialiseSlidesForTag(reason: SlideInitialisation, tag?: ImageTag) {
    this.logger.info(this.contentMetadata.name, "initialiseSlidesForTag:", tag, "reason:", reason);
    this.viewableSlides = [];
    this.activeSlideIndex = 0;
    const files: ContentMetadataItem[] = this?.contentMetadata?.files;
    const imageTags: ImageTag[] = this?.contentMetadata?.imageTags;
    if (tag === ALL_PHOTOS) {
      this.logger.info(this.contentMetadata.name, "initialiseSlidesForTag:all photos tag selected");
      this.selectedSlides = this.contentMetadataService.filterSlides(imageTags, files, ImageFilterType.ALL);
    } else if (tag === RECENT_PHOTOS) {
      this.logger.info(this.contentMetadata.name, "initialiseSlidesForTag:recent photos tag selected");
      this.selectedSlides = this.contentMetadataService.filterSlides(imageTags, files, ImageFilterType.RECENT);
    } else if (tag) {
      this.logger.info(this.contentMetadata.name, "initialiseSlidesForTag:", tag, "selected");
      this.selectedSlides = this.contentMetadataService.filterSlides(imageTags, files, ImageFilterType.TAG, tag);
    } else if (reason === SlideInitialisation.COMPONENT_INIT) {
      this.logger.info(this.contentMetadata.name, "initialiseSlidesForTag:no tag selected - selecting recent");
      this.selectedSlides = this.contentMetadataService.filterSlides(imageTags, files, ImageFilterType.RECENT);
    }
    this.addNewSlide();
  }

  eventUrl(slide: ContentMetadataItem) {
    return this.urlService.linkUrl({
      area: slide.dateSource,
      id: slide.eventId
    });
  }

  eventTooltip(slide: ContentMetadataItem) {
    return "Show details of this " + (groupEventTypeFor(slide.dateSource)?.description || slide.dateSource).toLowerCase();
  }

  activeSlideChange(force: boolean, $event: number) {
    this.logger.debug("activeSlideChange:force", force, "$event:", $event, "activeSlideIndex:", this.activeSlideIndex);
    this.addNewSlide();
  }

  private configureBasedOnWidth(width: number) {
    this.logger.debug("configureBasedOnWidth:window.innerWidth", window.innerWidth, "provided width:", width, "setting:");
    this.showIndicators = width > 768 && this.viewableSlides.length <= 20;
  }

  private addNewSlide() {
    const slide = this.selectedSlides[this.viewableSlides.length];
    if (slide) {
      this.logger.debug("addNewSlide:adding slide", this.viewableSlides.length + 1, "of", this.selectedSlides.length, slide.text, slide.image);
      this.viewableSlides.push(slide);
      this.configureBasedOnWidth(window.innerWidth);
    } else {
      this.logger.debug("addNewSlide:no slides selected from", this.selectedSlides.length, "available");
    }
  }

  allowEdits() {
    return this.memberLoginService.allowContentEdits();
  }

  imageSourceFor(file: string): string {
    return this.urlService.imageSource(this.contentMetadataService.qualifiedFileNameWithRoot(this.contentMetadata?.rootFolder, this.contentMetadata?.name, file));
  }

  tagChanged(imageTag: ImageTag) {
    this.initialiseSlidesForTag(SlideInitialisation.TAG_CHANGE, imageTag);
  }
}
