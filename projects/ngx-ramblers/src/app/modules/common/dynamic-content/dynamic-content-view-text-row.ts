import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { CardImageComponent } from "../card/image/card-image";

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
                <div>Row {{ rowIndex + 1 }}: {{ 'nested row ' + (innerRowIndex + 1) + ' ' + row.type }}
                </div>
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
              <app-markdown-editor [id]="column?.contentTextId"
                queryOnlyById>
              </app-markdown-editor>
              @if (column?.imageSource) {
                <app-card-image
                  [borderRadius]="column?.imageBorderRadius"
                  unconstrainedHeight
                  [imageSource]="column?.imageSource">
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

  private logger: Logger;

  constructor(
    public siteEditService: SiteEditService,
    public actions: PageContentActionsService,
    public stringUtils: StringUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentViewTextRowComponent", NgxLoggerLevel.ERROR);
  }

  ngOnInit() {
    this.logger.info("ngOnInit called for", this.row, "containing", this.stringUtils.pluraliseWithCount(this.row?.columns.length, "column"));
  }

}
