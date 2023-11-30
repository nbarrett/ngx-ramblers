import { Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import each from "lodash-es/each";
import groupBy from "lodash-es/groupBy";
import isEqual from "lodash-es/isEqual";
import { NgxLoggerLevel } from "ngx-logger";
import { ContentMetadata, ContentMetadataItem, DuplicateImages } from "../models/content-metadata.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})
export class ImageDuplicatesService {
  private logger: Logger;

  constructor(private stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ImageDuplicatesService, NgxLoggerLevel.OFF);
  }

  duplicateCount(item: ContentMetadataItem, duplicateImages: DuplicateImages): string {
    const count = this.duplicatedContentMetadataItems(item, duplicateImages)?.length || 0;
    return count > 0 ? `${this.stringUtils.pluraliseWithCount(count, "duplicate")}` : "No duplicates";
  }

  public duplicatedContentMetadataItems(item: ContentMetadataItem, duplicateImages: DuplicateImages): ContentMetadataItem[] {
    const duplicates = duplicateImages[item.image || item.base64Content];
    const items = duplicates?.filter(file => isEqual(file, item)) || [];
    this.logger.info("duplicates for image:", item.image || item.originalFileName, "duplicates:", duplicates, "items:", items);
    return items;
  }

  duplicates(item: ContentMetadataItem, duplicateImages: DuplicateImages, filteredFiles: ContentMetadataItem[]): string {
    return (this.duplicatedContentMetadataItems(item, duplicateImages) || []).map(item => `${item.text || item.originalFileName} (image ${(this.imageNumber(item, filteredFiles))})`).join(", ");
  }

  private imageNumber(item: ContentMetadataItem, filteredFiles: ContentMetadataItem[]) {
    const indexOf = filteredFiles.indexOf(item);
    return (indexOf === -1 ? filteredFiles.indexOf(filteredFiles.find(file => isEqual(file, item))) : indexOf) + 1;
  }

  populateFrom(contentMetadata: ContentMetadata): DuplicateImages {
    if (contentMetadata?.files) {
      this.logger.info("populateFrom total number:", contentMetadata.files.length);
      const duplicateImages = groupBy(contentMetadata.files, item => item.image || item.base64Content);
      this.logger.info("duplicateImages pre-clean:", cloneDeep(duplicateImages));
      each(duplicateImages, (items, image) => {
        if (items.length === 1) {
          delete duplicateImages[image];
        }
      });
      this.logger.info("duplicateImages post-clean:", duplicateImages);
      return duplicateImages;
    } else {
      return {};
    }
  }
}
