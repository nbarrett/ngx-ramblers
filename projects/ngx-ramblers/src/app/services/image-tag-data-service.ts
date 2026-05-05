import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { isUndefined, kebabCase } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { ALL_PHOTOS, ImageTag, RECENT_PHOTOS } from "../models/content-metadata.model";
import { findTag, tagsSorted } from "../functions/tags";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { StoredValue } from "../models/ui-actions";
import { StringUtilsService } from "./string-utils.service";

@Injectable({
  providedIn: "root"
})
export class ImageTagDataService {
  private logger: Logger = inject(LoggerFactory).createLogger("ImageTagDataService", NgxLoggerLevel.ERROR);
  private router = inject(Router);
  private stringUtils = inject(StringUtilsService);

  recentPhotosPlusImageTagsPlusAll(imageTags: ImageTag[]): ImageTag[] {
    return [RECENT_PHOTOS].concat(tagsSorted(imageTags)).concat(ALL_PHOTOS);
  }

  asImageTags(imageTags: ImageTag[], keys: number[]): ImageTag[] {
    return tagsSorted(imageTags).filter(tag => keys.includes(tag.key));
  }

  findTag(imageTags: ImageTag[], value: ImageTag | number | string): ImageTag {
    if (!value) {
      this.logger.info("findTag:can't search for:", value);
      return undefined;
    }
    if (this.isImageTag(value)) {
      return findTag(this.recentPhotosPlusImageTagsPlusAll(imageTags), value.key);
    }
    return findTag(this.recentPhotosPlusImageTagsPlusAll(imageTags), value);
  }

  isActive(tag: ImageTag, activeTag: ImageTag): boolean {
    const active = (activeTag?.key === tag?.key) || (!activeTag && tag === RECENT_PHOTOS);
    this.logger.debug("activeTag:", activeTag, "supplied tag", tag, "-> active:", active);
    return active;
  }

  isImageTag(tagOrValue: ImageTag | number | string): tagOrValue is ImageTag {
    return !isUndefined((tagOrValue as ImageTag)?.key);
  }

  select(imageTags: ImageTag[], tagOrValue: ImageTag | number | string) {
    this.logger.debug("selecting tagOrValue", tagOrValue);
    if (this.isImageTag(tagOrValue)) {
      this.updateUrlWith(tagOrValue);
    } else {
      const tag = this.findTag(imageTags, tagOrValue);
      if (tag) {
        this.updateUrlWith(tag);
      }
    }
  }

  public updateUrlWith(tag: ImageTag, index?: number) {
    this.router.navigate([], {
      queryParams: {[this.storyParameterName(index)]: kebabCase(tag.subject)},
      queryParamsHandling: "merge"
    });
  }

  public storyParameterName(index: number): string {
    return this.stringUtils.kebabCase(StoredValue.STORY, index > 0 ? index : null);
  }
}
