import { Injectable } from "@angular/core";
import first from "lodash-es/first";
import kebabCase from "lodash-es/kebabCase";
import { NgxLoggerLevel } from "ngx-logger";
import { NamedEvent, NamedEventType } from "../models/broadcast.model";
import {
  ActionType,
  AlbumData,
  AlbumIndex,
  AlbumView,
  ColumnInsertData,
  ContentText,
  DEFAULT_GALLERY_OPTIONS,
  DEFAULT_GRID_OPTIONS,
  HasPageContentRows,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType,
  View
} from "../models/content-text.model";
import { AccessLevel } from "../models/member-resource.model";
import { move } from "../functions/arrays";
import { BroadcastService } from "./broadcast-service";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NumberUtilsService } from "./number-utils.service";
import { StringUtilsService } from "./string-utils.service";
import { KeyValue } from "../functions/enums";
import remove from "lodash-es/remove";
import cloneDeep from "lodash-es/cloneDeep";
import { UrlService } from "./url.service";

@Injectable({
  providedIn: "root"
})
export class PageContentActionsService {
  private logger: Logger;
  public rowsInEdit: number[] = [];

  constructor(private stringUtils: StringUtilsService,
              private broadcastService: BroadcastService<PageContent>,
              private urlService: UrlService,
              private numberUtils: NumberUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PageContentActionsService, NgxLoggerLevel.ERROR);
  }

  public actionType(columnIndex: number, rowIndex: number, rowIsNested: boolean): string {
    const actionType = rowIsNested ? columnIndex >= 0 ?
        ActionType.NESTED_COLUMN :
        rowIndex >= 0 ? ActionType.NESTED_ROW :
          ActionType.UNKNOWN :
      columnIndex >= 0 ?
        ActionType.COLUMN : rowIndex >= 0 ?
          ActionType.ROW :
          ActionType.UNKNOWN;
    return `${this.stringUtils.asTitle(actionType)} ${(columnIndex >= 0 ? columnIndex : rowIndex) + 1}`;
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

  allPageHrefs(pageContent: PageContent): string[] {
    return (pageContent?.rows?.map(row => row.columns.map(col => this.urlService.pathOnlyFrom(col?.href))?.filter(item => item)))?.flat(2) || [];
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
      carousel: this.defaultAlbum(null)
    };
  };

  defaultAlbumIndex(): AlbumIndex {
    return {
      contentPaths: [],
    };
  };

  public defaultAlbum(name: string): AlbumData {
    return {
      name,
      createdAt: null,
      createdBy: null,
      eventDate: null,
      eventId: null,
      eventType: "walks",
      title: null,
      subtitle: null,
      showTitle: true,
      introductoryText: null,
      coverImageHeight: 400,
      coverImageBorderRadius: 6,
      showCoverImageAndText: true,
      showPreAlbumText: true,
      preAlbumText: null,
      albumView: AlbumView.GRID,
      gridViewOptions: DEFAULT_GRID_OPTIONS,
      galleryViewOptions: DEFAULT_GALLERY_OPTIONS,
      allowSwitchView: false,
      showStoryNavigator: true,
      showIndicators: true,
      slideInterval: 5000,
      height: null
    };
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
    const columnData: PageContentColumn = row?.type === PageContentType.TEXT ?
      {columns: this.calculateColumnsFor(row, 1), accessLevel: AccessLevel.public} :
      {href: null, imageSource: null, title: null, accessLevel: AccessLevel.hidden};
    row.columns.splice(columnIndex, 0, columnData);
    this.logger.debug("pageContent:", pageContent);
    this.notifyPageContentChanges(pageContent);
  }

  duplicateColumn(row: PageContentRow, columnIndex: number, pageContent: PageContent) {
    const columnData: PageContentColumn = cloneDeep(row.columns[columnIndex]);
    row.columns.splice(columnIndex, 0, columnData);
    this.logger.debug("pageContent:", pageContent);
    this.notifyPageContentChanges(pageContent);
  }

  deleteColumn(row: PageContentRow, columnIndex: number, pageContent: PageContent) {
    this.logger.info("about to deleteColumn from row:", row, "columnIndex:", columnIndex, "pageContent:", pageContent);
    this.calculateColumnsFor(row, -1);
    row.columns = row.columns.filter((item, index) => index !== columnIndex);
    this.logger.info("pageContent:", pageContent);
    this.notifyPageContentChanges(pageContent);
  }

  private calculateColumnsFor(row: PageContentRow, columnIncrement: number) {
    const newColumnCount = row?.columns?.length + columnIncrement;
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

  public notifyPageContentChanges(pageContent: PageContent) {
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.PAGE_CONTENT_CHANGED, pageContent));
  }

  public isActionButtons(row: PageContentRow): boolean {
    return ["slides", PageContentType.ACTION_BUTTONS].includes(row?.type.toString());
  }

  public isTextRow(row: PageContentRow) {
    return row?.type === PageContentType.TEXT;
  }

  public isAlbum(row: PageContentRow) {
    return row?.type === PageContentType.ALBUM;
  }

  isCarouselOrAlbum(row: PageContentRow) {
    return this.isAlbum(row) || this.isCarousel(row);
  }

  public isAlbumIndex(row: PageContentRow) {
    return row?.type === PageContentType.ALBUM_INDEX;
  }

  public isCarousel(row: PageContentRow) {
    return row?.type === PageContentType.CAROUSEL;
  }

  public pageContentFound(pageContent: PageContent, queryCompleted: boolean) {
    const hasRows = pageContent?.rows?.length > 0;
    this.logger.debug("pageContentFound:hasRows:", hasRows, "queryCompleted:", queryCompleted);
    return hasRows && queryCompleted;
  }

  public rowContainer(pageContent: PageContent, rowIsNested: boolean, column: PageContentColumn): HasPageContentRows {
    return rowIsNested && column?.rows ? column : pageContent;
  }

  public moveColumnLeft(columns: PageContentColumn[], fromIndex: number, pageContent: PageContent) {
    const toIndex = fromIndex - 1;
    this.logger.info("moving column left fromIndex:", fromIndex, "toIndex:", toIndex);
    move(columns, fromIndex, toIndex);
    this.notifyPageContentChanges(pageContent);
  }

  public moveColumnRight(columns: PageContentColumn[], fromIndex: number, pageContent: PageContent) {
    const toIndex = fromIndex + 1;
    this.logger.info("moving column left fromIndex:", fromIndex, "toIndex:", toIndex);
    move(columns, fromIndex, toIndex);
    this.notifyPageContentChanges(pageContent);
  }

  public moveRowUp(pageContent: PageContent, rowIndex: number, rowIsNested: boolean, column: PageContentColumn) {
    move(this.rowContainer(pageContent, rowIsNested, column).rows, rowIndex, rowIndex - 1);
  }

  public moveRowDown(pageContent: PageContent, rowIndex: number, rowIsNested: boolean, column: PageContentColumn) {
    move(this.rowContainer(pageContent, rowIsNested, column).rows, rowIndex, rowIndex + 1);
  }

  public calculateInsertableContent(existingData: PageContent, defaultData: PageContent): ColumnInsertData[] {
    const pageContentType: PageContentType = first(defaultData?.rows).type;
    this.logger.info("defaultData:", defaultData, "with pageContentType:", pageContentType, "existingData:", existingData);
    const defaultDataHrefs = this.firstRowOfTypeHrefs(defaultData, pageContentType);
    this.logger.info("default data hrefs:", defaultDataHrefs);
    const responseHrefs = this.firstRowOfTypeHrefs(existingData, pageContentType);
    this.logger.info("existingData hrefs:", responseHrefs);
    return defaultDataHrefs?.filter(item => !responseHrefs?.includes(item))?.map(href => {
      const index = this.indexOfHref(defaultData, href, pageContentType);
      return {type: pageContentType, index, data: this.findPageContentColumnsOfType(defaultData, pageContentType)[index]};
    });
  }

  public firstRowOfTypeHrefs(pageContent: PageContent, pageContentType: PageContentType): string[] {
    return this.findPageContentColumnsOfType(pageContent, pageContentType)?.map(column => column.href);
  }

  public findPageContentColumnsOfType(pageContent: PageContent, pageContentType: PageContentType): PageContentColumn[] {
    return pageContent?.rows.find(row => row.type === pageContentType)?.columns;
  }

  public indexOfHref(pageContent: PageContent, href: string, pageContentType: PageContentType): number {
    return this.firstRowOfTypeHrefs(pageContent, pageContentType).indexOf(href);
  }

  carouselOrAlbumIndex(row: PageContentRow, viewablePageContent: PageContent): number {
    this.logger.debug("carouselOrAlbumIndex:for:", row);
    const carouselNameIndexes: KeyValue<number>[] = viewablePageContent?.rows
      .filter(item => this.isCarouselOrAlbum(item))
      .map((row, index) => ({key: row?.carousel?.name, value: index}));
    const numberKeyValue: KeyValue<number> = carouselNameIndexes?.find(item => item.key === row.carousel?.name);
    this.logger.debug("carouselIndex:for:", row?.carousel?.name, "given:", carouselNameIndexes, "returned:", numberKeyValue?.value);
    return numberKeyValue?.value;
  }

  public editActive(rowIndex: number) {
    return this.rowsInEdit.includes(rowIndex);
  }

  toggleEditMode(rowIndex: number) {
    if (this.editActive(rowIndex)) {
      remove(this.rowsInEdit, (item) => item === rowIndex);
      this.logger.debug("removing", rowIndex, "from edit mode -> now:", this.rowsInEdit);
    } else {
      this.rowsInEdit.push(rowIndex);
      this.logger.debug("adding", rowIndex, "to edit mode -> now:", this.rowsInEdit);
    }
  }


}
