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
  private duplicateImages: DuplicateImages = {};
  private contentMetadata: ContentMetadata;
  private filteredFiles: ContentMetadataItem[];

  constructor(private stringUtils: StringUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ImageDuplicatesService, NgxLoggerLevel.OFF);
  }

  duplicateCount(item: ContentMetadataItem): string {
    const count = this.duplicatedContentMetadataItems(item)?.length || 0;
    return count > 0 ? `${this.stringUtils.pluraliseWithCount(count, "duplicate")}:` : "No duplicates";
  }

  public duplicatedContentMetadataItems(item: ContentMetadataItem): ContentMetadataItem[] {
    const duplicates = this.duplicateImages[item.image];
    const items = duplicates?.filter(file => isEqual(file, item)) || [];
    this.logger.debug("duplicates for image:", item.image, "duplicates:", duplicates, "items:", items);
    return items;
  }

  duplicates(item: ContentMetadataItem): string {
    return (this.duplicatedContentMetadataItems(item) || []).map(item => `${item.text} (image ${(this.imageNumber(item))})`).join(", ");
  }

  private imageNumber(item: ContentMetadataItem) {
    const indexOf = this.filteredFiles.indexOf(item);
    return (indexOf === -1 ? this.filteredFiles.indexOf(this.filteredFiles.find(file => isEqual(file, item))) : indexOf) + 1;
  }

  populateFrom(contentMetadata: ContentMetadata, filteredFiles: ContentMetadataItem[]) {
    if (contentMetadata && filteredFiles) {
      this.contentMetadata = contentMetadata;
      this.filteredFiles = filteredFiles;
      this.logger.debug("populateFrom total number:", contentMetadata.files.length, "filtered number:", filteredFiles.length);
      this.duplicateImages = groupBy(this.contentMetadata.files, "image");
      this.logger.debug("duplicateImages pre-clean:", cloneDeep(this.duplicateImages));
      each(this.duplicateImages, (items, image) => {
        if (items.length === 1) {
          delete this.duplicateImages[image];
        }
      });
      this.logger.debug("duplicateImages post-clean:", this.duplicateImages);
    }
  }
}
