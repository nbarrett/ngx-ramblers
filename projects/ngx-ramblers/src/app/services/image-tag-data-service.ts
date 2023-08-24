import { Injectable } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import max from "lodash-es/max";
import { NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, Observable } from "rxjs";
import { ALL_PHOTOS, ImageTag, RECENT_PHOTOS } from "../models/content-metadata.model";
import { sortBy } from "./arrays";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})
export class ImageTagDataService {
  private logger: Logger;
  private tagSubjects = new BehaviorSubject<ImageTag[]>([]);
  private imageTagData: ImageTag[] = [];
  private selectedSubject = new BehaviorSubject<ImageTag>(null);
  public activeTag: ImageTag;
  private story: string;

  constructor(private router: Router,
              private activatedRoute: ActivatedRoute,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ImageTagDataService, NgxLoggerLevel.OFF);
    this.activatedRoute.queryParams.subscribe(params => {
      this.story = params["story"];
      this.syncTagWithStory();
    });
  }

  private syncTagWithStory() {
    const tag = this.findTag(this.story);
    this.logger.debug("received story parameter:", this.story, "setting activeTag to:", tag);
    this.activeTag = tag;
    if (tag) {
      this.publishTag(tag);
    }
  }

  populateFrom(imageTagData: ImageTag[]) {
    this.logger.debug("populateFrom", imageTagData);
    this.imageTagData = imageTagData;
    this.syncTagWithStory();
    this.publishChanges();
  }

  imageTags(): Observable<ImageTag[]> {
    return this.tagSubjects.asObservable();
  }

  imageTagsPlusRecentAndAll(): ImageTag[] {
    return [RECENT_PHOTOS].concat(this.imageTagsSorted()).concat(ALL_PHOTOS);
  }

  private publishChanges() {
    this.logger.info("publishChanges:", this.imageTagData);
    this.tagSubjects.next(this.imageTagData);
  }

  addTag(subject: string): ImageTag {
    const key = this.nextKey();
    const imageTag: ImageTag = {key, subject};
    this.imageTagData.push(imageTag);
    this.publishChanges();
    return imageTag;
  }

  private nextKey(): number {
    const maxKey = max(this.imageTagData.map(item => item.key));
    return (isNaN(maxKey) ? 0 : maxKey) + 1;
  }

  asImageTags(keys: number[]): ImageTag[] {
    return this.imageTagsSorted().filter(tag => keys.includes(tag.key));
  }

  findTag(value: ImageTag | number | string): ImageTag {
    if (typeof value === "object") {
      return this.findTag(value.key);
    } else {
      return this.imageTagsPlusRecentAndAll().find(item => item.key === +value || item.subject.toLowerCase() === value?.toString()?.toLowerCase());
    }
  }

  public imageTagsSorted(): ImageTag[] {
    const sorted = this.imageTagData.sort(sortBy("sortIndex", "subject"));
    this.logger.debug("imageTagsSorted:", sorted);
    return sorted;
  }

  isActive(tag: ImageTag): boolean {
    const active = (this.activeTag?.key === tag?.key) || (!this.activeTag && tag === RECENT_PHOTOS);
    this.logger.debug("activeTag:", this.activeTag, "supplied tag", tag, "-> active:", active);
    return active;
  }

  isImageTag(tagOrValue: ImageTag | number | string): tagOrValue is ImageTag {
    return (tagOrValue as ImageTag).key !== undefined;
  }

  select(tagOrValue: ImageTag | number | string) {
    this.logger.debug("selecting tagOrValue", tagOrValue);
    if (this.isImageTag(tagOrValue)) {
      this.publishTag(tagOrValue);
    } else {
      const tag = this.findTag(tagOrValue);
      if (tag) {
        this.publishTag(tag);
      }
    }
  }

  private publishTag(tag: ImageTag) {
    this.selectedSubject.next(tag);
    this.router.navigate([], {
      queryParams: {story: tag.subject.toLowerCase()}, queryParamsHandling: "merge"
    });
  }

  selectedTag(): Observable<ImageTag> {
    return this.selectedSubject.asObservable();
  }

}
