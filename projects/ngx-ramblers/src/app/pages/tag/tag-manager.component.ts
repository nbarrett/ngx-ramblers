import { Component, inject, Input, OnInit } from "@angular/core";
import { faRemove } from "@fortawesome/free-solid-svg-icons";
import remove from "lodash-es/remove";
import { NgxLoggerLevel } from "ngx-logger";
import { TagData } from "ngx-tagify";
import { ContentMetadata, ImageTag } from "../../models/content-metadata.model";
import { sortBy } from "../../functions/arrays";
import { ImageTagDataService } from "../../services/image-tag-data-service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-tag-manager",
    template: `
    @if (contentMetadata?.imageTags) {
      <table class="styled-table table-responsive-sm table-pointer">
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
          @for (imageTag of contentMetadata.imageTags; track imageTag.key) {
            <tr>
              <td><input [(ngModel)]="imageTag.subject"
              type="text" class="form-control"></td>
              <td>{{filesTaggedWith(imageTag)}}</td>
              <td>
                <div class="form-check">
                  <input [ngModel]="imageTag.excludeFromRecent"
                    type="checkbox" class="form-check-input" id="exclude-{{imageTag.key}}">
                  <label class="form-check-label" (click)="toggleExcludeFromRecent(imageTag)" for="exclude-{{imageTag.key}}"></label></div>
                </td>
                <td><input [(ngModel)]="imageTag.sortIndex"
                type="number" class="form-control"></td>
                <td>
                  @if (canDelete(imageTag)) {
                    <div class="badge-button" (click)="remove(imageTag)"
                      delay=500 [tooltip]="'Remove ' + imageTag.subject + ' tag'">
                      <fa-icon [icon]="faRemove"></fa-icon>
                      <span>remove</span>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    `,
    imports: [FormsModule, TooltipDirective, FontAwesomeModule]
})

export class TagManagerComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("TagManagerComponent", NgxLoggerLevel.ERROR);
  stringUtils = inject(StringUtilsService);
  private imageTagDataService = inject(ImageTagDataService);

  @Input("contentMetadata") set acceptChangesFrom(contentMetadata: ContentMetadata) {
    this.logger.debug("contentMetadata:", contentMetadata);
    this.contentMetadata = contentMetadata;
    this.contentMetadata.imageTags = this.contentMetadata.imageTags.sort(sortBy("sortIndex", "subject"));
  }

  public contentMetadata: ContentMetadata;
  public id: string;
  faRemove = faRemove;

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

  protected filesTaggedWith(imageTag: ImageTag) {
    return this.contentMetadata.files.filter(item => item.tags.includes(imageTag.key)).length;
  }

  toggleExcludeFromRecent(imageTag: ImageTag) {
    imageTag.excludeFromRecent = !imageTag.excludeFromRecent;
  }
}
