import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ImageTagDataService } from "../../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { ContentMetadataItem, ImageTag } from "../../../models/content-metadata.model";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-carousel-story-navigator",
    templateUrl: "./carousel-story-navigator.component.html",
    styleUrls: ["./carousel-story-navigator.component.sass"],
    imports: [TooltipDirective, NgClass]
})
export class CarouselStoryNavigatorComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("CarouselStoryNavigatorComponent", NgxLoggerLevel.ERROR);
  imageTagDataService = inject(ImageTagDataService);
  private activatedRoute = inject(ActivatedRoute);

  @Input("imageTags") set acceptImageTagChangesFrom(imageTags: ImageTag[]) {
    this.logger.info("imageTags change:", imageTags);
    this.imageTags = imageTags;
    this.selectActiveTag();
  }

  @Input()
  public index: number;

  @Output() imagedSavedOrReverted: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageChange: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() moveUp: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() moveDown: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() delete: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageInsert: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() imageEdit: EventEmitter<ContentMetadataItem> = new EventEmitter();
  @Output() tagChanged: EventEmitter<ImageTag> = new EventEmitter();
  private story: string;
  public imageTags: ImageTag[];
  private subscriptions: Subscription[] = [];
  public activeTag: ImageTag;

  ngOnInit() {
    this.logger.info("imageTags:", this.imageTags);
    this.subscriptions.push(this.activatedRoute.queryParams.subscribe(params => {
      const parameterName = this.imageTagDataService.storyParameterName(this.index);
      this.story = params[parameterName];
      this.logger.info("received story value of:", this.story, "from parameter:", parameterName, "activeTag:", this.activeTag);
      this.selectActiveTag();
    }));
  }

  private selectActiveTag() {
    const imageTag = this.imageTagDataService.findTag(this.imageTags, this.story);
    this.logger.info("activatedRoute.queryParams:", this.story, "imageTags", this.imageTags, "->", imageTag);
    this.selectTag(imageTag);
  }

  selectTag(tag: ImageTag) {
    if (tag) {
      this.imageTagDataService.updateUrlWith(tag, this.index);
      this.activeTag = tag;
      this.tagChanged.emit(tag);
    }
  }
}
