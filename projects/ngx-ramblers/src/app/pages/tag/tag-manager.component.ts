import { Component, inject, Input, OnChanges, SimpleChanges } from "@angular/core";
import { faAdd, faRemove } from "@fortawesome/free-solid-svg-icons";
import { remove } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { ImageTag } from "../../models/content-metadata.model";
import { Tag } from "../../models/tag.model";
import { tagsSorted, nextTagKey } from "../../functions/tags";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-tag-manager",
    template: `
      @if (heading || description) {
        <div class="row thumbnail-heading-frame">
          @if (heading) {
            <div class="thumbnail-heading">{{ heading }}</div>
          }
          @if (description) {
            <div class="col-sm-12">
              <p class="mb-3" [innerHTML]="description"></p>
            </div>
          }
        </div>
      }
      @if (tags?.length) {
        <table class="styled-table table-responsive-sm">
          <thead>
            <tr>
              <th>Subject</th>
              @if (usageCount) {<th>Usages</th>}
              @if (imageMode) {<th>Exclude From Recent</th>}
              <th>Sort Index</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            @for (tag of tags; track tag.key) {
              <tr>
                <td><input [(ngModel)]="tag.subject" type="text" class="form-control" placeholder="Tag name"></td>
                @if (usageCount) {
                  <td>{{ usageCount(tag) }}</td>
                }
                @if (imageMode) {
                  <td>
                    <div class="form-check">
                      <input [ngModel]="asImageTag(tag).excludeFromRecent"
                             type="checkbox" class="form-check-input" id="exclude-{{tag.key}}">
                      <label class="form-check-label" (click)="toggleExcludeFromRecent(tag)" for="exclude-{{tag.key}}"></label>
                    </div>
                  </td>
                }
                <td><input [(ngModel)]="tag.sortIndex" type="number" class="form-control"></td>
                <td>
                  @if (canDelete(tag)) {
                    <div class="badge-button" (click)="removeTag(tag)"
                         delay="500" [tooltip]="'Remove ' + tag.subject + ' tag'">
                      <fa-icon [icon]="faRemove"/>
                      <span>remove</span>
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <p class="fst-italic mb-3">No tags defined yet.</p>
      }
      <div class="badge-button" (click)="addTag()">
        <fa-icon [icon]="faAdd"/>
        <span>add tag</span>
      </div>
    `,
    imports: [FormsModule, TooltipDirective, FontAwesomeModule]
})
export class TagManagerComponent implements OnChanges {

  private logger: Logger = inject(LoggerFactory).createLogger("TagManagerComponent", NgxLoggerLevel.ERROR);

  @Input() tags: Tag[];
  @Input() heading?: string;
  @Input() description?: string;
  @Input() imageMode = false;
  @Input() usageCount?: (tag: Tag) => number;

  faAdd = faAdd;
  faRemove = faRemove;

  ngOnChanges(changes: SimpleChanges) {
    if (changes.tags && this.tags) {
      this.tags = tagsSorted(this.tags);
      this.logger.info("ngOnChanges:tags:", this.tags);
    }
  }

  asImageTag(tag: Tag): ImageTag {
    return tag as ImageTag;
  }

  toggleExcludeFromRecent(tag: Tag) {
    const imageTag = tag as ImageTag;
    imageTag.excludeFromRecent = !imageTag.excludeFromRecent;
  }

  canDelete(tag: Tag): boolean {
    return !this.usageCount || this.usageCount(tag) === 0;
  }

  addTag() {
    const key = nextTagKey(this.tags);
    const newTag: Tag = this.imageMode ? {key, subject: ""} as ImageTag : {key, sortIndex: key * 10, subject: ""};
    this.tags.push(newTag);
    this.logger.info("addTag:", newTag);
  }

  removeTag(tag: Tag) {
    remove(this.tags, t => t.key === tag.key);
  }
}
