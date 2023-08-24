import { Component, ElementRef, Input, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { ContentMetadataItem } from "../../../models/content-metadata.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";

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
  public imageWidth = "80%";

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
    if (this.slides.length > 0) {
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
    this.contentMetadataService.items("imagesSocialEvents")
      .then((contentMetaData) => {
        this.slides = contentMetaData.files;
        this.logger.debug("found", contentMetaData.files.length, "slides");
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
}
