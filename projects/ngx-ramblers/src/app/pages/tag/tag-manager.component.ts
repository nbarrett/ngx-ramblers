import { Component, Input, OnInit } from "@angular/core";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import remove from "lodash-es/remove";
import { NgxLoggerLevel } from "ngx-logger";
import { TagData } from "ngx-tagify";
import { ContentMetadata, ImageTag } from "../../models/content-metadata.model";
import { sortBy } from "../../functions/arrays";
import { ImageTagDataService } from "../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";

@Component({
  selector: "app-tag-manager",
  template: `
    <table *ngIf="contentMetadata?.imageTags" class="styled-table table-responsive-sm table-pointer">
      <thead>
      <tr>
        <th>Subject</th>
        <th>Usages</th>
        <th>Exclude From Recent</th>
        <th>Sort Index</th>
        <th>Delete</th>
      </tr>
      </thead>
      <tbody>
      <tr *ngFor="let imageTag of contentMetadata.imageTags">
        <td><input [(ngModel)]="imageTag.subject"
                   type="text" class="form-control"></td>
        <td>{{filesTaggedWith(imageTag)}}</td>
        <td>
          <div class="custom-control custom-checkbox">
            <input [ngModel]="imageTag.excludeFromRecent"
                   type="checkbox" class="custom-control-input">
            <label class="custom-control-label" (click)="toggleExcludeFromRecent(imageTag)"></label></div>
        </td>
        <td><input [(ngModel)]="imageTag.sortIndex"
                   type="number" class="form-control"></td>
        <td>
          <div *ngIf="canDelete(imageTag)" class="badge-button" (click)="remove(imageTag)"
               delay=500 [tooltip]="'Remove ' + imageTag.subject + ' tag'">
            <fa-icon [icon]="faRemove"></fa-icon>
            <span>remove</span>
          </div>
        </td>
      </tr>
      </tbody>
    </table>
  `
})

export class TagManagerComponent implements OnInit {
  @Input("contentMetadata") set acceptChangesFrom(contentMetadata: ContentMetadata) {
    this.logger.debug("contentMetadata:", contentMetadata);
    this.contentMetadata = contentMetadata;
    this.contentMetadata.imageTags = this.contentMetadata.imageTags.sort(sortBy("sortIndex", "subject"));
  }

  public contentMetadata: ContentMetadata;
  private logger: Logger;
  public id: string;
  faRemove = faRemove;

  constructor(public stringUtils: StringUtilsService,
              private imageTagDataService: ImageTagDataService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(TagManagerComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.id = "image-tag-manager";
    this.logger.info("ngOnInit:contentMetadata:", this.contentMetadata);
  }

  onRemove(data: TagData[]) {
    const stories: ImageTag[] = this.imageTagDataService.asImageTags(this.contentMetadata.imageTags, data.map(item => item.key));
    this.logger.debug("onRemove tag data", data, "stories", stories, "contentMetadata:", this.contentMetadata);
  }

  remove(imageTag: ImageTag) {
    remove(this.contentMetadata.imageTags, imageTag);
  }

  canDelete(imageTag: ImageTag): boolean {
    return this.filesTaggedWith(imageTag) === 0;
  }

  private filesTaggedWith(imageTag: ImageTag) {
    return this.contentMetadata.files.filter(item => item.tags.includes(imageTag.key)).length;
  }

  toggleExcludeFromRecent(imageTag: ImageTag) {
    imageTag.excludeFromRecent = !imageTag.excludeFromRecent;
  }
}
