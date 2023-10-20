import { Component, ElementRef, Input, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { ContentMetadata, ContentMetadataItem } from "../../../models/content-metadata.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { RootFolder } from "../../../models/system.model";

@Component({
  selector: "app-social-carousel",
  styleUrls: ["./social-carousel.sass"],
  templateUrl: "./social-carousel.html",
})
export class SocialCarouselComponent implements OnInit {
  @Input()
  public notifyTarget: AlertTarget;
  public contentMetadataItem: ContentMetadataItem;
  public slides: ContentMetadataItem[] = [];
  public paperCutWidth: 150;
  public slideInterval = 5000;
  public activeSlideIndex = -1;
  public image: any;
  private contentMetadata: ContentMetadata;

  constructor(private contentMetadataService: ContentMetadataService,
              private urlService: UrlService,
              protected dateUtils: DateUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialCarouselComponent, NgxLoggerLevel.OFF);
  }

  private logger: Logger;
  @ViewChild("paperCutImage") paperCutImage: ElementRef<HTMLImageElement>;

  ngOnInit() {
    this.refreshImages();
    setInterval(() => {
      this.nextSlide();
    }, this.slideInterval);
  }

  private nextSlide() {
    if (this.slides?.length > 0) {
      if (this.activeSlideIndex < this.slides.length - 1) {
        this.activeSlideIndex = this.activeSlideIndex + 1;
      } else if (this.activeSlideIndex > this.slides.length) {
        this.activeSlideIndex = 0;
      }
    }
    this.slideChanged(this.activeSlideIndex);
  }

  imageSourceOrPreview(): string {
    this.logger.debug("activeSlideIndex:", this.activeSlideIndex, "contentMetadataItem:", this.contentMetadataItem);
    return this.contentMetadataItem?.image;
  }

  refreshImages() {
    this.logger.debug("slides:", this.slides);
    this.contentMetadataService.items(RootFolder.carousels, "images-social-events")
      .then((contentMetadata) => {
        this.slides = contentMetadata.files;
        this.contentMetadata = contentMetadata;
        this.logger.debug("found", contentMetadata?.files?.length || 0, "slides");
        this.nextSlide();
      });
  }

  slideChanged(slideIndex: number) {
    if (slideIndex >= 0) {
      this.logger.debug("changing to slide:", slideIndex);
      this.activeSlideIndex = slideIndex;
      this.contentMetadataItem = this.slides[this.activeSlideIndex];
    }
  }

  paperCutImageHeight() {
    const clientHeight = this.paperCutImage?.nativeElement?.clientHeight;
    this.logger.debug("papercutHeight:", clientHeight);
    return clientHeight;
  }

  imageSourceFor(file: string): string {
    return this.urlService.imageSource(this.contentMetadataService.qualifiedFileNameWithRoot(this.contentMetadata?.rootFolder, this.contentMetadata?.name, file));
  }

}
