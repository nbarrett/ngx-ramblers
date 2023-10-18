import { Injectable } from "@angular/core";
import first from "lodash-es/first";
import kebabCase from "lodash-es/kebabCase";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import {
  CarouselData,
  ColumnInsertData,
  ContentText,
  HasPageContentRows,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType,
  View
} from "../models/content-text.model";
import { AccessLevel } from "../models/member-resource.model";
import { move } from "./arrays";
import { BroadcastService } from "./broadcast-service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NumberUtilsService } from "./number-utils.service";
import { StringUtilsService } from "./string-utils.service";
import { KeyValue } from "./enums";

@Injectable({
  providedIn: "root"
})
export class PageContentActionsService {
  private logger: Logger;

  constructor(private stringUtils: StringUtilsService,
              private broadcastService: BroadcastService<PageContent>,
              private numberUtils: NumberUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PageContentActionsService, NgxLoggerLevel.OFF);
  }

  public nestedRowsExistFor(column: PageContentColumn): boolean {
    return column?.rows?.length > 0;
  }

  public initialView(column: PageContentColumn): View {
    return column?.contentTextId ? View.VIEW : View.EDIT;
  }

  public view(): View {
    return View.VIEW;
  }

  public edit(): View {
    return View.EDIT;
  }

  allPageHrefs(pageContent: PageContent): any[] {
    return (pageContent.rows.map(row => row.columns.map(col => first(col?.href?.split("?"))).filter(item => item))).flat(2);
  }

  saveContentTextId(contentText: ContentText, rowIndex: number, column: PageContentColumn, pageContent: PageContent) {
    if (column.contentTextId !== contentText?.id) {
      column.contentTextId = contentText?.id;
    }
  }

  rowClasses(row: PageContentRow): string {
    const rowClasses = "row" + (row.marginTop ? (" mt-" + row.marginTop) : "") + (row.marginBottom ? (" mb-" + row.marginBottom) : "");
    this.logger.debug("rowClasses:", rowClasses, "for row:", row);
    return rowClasses;
  }

  defaultRowFor(type: PageContentType | string): PageContentRow {
    return {
      maxColumns: 1,
      showSwiper: false,
      type: type as PageContentType,
      columns: [this.columnFor(type)],
      carousel: this.defaultCarousel(null)
    };
  };

  public defaultCarousel(name: string): CarouselData {
    return {name, showStoryNavigator: true, showIndicators: true, slideInterval: 5000};
  }

  private columnFor(type: PageContentType | string): PageContentColumn {
    return type === PageContentType.TEXT ? {
      columns: 12,
      accessLevel: AccessLevel.public
    } : {accessLevel: AccessLevel.public};
  }

  addNestedRows(column: PageContentColumn) {
    if (!column.rows) {
      column.rows = [];
      this.addRow(0, PageContentType.TEXT, column.rows);
    }
  }

  removeNestedRows(column: PageContentColumn) {
    if (column.rows) {
      delete column.rows;
    }
  }

  addRow(rowIndex, pageContentType: PageContentType | string, rows: PageContentRow[]) {
    rows.splice(rowIndex, 0, this.defaultRowFor(pageContentType));
    this.logger.debug("rows:", rows);
  }

  deleteRow(pageContent: PageContent, rowIndex: number, rowIsNested: boolean, column: PageContentColumn) {
    this.rowContainer(pageContent, rowIsNested, column).rows = this.rowContainer(pageContent, rowIsNested, column).rows.filter((item, index) => index !== rowIndex);
    this.logger.debug("pageContent:", pageContent);
  }

  addColumn(row: PageContentRow, columnIndex: number, pageContent: PageContent) {
    const columnData: PageContentColumn = row.type === PageContentType.TEXT ?
      {columns: this.calculateColumnsFor(row, 1), accessLevel: AccessLevel.public} :
      {href: null, imageSource: null, title: null, accessLevel: AccessLevel.hidden};
    row.maxColumns = row.maxColumns + 1;
    row.columns.splice(columnIndex, 0, columnData);
    this.logger.debug("pageContent:", pageContent);
    this.notifyPageContentChanges(pageContent);
  }

  deleteColumn(row: PageContentRow, columnIndex: number, pageContent: PageContent) {
    this.calculateColumnsFor(row, -1);
    row.columns = row.columns.filter((item, index) => index !== columnIndex);
    this.logger.debug("pageContent:", pageContent);
    this.notifyPageContentChanges(pageContent);
  }

  private calculateColumnsFor(row: PageContentRow, columnIncrement: number) {
    const newColumnCount = row.columns.length + columnIncrement;
    const columns = this.numberUtils.asNumber(12 / newColumnCount, 0);
    row.columns.forEach(column => column.columns = columns);
    return columns;
  }

  changeColumnWidthFor(inputElement: HTMLInputElement, column: PageContentColumn) {
    column.columns = this.constrainInput(inputElement, 1, 12);
  }

  changeMaxColumnsFor(inputElement: HTMLInputElement, row: PageContentRow) {
    row.maxColumns = this.constrainInput(inputElement, 1, 4);
  }

  public constrainInput(inputElement: HTMLInputElement, minValue: number, maxValue: number) {
    const inputValue = +inputElement.value;
    const constrainedValue: number = inputValue > maxValue ? maxValue : inputValue < minValue ? minValue : +inputElement.value;
    inputElement.value = constrainedValue.toString();
    this.logger.debug("inputElement.value:", inputElement.value, "constrainedValue:", constrainedValue,);
    return constrainedValue;
  }

  rowColFor(rowIndex: number, columnIndex: number): string {
    return [this.rowPrefixFor(rowIndex), this.columnPrefixFor(columnIndex)].join("-");
  }

  parentRowColFor(parentRowIndex: number, rowIndex: number, columnIndex: number): string {
    if (isNaN(parentRowIndex)) {
      return [this.rowPrefixFor(rowIndex), this.columnPrefixFor(columnIndex)].join("-");
    } else {
      return [this.rowPrefixFor(parentRowIndex), this.nestedRowPrefixFor(rowIndex), this.nestedColumnPrefixFor(columnIndex)].join("-");
    }
  }

  private columnPrefixFor(columnIndex: number) {
    return columnIndex !== null ? `column-${columnIndex + 1}` : "";
  }

  private rowPrefixFor(rowIndex: number) {
    return rowIndex !== null ? `row-${rowIndex + 1}` : "";
  }

  private parentRowPrefixFor(parentRowIndex: number) {
    return parentRowIndex !== null ? `parent-row-${parentRowIndex + 1}` : "";
  }

  private nestedRowPrefixFor(rowIndex: number) {
    return rowIndex !== null ? `nested-row-${rowIndex + 1}` : "";
  }

  private nestedColumnPrefixFor(nestedColumnIndex: number) {
    return nestedColumnIndex !== null ? `nested-column-${nestedColumnIndex + 1}` : "";
  }

  parentRowColumnIdentifierFor(parentRowIndex: number, rowIndex: number, columnIndex: number, identifier: string): string {
    return kebabCase(`${identifier}-parent-${parentRowIndex}-${this.rowColFor(rowIndex, columnIndex)}`);
  }

  rowColumnIdentifierFor(rowIndex: number, columnIndex: number, identifier: string): string {
    return kebabCase(`${identifier}-${this.rowColFor(rowIndex, columnIndex)}`);
  }

  columnIdentifierFor(columnIndex: number, identifier: string): string {
    return kebabCase(`${identifier}-${this.rowColFor(null, columnIndex)}`);
  }

  rowIdentifierFor(rowIndex: number, identifier: string): string {
    return kebabCase(`${identifier}-${this.rowColFor(rowIndex, null)}`);
  }

  descriptionFor(rowIndex, columnIndex, identifier: string): string {
    return (this.stringUtils.replaceAll("-", " ", this.rowColumnIdentifierFor(rowIndex, columnIndex, identifier)) as string).trim();
  }

  descriptionForContent(relativePath: string): string | number {
    return this.stringUtils.replaceAll("-", " ", relativePath);
  }

  private notifyPageContentChanges(pageContent: PageContent) {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.PAGE_CONTENT_CHANGED, pageContent));
  }

  public isActionButtons(row: PageContentRow): boolean {
    return ["slides", PageContentType.ACTION_BUTTONS].includes(row?.type.toString());
  }

  public isTextRow(row: PageContentRow) {
    return row.type === PageContentType.TEXT;
  }

  public isCarousel(row: PageContentRow) {
    return row.type === PageContentType.CAROUSEL;
  }

  public pageContentFound(pageContent: PageContent, queryCompleted: boolean) {
    const hasRows = pageContent?.rows?.length > 0;
    this.logger.debug("pageContentFound:hasRows:", hasRows, "queryCompleted:", queryCompleted);
    return hasRows && queryCompleted;
  }

  public rowContainer(pageContent: PageContent, rowIsNested: boolean, column: PageContentColumn): HasPageContentRows {
    return rowIsNested && column?.rows ? column : pageContent;
  }

  public moveRowUp(pageContent: PageContent, rowIndex: number, rowIsNested: boolean, column: PageContentColumn) {
    move(this.rowContainer(pageContent, rowIsNested, column).rows, rowIndex, rowIndex - 1);
  }

  public moveRowDown(pageContent: PageContent, rowIndex: number, rowIsNested: boolean, column: PageContentColumn) {
    move(this.rowContainer(pageContent, rowIsNested, column).rows, rowIndex, rowIndex + 1);
  }

  public calculateInsertableContent(existingData: PageContent, defaultData: PageContent): ColumnInsertData[] {
    const responseHrefs = this.firstRowHrefs(existingData);
    this.logger.info("existingData hrefs:", responseHrefs);
    const defaultDataHrefs = this.firstRowHrefs(defaultData);
    this.logger.info("default data hrefs:", defaultDataHrefs);
    return defaultDataHrefs?.filter(item => !responseHrefs.includes(item))?.map(href => {
      const index = this.indexOfHref(defaultData, href);
      return {index, data: this.firstRowColumns(defaultData)[index]};
    });
  }

  public firstRowHrefs(pageContent: PageContent): string[] {
    return this.firstRowColumns(pageContent)?.map(column => column.href);
  }

  public firstRowColumns(pageContent: PageContent): PageContentColumn[] {
    return first(pageContent?.rows)?.columns;
  }

  public indexOfHref(pageContent: PageContent, href: string): number {
    return this.firstRowHrefs(pageContent).indexOf(href);
  }

  carouselIndex(row: PageContentRow, viewablePageContent: PageContent): number {
    const carouselNameIndexes: KeyValue<number>[] = viewablePageContent.rows
      .filter(item => this.isCarousel(item))
      .map((row, index) => ({key: row.carousel.name, value: index}));
    const numberKeyValue: KeyValue<number> = carouselNameIndexes.find(item => item.key === row.carousel.name);
    this.logger.info("carouselIndex:for:", row.carousel.name, "given:", carouselNameIndexes, "returned:", numberKeyValue?.value);
    return numberKeyValue?.value;
  }
}
