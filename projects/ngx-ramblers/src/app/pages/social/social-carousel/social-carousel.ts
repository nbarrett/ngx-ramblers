import { Component, ElementRef, inject, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { ContentMetadata, ContentMetadataItem } from "../../../models/content-metadata.model";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { BuiltInAlbumName, RootFolder } from "../../../models/system.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { NgStyle } from "@angular/common";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";

@Component({
    selector: "app-social-carousel",
    styleUrls: ["./social-carousel.sass"],
    templateUrl: "./social-carousel.html",
    imports: [NgStyle, MarkdownEditorComponent]
})
export class SocialCarouselComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("SocialCarouselComponent", NgxLoggerLevel.ERROR);
  private contentMetadataService = inject(ContentMetadataService);
  private notifierService = inject(NotifierService);
  urlService = inject(UrlService);
  protected dateUtils = inject(DateUtilsService);
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public contentMetadataItem: ContentMetadataItem;
  public slides: ContentMetadataItem[] = [];
  public paperCutWidth: 150;
  public slideInterval = 5000;
  public activeSlideIndex = -1;
  public image: any;
  public contentMetadata: ContentMetadata;
  @ViewChild("paperCutImage") paperCutImage: ElementRef<HTMLImageElement>;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
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

 refreshImages() {
    this.logger.debug("slides:", this.slides);
    this.contentMetadataService.items(RootFolder.carousels, BuiltInAlbumName.socialEventsImages)
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

}
