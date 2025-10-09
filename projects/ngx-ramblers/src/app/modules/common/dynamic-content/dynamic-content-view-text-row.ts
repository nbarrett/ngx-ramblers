import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentColumn, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { CardImageComponent } from "../card/image/card-image";
import { FALLBACK_MEDIA } from "../../../models/walk.model";

@Component({
    selector: "app-dynamic-content-view-text-row",
    template: `
      @if (actions.isTextRow(row)) {
        <div [class]="actions.rowClasses(row)">
          @for (column of row?.columns; track column; let columnIndex = $index) {
            <div
              [class]="'col-sm-' + (column.columns||12)">
              @for (row of column.rows; track row; let innerRowIndex = $index) {
                @if (false) {
                  <div>Row {{ rowIndex + 1 }}: {{ 'nested row ' + (innerRowIndex + 1) + ' ' + row.type }}</div>
                }
                @if (actions.isTextRow(row)) {
                  <app-dynamic-content-view-text-row
                    [row]="row"
                    [rowIndex]="innerRowIndex"
                    [contentPath]="contentPath"
                    [contentDescription]="contentDescription">
                  </app-dynamic-content-view-text-row>
                }
              }
              @if (!column.rows) {
                @if (column?.contentText) {
                  @if (showImageBeforeText(column)) {
                    <app-card-image
                      [borderRadius]="column?.imageBorderRadius"
                      [aspectRatio]="column?.imageAspectRatio"
                      [alt]="column?.alt"
                      unconstrainedHeight
                      [imageSource]="imageSourceFor(column)">
                    </app-card-image>
                  }
                  <app-markdown-editor [text]="column.contentText"
                                       [name]="actions.rowColumnIdentifierFor(rowIndex, columnIndex, contentPath)"
                                       [category]="contentPath">
                  </app-markdown-editor>
                }
                @if (column?.contentTextId) {
                  <app-markdown-editor [id]="column?.contentTextId"
                                       queryOnlyById>
                  </app-markdown-editor>
                }
                @if (showImageAfterText(column)) {
                  <app-card-image
                    [borderRadius]="column?.imageBorderRadius"
                    [aspectRatio]="column?.imageAspectRatio"
                    [alt]="column?.alt"
                    unconstrainedHeight
                    [imageSource]="imageSourceFor(column)">
                  </app-card-image>
                }
              }
            </div>
          }
        </div>
      }`,
    styleUrls: ["./dynamic-content.sass"],
    imports: [MarkdownEditorComponent, CardImageComponent]
})
export class DynamicContentViewTextRowComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewTextRowComponent", NgxLoggerLevel.ERROR);
  siteEditService = inject(SiteEditService);
  actions = inject(PageContentActionsService);
  stringUtils = inject(StringUtilsService);

  @Input()
  public row: PageContentRow;
  @Input()
  public rowIndex: number;
  @Input()
  public contentPath: string;
  @Input()
  public contentDescription: string;
  @Input()
  public bordered: boolean;

  ngOnInit() {
    this.logger.info("ngOnInit called for", this.row, "containing", this.stringUtils.pluraliseWithCount(this.row?.columns.length, "column"));
  }

  shouldShowImage(column: PageContentColumn): boolean {
    const hasActualImage = !!column?.imageSource;
    const showPlaceholder = column?.showPlaceholderImage && !column?.imageSource;
    return hasActualImage || showPlaceholder;
  }

  imageSourceFor(column: PageContentColumn): string {
    if (column?.imageSource) {
      return column.imageSource;
    } else if (column?.showPlaceholderImage && !column?.imageSource) {
      return FALLBACK_MEDIA.url;
    } else {
      return column?.imageSource;
    }
  }

  showImageAfterText(column: PageContentColumn) {
    return !column.showTextAfterImage && this.shouldShowImage(column);
  }

  showImageBeforeText(column: PageContentColumn) {
    return column.showTextAfterImage && this.shouldShowImage(column);
  }
}
