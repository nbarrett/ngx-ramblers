import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { ContentMetadataService } from "./content-metadata.service";
import {
  ALL_PHOTOS,
  ContentMetadata,
  ContentMetadataItem,
  ImageFilterType,
  ImageTag,
  LazyLoadingMetadata,
  RECENT_PHOTOS,
  SlideInitialisation
} from "../models/content-metadata.model";
import range from "lodash-es/range";

@Injectable({
  providedIn: "root"
})
export class LazyLoadingMetadataService {
  private logger: Logger;

  constructor(private contentMetadataService: ContentMetadataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("LazyLoadingMetadataService", NgxLoggerLevel.INFO);
  }

  initialise(contentMetadata: ContentMetadata, slideCount?: number): LazyLoadingMetadata {
    return {
      contentMetadata,
      activeSlideIndex: 0,
      availableSlides: contentMetadata.files,
      selectedSlides: slideCount > 0 ? contentMetadata.files.slice(0, slideCount) : []
    };
  }

  public initialiseSlidesForTag(lazyLoadingMetadata: LazyLoadingMetadata, reason: SlideInitialisation, tag?: ImageTag) {
    this.logger.info(lazyLoadingMetadata.contentMetadata.name, "initialiseSlidesForTag:", tag, "reason:", reason);
    lazyLoadingMetadata.availableSlides = [];
    lazyLoadingMetadata.activeSlideIndex = 0;
    const files: ContentMetadataItem[] = lazyLoadingMetadata.contentMetadata?.files;
    const imageTags: ImageTag[] = lazyLoadingMetadata.contentMetadata?.imageTags;
    if (tag === ALL_PHOTOS) {
      this.logger.info(lazyLoadingMetadata.contentMetadata.name, "initialiseSlidesForTag:all photos tag selected");
      lazyLoadingMetadata.selectedSlides = this.contentMetadataService.filterSlides(imageTags, files, ImageFilterType.ALL);
    } else if (tag === RECENT_PHOTOS) {
      this.logger.info(lazyLoadingMetadata.contentMetadata.name, "initialiseSlidesForTag:recent photos tag selected");
      lazyLoadingMetadata.selectedSlides = this.contentMetadataService.filterSlides(imageTags, files, ImageFilterType.RECENT);
    } else if (tag) {
      this.logger.info(lazyLoadingMetadata.contentMetadata.name, "initialiseSlidesForTag:", tag, "selected");
      lazyLoadingMetadata.selectedSlides = this.contentMetadataService.filterSlides(imageTags, files, ImageFilterType.TAG, tag);
    } else if (reason === SlideInitialisation.COMPONENT_INIT) {
      this.logger.info(lazyLoadingMetadata.contentMetadata.name, "initialiseSlidesForTag:no tag selected - selecting recent");
      lazyLoadingMetadata.selectedSlides = this.contentMetadataService.filterSlides(imageTags, files, ImageFilterType.RECENT);
    }
    this.add(lazyLoadingMetadata);
  }

  public add(lazyLoadingMetadata: LazyLoadingMetadata, slideCount?: number): void {
    range(0, slideCount || 1).forEach(slideNumber => {
      const slide = lazyLoadingMetadata.availableSlides[lazyLoadingMetadata.selectedSlides.length];
      if (slide) {
        this.logger.info("addNewSlide:adding slide", slideNumber, lazyLoadingMetadata.selectedSlides.length + 1, "of", lazyLoadingMetadata.selectedSlides.length, slide.text, slide.image);
        lazyLoadingMetadata.selectedSlides.push(slide);
      } else {
        this.logger.info("addNewSlide:no slides selected from", lazyLoadingMetadata.selectedSlides.length, "available");
      }
    });
  }

}
