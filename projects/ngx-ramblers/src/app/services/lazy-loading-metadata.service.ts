import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { ContentMetadataService } from "./content-metadata.service";
import {
  ALL_PHOTOS,
  ContentMetadata,
  ContentMetadataItem,
  DuplicateImages,
  ImageFilterType,
  ImageTag,
  LazyLoadingMetadata,
  RECENT_PHOTOS,
  SlideInitialisation
} from "../models/content-metadata.model";
import range from "lodash-es/range";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})
export class LazyLoadingMetadataService {

  private logger: Logger = inject(LoggerFactory).createLogger("LazyLoadingMetadataService", NgxLoggerLevel.ERROR);
  private contentMetadataService = inject(ContentMetadataService);
  private stringUtils = inject(StringUtilsService);

  initialise(contentMetadata: ContentMetadata): LazyLoadingMetadata {
    const initialisedData = {
      contentMetadata,
      activeSlideIndex: 0,
      availableSlides: [],
      selectedSlides: []
    };
    this.logger.info("initialise for:", contentMetadata.name, "availableSlides:", initialisedData.availableSlides.length, "selectedSlides:", initialisedData.selectedSlides.length, "contentMetadata.files:", contentMetadata?.files?.length || 0);
    return initialisedData;
  }

  public initialiseAvailableSlides(lazyLoadingMetadata: LazyLoadingMetadata, reason: SlideInitialisation, duplicateImages: DuplicateImages, tag?: ImageTag, slideCount?: number): void {
    if (lazyLoadingMetadata) {
      this.logger.info(lazyLoadingMetadata?.contentMetadata.name, "initialiseAvailableSlides:tag:", tag, "reason:", reason);
      lazyLoadingMetadata.activeSlideIndex = 0;
      lazyLoadingMetadata.selectedSlides = [];
      const files: ContentMetadataItem[] = lazyLoadingMetadata?.contentMetadata?.files;
      const imageTags: ImageTag[] = lazyLoadingMetadata?.contentMetadata?.imageTags;
      if (tag === ALL_PHOTOS) {
        lazyLoadingMetadata.availableSlides = this.contentMetadataService.filterSlides(imageTags, files, duplicateImages, ImageFilterType.ALL);
        this.logger.info(lazyLoadingMetadata?.contentMetadata.name, "initialiseAvailableSlides:", ALL_PHOTOS, "selected:", this.stringUtils.pluraliseWithCount(lazyLoadingMetadata?.availableSlides.length, "image"));
      } else if (tag === RECENT_PHOTOS) {
        lazyLoadingMetadata.availableSlides = this.contentMetadataService.filterSlides(imageTags, files, duplicateImages, ImageFilterType.RECENT);
        this.logger.info(lazyLoadingMetadata?.contentMetadata.name, "initialiseAvailableSlides:", RECENT_PHOTOS, "selected:", this.stringUtils.pluraliseWithCount(lazyLoadingMetadata?.availableSlides.length, "image"));
      } else if (tag) {
        lazyLoadingMetadata.availableSlides = this.contentMetadataService.filterSlides(imageTags, files, duplicateImages, ImageFilterType.TAG, tag);
        this.logger.info(lazyLoadingMetadata?.contentMetadata.name, "initialiseAvailableSlides:", tag.subject, "selected:", this.stringUtils.pluraliseWithCount(lazyLoadingMetadata?.availableSlides.length, "image"));
      } else {
        lazyLoadingMetadata.availableSlides = this.contentMetadataService.filterSlides(imageTags, files, duplicateImages, ImageFilterType.RECENT);
        this.logger.info(lazyLoadingMetadata?.contentMetadata.name, "initialiseAvailableSlides:", reason, "selected:", this.stringUtils.pluraliseWithCount(lazyLoadingMetadata?.availableSlides.length, "image"));
      }
      this.add(lazyLoadingMetadata, slideCount, "add inside initialiseAvailableSlides");
    }
  }

  public add(lazyLoadingMetadata: LazyLoadingMetadata, slideCount?: number, reason?: string): ContentMetadataItem[] {
    const upperRange = slideCount || 1;
    return range(0, upperRange).map(slideNumber => {
      const slide = lazyLoadingMetadata?.availableSlides[lazyLoadingMetadata?.selectedSlides.length];
      if (slide) {
        lazyLoadingMetadata?.selectedSlides.push(slide);
        this.logger.info(reason || "direct add", "addNewSlide:added slide", slideNumber + 1, "of", upperRange, "to", this.stringUtils.pluraliseWithCount(lazyLoadingMetadata?.selectedSlides.length, "selected image"), "of", this.stringUtils.pluraliseWithCount(lazyLoadingMetadata?.availableSlides.length, "available image"), "activeSlideIndex:", lazyLoadingMetadata?.activeSlideIndex, "slide:", slide.text, slide.image);
        return slide;
      } else {
        this.logger.info(reason || "direct add", "addNewSlide:could not select slide", slideNumber + 1, "from", this.stringUtils.pluraliseWithCount(lazyLoadingMetadata?.selectedSlides.length, "selected image"), "of", this.stringUtils.pluraliseWithCount(lazyLoadingMetadata?.availableSlides.length, "available image"), "activeSlideIndex:", lazyLoadingMetadata?.activeSlideIndex);
      }
    }).filter(item => item);
  }

}
