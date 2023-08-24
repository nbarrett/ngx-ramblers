import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../models/content-text.model";
import { Logger, LoggerFactory } from "./logger-factory.service";

@Injectable({
  providedIn: "root"
})

export class PageContentRowService {
  private logger: Logger;

  private internalSelectedRows: PageContentRow[] = [];

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PageContentRowService, NgxLoggerLevel.OFF);
  }

  selectRow(row: PageContentRow) {
    if (!this.isSelected(row)) {
      this.internalSelectedRows.push(row);
    }

  }

  isSelected(row: PageContentRow): boolean {
    return this.internalSelectedRows.includes(row);
  }

  unSelectRow(row: PageContentRow) {
    this.internalSelectedRows = this.internalSelectedRows.filter(item => item !== row);
  }

  toggleSelection(row: PageContentRow) {
    if (this.isSelected(row)) {
      this.unSelectRow(row);
    } else {
      this.selectRow(row);
    }
    this.logger.debug("selected rows:", this.internalSelectedRows);
  }

  rowsSelected(): boolean {
    return this.internalSelectedRows.length > 0;
  }

  selectedRowCount(): number {
    return this.internalSelectedRows.length;
  }

  selectedRows(): PageContentRow[] {
    return this.internalSelectedRows;
  }

  deselectAll() {
    this.internalSelectedRows = [];
  }
}
