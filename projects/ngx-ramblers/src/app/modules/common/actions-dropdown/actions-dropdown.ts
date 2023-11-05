import { Component, Input, OnInit } from "@angular/core";
import { faTableCells } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
  selector: "app-actions-dropdown",
  templateUrl: "./actions-dropdown.html",
  styleUrls: ["./actions-dropdown.sass"],
})
export class ActionsDropdownComponent implements OnInit {
  @Input()
  public pageContent: PageContent;
  @Input()
  public row: PageContentRow;
  @Input()
  public column: PageContentColumn;
  @Input()
  public columnIndex: number;
  @Input()
  public rowIndex: number;
  @Input()
  public rowIsNested: boolean;

  private logger: Logger;
  faTableCells = faTableCells;

  constructor(
    public actions: PageContentActionsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ActionsDropdownComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("row:", this.row, "column:", this.column)
  }

  rows(): PageContentRow[] {
    return this.actions.rowContainer(this.pageContent, this.rowIsNested, this?.column)?.rows;
  }

  allowMoveRowUp() {
    return this.rows().length > 0 && this.rowIndex > 0;
  }

  allowMoveRowDown() {
    return this.rows().length > 0 && this.rowIndex < this.rows().length - 1;
  }

  allowDeleteRow() {
    return this.rows().length > 0 && this.rowIndex >= 0;
  }

  allowInsertNestedRows(): boolean {
    return this.actions.isTextRow(this.row) && !this.rowIsNested && !this.actions.nestedRowsExistFor(this?.column);
  }

  allowDeleteNestedRows(): boolean {
    return !this.rowIsNested && this.actions.nestedRowsExistFor(this?.column);
  }

  allowColumnActions() {
    return this.columnIndex >= 0;
  }

  allowTextRowActions() {
    return this.rowIndex >= 0;
  }

  allowActionButtonActions() {
    return this.rowIndex >= 0 && !this.rowIsNested;
  }

  allowColumnDelete() {
    return this.columnIndex >= 0;
  }
}
