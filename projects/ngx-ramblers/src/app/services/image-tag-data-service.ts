import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { isUndefined, kebabCase, max } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { ALL_PHOTOS, ImageTag, RECENT_PHOTOS } from "../models/content-metadata.model";
import { sortBy } from "../functions/arrays";
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
    return [RECENT_PHOTOS].concat(this.imageTagsSorted(imageTags)).concat(ALL_PHOTOS);
  }

  addTag(imageTags: ImageTag[], subject: string): ImageTag {
    const existingMatchingTag: ImageTag = imageTags.find(item => item.subject?.toLowerCase() === subject?.toLowerCase());
    if (existingMatchingTag) {
      this.logger.info("tag already exists:", existingMatchingTag, "for:", subject);
      return existingMatchingTag;
    } else {
      const key = this.nextKey(imageTags);
      const imageTag: ImageTag = {key, subject};
      imageTags.push(imageTag);
      this.logger.info("given new subject:", subject, "imageTags now contain:", imageTags);
      return imageTag;
    }
  }

  private nextKey(imageTags: ImageTag[]): number {
    const maxKey = max(imageTags.map(item => item.key));
    return (isNaN(maxKey) ? 0 : maxKey) + 1;
  }

  asImageTags(imageTags: ImageTag[], keys: number[]): ImageTag[] {
    return this.imageTagsSorted(imageTags).filter(tag => keys.includes(tag.key));
  }

  findTag(imageTags: ImageTag[], value: ImageTag | number | string): ImageTag {
    if (!value) {
      this.logger.info("findTag:can't search for:", value);
    } else if (this.isImageTag(value)) {
      return this.findTag(imageTags, value.key);
    } else {
      return this.recentPhotosPlusImageTagsPlusAll(imageTags).find(item => item.key === +value || kebabCase(item.subject) === kebabCase(value.toString()));
    }
  }

  public imageTagsSorted(imageTags: ImageTag[]): ImageTag[] {
    this.logger.info("imageTagsSorted:imageTags:", imageTags);
    if (imageTags) {
      const sorted: ImageTag[] = imageTags.sort(sortBy("sortIndex", "subject"));
      this.logger.debug("imageTagsSorted:", sorted);
      return sorted;
    } else {
      return [];
    }
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
