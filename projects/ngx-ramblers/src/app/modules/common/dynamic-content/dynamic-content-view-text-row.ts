import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberResourcesReferenceDataService } from "../../../services/member/member-resources-reference-data.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";

@Component({
  selector: "app-dynamic-content-view-text-row",
  template: `
      <ng-container *ngIf="actions.isTextRow(row)">
          <div [class]="actions.rowClasses(row)">
              <div *ngFor="let column of row?.columns; let columnIndex = index;"
                   [class]="'col-sm-' + (column.columns||12)">
                  <ng-container *ngFor="let row of column.rows; let rowIndex = index;">
                      <app-dynamic-content-view-text-row *ngIf="actions.isTextRow(row)"
                                                         [row]="row"
                                                         [rowIndex]="rowIndex"
                                                         [contentPath]="contentPath"
                                                         [contentDescription]="contentDescription">
                      </app-dynamic-content-view-text-row>
                  </ng-container>
                  <ng-container *ngIf="!column.rows">
                      <app-markdown-editor [id]="column?.contentTextId"
                                           [queryOnlyById]="true">
                      </app-markdown-editor>
                      <app-card-image *ngIf="column?.imageSource"
                                      [borderRadius]="column?.imageBorderRadius"
                                      [unconstrainedHeight]="true"
                                      [imageSource]="column?.imageSource">
                      </app-card-image>
                  </ng-container>
              </div>
          </div>
      </ng-container>`,
  styleUrls: ["./dynamic-content.sass"],
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
    private memberResourcesReferenceData: MemberResourcesReferenceDataService,
    private urlService: UrlService,
    public actions: PageContentActionsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DynamicContentViewTextRowComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
  }

}
