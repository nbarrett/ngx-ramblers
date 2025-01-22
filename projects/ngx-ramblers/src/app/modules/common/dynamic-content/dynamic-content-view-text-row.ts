import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-dynamic-content-view-text-row",
  template: `
    <ng-container *ngIf="actions.isTextRow(row)">
      <div [class]="actions.rowClasses(row)">
        <div *ngFor="let column of row?.columns; let columnIndex = index;"
             [class]="'col-sm-' + (column.columns||12)">
          <ng-container *ngFor="let row of column.rows; let innerRowIndex = index;">
            <div *ngIf="false">Row {{ rowIndex + 1 }}: {{ 'nested row ' + (innerRowIndex + 1) + ' ' + row.type }}
            </div>
            <app-dynamic-content-view-text-row *ngIf="actions.isTextRow(row)"
                                               [row]="row"
                                               [rowIndex]="innerRowIndex"
                                               [contentPath]="contentPath"
                                               [contentDescription]="contentDescription">
            </app-dynamic-content-view-text-row>
          </ng-container>
          <ng-container *ngIf="!column.rows">
            <app-markdown-editor [id]="column?.contentTextId"
                                 queryOnlyById>
            </app-markdown-editor>
            <app-card-image *ngIf="column?.imageSource"
                            [borderRadius]="column?.imageBorderRadius"
                            unconstrainedHeight
                            [imageSource]="column?.imageSource">
            </app-card-image>
          </ng-container>
        </div>
      </div>
    </ng-container>`,
  styleUrls: ["./dynamic-content.sass"],
  standalone: false
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
