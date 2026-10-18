import { inject, Injectable } from "@angular/core";
import { cloneDeep } from "es-toolkit/compat";
import { forEach as each } from "es-toolkit/compat";
import { groupBy } from "es-toolkit/compat";
import { isEqual } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { Base64File, ContentMetadata, ContentMetadataItem, DuplicateImages, UniqueImageFiles } from "../models/content-metadata.model";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})
export class ImageDuplicatesService {

  private logger: Logger = inject(LoggerFactory).createLogger("ImageDuplicatesService", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);

  async uniqueFilesFrom(files: Base64File[], existing: ContentMetadataItem[]): Promise<UniqueImageFiles> {
    const checksums = new Set(existing.map(item => item.sourceChecksum).filter(Boolean));
    const unique: Base64File[] = [];
    for (const file of files) {
      const content = file.base64Content.slice(file.base64Content.indexOf(",") + 1);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
      const sourceChecksum = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, "0")).join("");
      if (!checksums.has(sourceChecksum)) {
        checksums.add(sourceChecksum);
        unique.push({...file, sourceChecksum});
      }
    }
    return {files: unique, skippedDuplicates: files.length - unique.length};
  }

  duplicateCount(item: ContentMetadataItem, duplicateImages: DuplicateImages): string {
    const count = this.duplicatedContentMetadataItems(item, duplicateImages)?.length || 0;
    return count > 0 ? `${this.stringUtils.pluraliseWithCount(count, "duplicate")}` : "No duplicates";
  }

  public duplicatedContentMetadataItems(item: ContentMetadataItem, duplicateImages: DuplicateImages): ContentMetadataItem[] {
    const key = item.sourceChecksum || item.image || item.base64Content || item.youtubeId;
    const duplicates = duplicateImages[key];
    const items = duplicates?.filter(file => isEqual(file, item)) || [];
    this.logger.info("duplicates for item:", item.image || item.youtubeId || item.originalFileName, "key:", key, "duplicates:", duplicates, "items:", items);
    return items;
  }

  duplicates(item: ContentMetadataItem, duplicateImages: DuplicateImages, filteredFiles: ContentMetadataItem[]): string {
    return (this.duplicatedContentMetadataItems(item, duplicateImages) || []).map(item => `${item.text || item.originalFileName} (${item.image ? 'image' : item.youtubeId ? 'video' : 'item'} ${(this.imageNumber(item, filteredFiles))})`).join(", ");
  }

  private imageNumber(item: ContentMetadataItem, filteredFiles: ContentMetadataItem[]) {
    const indexOf = filteredFiles.indexOf(item);
    return (indexOf === -1 ? filteredFiles.indexOf(filteredFiles.find(file => isEqual(file, item))) : indexOf) + 1;
  }

  populateFrom(contentMetadata: ContentMetadata): DuplicateImages {
    if (contentMetadata?.files) {
      this.logger.info("populateFrom total number:", contentMetadata.files.length);
      const duplicateImages = groupBy(contentMetadata.files, item => item.sourceChecksum || item.image || item.base64Content || item.youtubeId);
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
