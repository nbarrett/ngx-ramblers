import { Component, HostListener, OnDestroy, OnInit } from "@angular/core";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { groupEventTypeFor } from "../../models/committee.model";
import { ALL_PHOTOS, ContentMetadataItem, ImageFilterType, IMAGES_HOME, ImageTag, RECENT_PHOTOS } from "../../models/content-metadata.model";
import { ExternalSystems } from "../../models/system.model";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { ImageTagDataService } from "../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { PageService } from "../../services/page.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";
import { SiteEditService } from "../../site-edit/site-edit.service";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.sass"]
})
export class HomeComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public feeds: { facebook: {} };
  public viewableSlides: ContentMetadataItem[] = [];
  private allSlides: ContentMetadataItem[] = [];
  public selectedSlides: ContentMetadataItem[] = [];
  public slideInterval = 5000;
  activeSlideIndex = 0;
  public showIndicators: boolean;
  faPencil = faPencil;
  private subscriptions: Subscription[] = [];
  public externalSystems: ExternalSystems;

  @HostListener("window:resize", ["$event"])
  onResize(event) {
    this.configureBasedOnWidth(event?.target?.innerWidth);
  }

  constructor(
    public pageService: PageService,
    public imageTagDataService: ImageTagDataService,
    private memberLoginService: MemberLoginService,
    private systemConfigService: SystemConfigService,
    private contentMetadataService: ContentMetadataService,
    private siteEditService: SiteEditService,
    private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("HomeComponent", NgxLoggerLevel.OFF);
    this.feeds = {facebook: {}};
  }

  private configureBasedOnWidth(width: number) {
    this.logger.debug("configureBasedOnWidth:window.innerWidth", window.innerWidth, "provided width:", width, "setting:");
    this.showIndicators = width > 768 && this.viewableSlides.length <= 20;
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.pageService.setTitle("Home");
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.externalSystems = item.externalSystems));
    this.subscriptions.push(this.imageTagDataService.selectedTag().subscribe((tag: ImageTag) => {
      this.initialiseSlidesForTag(tag, "selectedTag().subscribe");
    }));
    this.contentMetadataService.items(IMAGES_HOME)
      .then(contentMetaData => {
        this.allSlides = contentMetaData.files;
        this.imageTagDataService.populateFrom(contentMetaData.imageTags);
        this.logger.info("initialised with", this.allSlides.length, "slides in total", "activeTag:", this.imageTagDataService.activeTag);
        if (!this.imageTagDataService.activeTag) {
          this.initialiseSlidesForTag(null, "no tag supplied");
        }
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private initialiseSlidesForTag(tag: ImageTag, reason: string) {
    this.logger.debug("initialiseSlidesForTag:", tag, "reason:", reason);
    this.viewableSlides = [];
    this.activeSlideIndex = 0;
    if (tag === ALL_PHOTOS) {
      this.logger.info("initialiseSlidesForTag:all photos tag selected");
      this.selectedSlides = this.contentMetadataService.filterSlides(this.allSlides, ImageFilterType.ALL);
    } else if (tag === RECENT_PHOTOS) {
      this.logger.info("initialiseSlidesForTag:recent photos tag selected");
      this.selectedSlides = this.contentMetadataService.filterSlides(this.allSlides, ImageFilterType.RECENT);
    } else if (tag) {
      this.logger.info("initialiseSlidesForTag:", tag, "selected");
      this.selectedSlides = this.contentMetadataService.filterSlides(this.allSlides, ImageFilterType.TAG, tag);
    } else {
      this.logger.info("initialiseSlidesForTag:no tag selected - selecting recent");
      this.selectedSlides = this.contentMetadataService.filterSlides(this.allSlides, ImageFilterType.RECENT);
    }
    this.addNewSlide();
  }

  slidesFunction() {
    this.logger.debug("slidesFunction - length:", this.viewableSlides.length);
    return this.viewableSlides;
  }

  allowEdits() {
    return this.memberLoginService.allowContentEdits();
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
}
