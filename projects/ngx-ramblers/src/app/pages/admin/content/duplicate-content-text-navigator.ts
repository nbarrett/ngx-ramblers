import { Component, effect, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { MarkdownComponent } from "ngx-markdown";
import { DuplicateContentDetectionService } from "../../../services/duplicate-content-detection-service";
import { ContentTextService } from "../../../services/content-text.service";
import { ContentText, ContentTextUsage, DuplicateTextNavigation } from "../../../models/content-text.model";
import { PageComponent } from "../../../page/page.component";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faWarning } from "@fortawesome/free-solid-svg-icons/faWarning";
import { AlertComponent } from "ngx-bootstrap/alert";
import { ALERT_SUCCESS } from "../../../models/alert-target.model";

@Component({
  selector: "app-duplicate-content-text-navigator",
  template: `

    <app-page autoTitle>
      <app-markdown-editor category="admin" name="duplicate-content-text-navigator"/>
      @if (duplicates().length > 0) {
        <h2 class="mb-3">
          {{ stringUtilsService.pluraliseWithCount(duplicates().length, "duplicate") }} {{ stringUtilsService.pluralise(duplicates().length, "was", "were") }}
          found</h2>
        @for (duplicate of duplicates(); track duplicate.id) {
          <div class="card my-4">
            <div class="card-body">
              <h3 class="card-title">
                <fa-icon class="fa-icon-sunrise mr-1" [icon]="faWarning"/>
                Duplicate {{ duplicate.occurrence }} of {{ duplicates().length }}
              </h3>
              <div class="font-weight-bold mb-2">Content Preview</div>
              <div class="dotted-content {{duplicate?.contentText?.styles?.class}}" markdown ngPreserveWhitespaces
                   [data]="duplicate.contentText.text"></div>
              <div class="font-weight-bold mb-2">Above content was found
                in {{ stringUtilsService.pluraliseWithCount(duplicate.usages.length, "place") }}:
              </div>
              <ul>
                @for (usage of duplicate.usages; track usage.contentPath) {
                  <li>
                    Row {{ usage.row }}, Column {{ usage.column }} on page <a
                    [href]="usage.contentPath">{{ usage.contentPath }}</a>
                  </li>
                }
              </ul>
            </div>
          </div>
        }
      } @else {
        <alert type="success" class="flex-grow-1">
          <fa-icon [icon]="ALERT_SUCCESS.icon"/>
          <strong class="ml-2">No duplicate content found</strong>
          <div class="ml-2">Looks like your content text is all in order for the site!</div>
        </alert>
      }
    </app-page>
  `,
  imports: [
    MarkdownComponent,
    PageComponent,
    MarkdownEditorComponent,
    FontAwesomeModule,
    AlertComponent,
  ],
})
export class DuplicateContentTextNavigatorComponent {

  constructor() {
    effect(async () => {
      this.logger.info("initialising duplicate content detection service");
      await this.duplicateContentDetectionService.initialiseForAll();
      const duplicateMap: Map<string, ContentTextUsage[]> = this.duplicateContentDetectionService.duplicateUsages();
      this.logger.info("duplicateMap:", duplicateMap);
      const map = await Promise.all(Array.from(duplicateMap.entries()).map(async ([id, usages], index) => ({
        occurrence: index + 1,
        id,
        contentText: await this.queryContentPreview(id),
        usages
      })));
      this.logger.info("map:", map);
      this.duplicates.set(map);
    });
  };

  private logger: Logger = inject(LoggerFactory).createLogger("DuplicateContentListComponent", NgxLoggerLevel.ERROR);
  private duplicateContentDetectionService = inject(DuplicateContentDetectionService);
  private contentTextService = inject(ContentTextService);
  protected stringUtilsService = inject(StringUtilsService);
  private router = inject(Router);
  duplicates = signal<DuplicateTextNavigation[]>([]);
  protected readonly faWarning = faWarning;

  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;

  private async queryContentPreview(contentTextId: string): Promise<ContentText> {
    return await this.contentTextService.getById(contentTextId);
  }
}
