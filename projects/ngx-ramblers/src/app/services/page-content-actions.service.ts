import { inject, Injectable } from "@angular/core";
import { first } from "es-toolkit/compat";
import { kebabCase } from "es-toolkit/compat";
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
  DEFAULT_GRID_OPTIONS, HasMaxColumns,
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
import { remove } from "es-toolkit/compat";
import { cloneDeep } from "es-toolkit/compat";
import { UrlService } from "./url.service";
import { ContentTextService } from "./content-text.service";

@Injectable({
  providedIn: "root"
})
export class PageContentActionsService {

  private logger: Logger = inject(LoggerFactory).createLogger("PageContentActionsService", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private broadcastService = inject<BroadcastService<PageContent>>(BroadcastService);
  private contentTextService = inject(ContentTextService);
  private urlService = inject(UrlService);
  private numberUtils = inject(NumberUtilsService);
  public rowsInEdit: number[] = [];
  public draggedRowIndex: number = null;
  public draggedColumnRowIndex: number = null;
  public draggedColumnIndex: number = null;
  public draggedColumnSourceRow: PageContentRow = null;
  public draggedNestedColumnIndex: number = null;
  public draggedNestedRowIndex: number = null;
  public draggedColumnIsNested: boolean = false;
  public dragStartX: number = null;
  public dragStartY: number = null;
  public dragHasMoved: boolean = false;
  public dragOverColumnRowIndex: number = null;
  public dragOverColumnIndex: number = null;
  public dragInsertAfter: boolean = false;

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

  saveContentTextId(contentText: ContentText, column: PageContentColumn) {
    this.logger.info("saveContentTextId:", contentText, "for column:", column, "existing contentTextId:", column.contentTextId, "new contentTextId:", contentText?.id);
    if (column.contentTextId !== contentText?.id) {
      column.contentTextId = contentText?.id;
    }
  }

  saveInlineContentText(contentText: ContentText, column: PageContentColumn) {
    this.logger.info("saveInlineContentText:", contentText, "for column:", column, "existing contentText:", column.contentText, "new text:", contentText?.text);
    if (column.contentText !== contentText?.text) {
      column.contentText = contentText?.text;
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

      // If the column has existing content, move it to the first nested row's first column
      const firstNestedRow = column.rows[0];
      const firstNestedColumn = firstNestedRow?.columns?.[0];

      if (firstNestedColumn) {
        // Transfer contentText (inline content)
        if (column.contentText) {
          firstNestedColumn.contentText = column.contentText;
          delete column.contentText;
        }

        // Transfer contentTextId (referenced content)
        if (column.contentTextId) {
          firstNestedColumn.contentTextId = column.contentTextId;
          delete column.contentTextId;
        }

        // Transfer image data if present
        if (column.imageSource) {
          firstNestedColumn.imageSource = column.imageSource;
          delete column.imageSource;
        }

        if (column.alt) {
          firstNestedColumn.alt = column.alt;
          delete column.alt;
        }

        if (column.imageBorderRadius !== undefined) {
          firstNestedColumn.imageBorderRadius = column.imageBorderRadius;
          delete column.imageBorderRadius;
        }

        if (column.imageAspectRatio) {
          firstNestedColumn.imageAspectRatio = column.imageAspectRatio;
          delete column.imageAspectRatio;
        }

        if (column.showTextAfterImage !== undefined) {
          firstNestedColumn.showTextAfterImage = column.showTextAfterImage;
          delete column.showTextAfterImage;
        }

        if (column.showPlaceholderImage !== undefined) {
          firstNestedColumn.showPlaceholderImage = column.showPlaceholderImage;
          delete column.showPlaceholderImage;
        }
      }
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

  async duplicateColumn(row: PageContentRow, columnIndex: number, pageContent: PageContent) {
    const columnData: PageContentColumn = await this.duplicateContentItemsInColumn(row, columnIndex);
    row.columns.splice(columnIndex, 0, columnData);
    this.logger.debug("pageContent:", pageContent);
    this.notifyPageContentChanges(pageContent);
  }

  async duplicateRow(row: PageContentRow, rowIndex: number, pageContent: PageContent) {
    const pageContentRow: PageContentRow = await this.duplicateContentItemsInRow(row);
    pageContent.rows.splice(rowIndex, 0, pageContentRow);
    this.logger.debug("pageContent:", pageContent);
    this.notifyPageContentChanges(pageContent);
  }

  private async duplicateContentItemsInColumn(row: PageContentRow, columnIndex: number): Promise<PageContentColumn> {
    const pageContentColumn = cloneDeep(row.columns[columnIndex]);
    this.logger.info("About to duplicate content items in:", row, "columnIndex:", columnIndex, "pageContentColumn:", pageContentColumn);
    if (pageContentColumn?.contentTextId) {
      const copiedContentText: ContentText = await this.contentTextService.copy(pageContentColumn?.contentTextId);
      this.logger.info("Duplicated content text item for:", pageContentColumn?.contentTextId, "is:", copiedContentText, "setting copied Id:", copiedContentText.id);
      pageContentColumn.contentTextId = copiedContentText.id;
    }
    return pageContentColumn;
  }

  private async duplicateContentItemsInRow(row: PageContentRow): Promise<PageContentRow> {
    const pageContentRow = cloneDeep(row);
    await this.copyContentTextItemsInRow(pageContentRow);
    this.logger.info("Duplicated content items in input row:", row, "output row:", pageContentRow);
    return pageContentRow;
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

  changeMaxColumnsFor(inputElement: HTMLInputElement, row: HasMaxColumns) {
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

  public isEvents(row: PageContentRow) {
    return row?.type === PageContentType.EVENTS;
  }

  public isCarousel(row: PageContentRow) {
    return row?.type === PageContentType.CAROUSEL;
  }

  public isAreaMap(row: PageContentRow) {
    return row?.type === PageContentType.AREA_MAP;
  }

  public isSharedFragment(row: PageContentRow) {
    return row?.type === PageContentType.SHARED_FRAGMENT;
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

  public reorderRows(pageContent: PageContent, fromIndex: number, toIndex: number) {
    move(pageContent.rows, fromIndex, toIndex);
    this.notifyPageContentChanges(pageContent);
  }

  public moveColumnBetweenRows(sourceRow: PageContentRow, sourceIndex: number, targetRow: PageContentRow, targetIndex: number, pageContent: PageContent) {
    if (!Array.isArray(sourceRow?.columns)) { return; }
    const [col] = sourceRow.columns.splice(sourceIndex, 1);
    if (!Array.isArray(targetRow.columns)) { targetRow.columns = []; }
    const safeIndex = Math.max(0, Math.min(targetIndex, targetRow.columns.length));
    targetRow.columns.splice(safeIndex, 0, col);
    const sourceIncrement = -1;
    const targetIncrement = 1;
    this.calculateColumnsFor(sourceRow, sourceIncrement);
    this.calculateColumnsFor(targetRow, targetIncrement);
    this.notifyPageContentChanges(pageContent);
  }

  public moveColumnToPreviousRow(pageContent: PageContent, currentRow: PageContentRow, columnIndex: number) {
    const rows = pageContent?.rows || [];
    const rowIndex = rows.indexOf(currentRow);
    if (rowIndex > 0) {
      this.calculateColumnsFor(rows[rowIndex - 1], 1);
      this.calculateColumnsFor(currentRow, -1);
      const [col] = currentRow.columns.splice(columnIndex, 1);
      rows[rowIndex - 1].columns.push(col);
      this.notifyPageContentChanges(pageContent);
    }
  }

  public moveColumnToNextRow(pageContent: PageContent, currentRow: PageContentRow, columnIndex: number) {
    const rows = pageContent?.rows || [];
    const rowIndex = rows.indexOf(currentRow);
    if (rowIndex >= 0 && rowIndex < rows.length - 1) {
      this.calculateColumnsFor(rows[rowIndex + 1], 1);
      this.calculateColumnsFor(currentRow, -1);
      const [col] = currentRow.columns.splice(columnIndex, 1);
      rows[rowIndex + 1].columns.unshift(col);
      this.notifyPageContentChanges(pageContent);
    }
  }

  public equaliseColumnWidths(row: PageContentRow, pageContent: PageContent) {
    const count = row?.columns?.length || 0;
    if (count <= 0) { return; }
    const base = Math.floor(12 / count);
    let remainder = 12 - (base * count);
    row.columns.forEach((column, index) => {
      const extra = remainder > 0 ? 1 : 0;
      column.columns = base + extra;
      if (remainder > 0) { remainder--; }
    });
    this.notifyPageContentChanges(pageContent);
  }

  public moveColumnToEmptyRow(sourceRow: PageContentRow, sourceIndex: number, targetRow: PageContentRow, pageContent: PageContent) {
    const [col] = sourceRow.columns.splice(sourceIndex, 1);
    this.calculateColumnsFor(sourceRow, -1);
    if (!targetRow.columns) { targetRow.columns = []; }
    col.columns = 12;
    targetRow.columns.splice(0, 0, col);
    this.notifyPageContentChanges(pageContent);
  }

  public moveColumnToFirstEmptyRow(pageContent: PageContent, currentRow: PageContentRow, columnIndex: number) {
    const rows = pageContent?.rows || [];
    let targetRow = rows.find(r => (r?.columns?.length || 0) === 0);
    if (!targetRow) {
      const insertAfter = rows.indexOf(currentRow);
      targetRow = { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [] } as PageContentRow;
      rows.splice(insertAfter >= 0 ? insertAfter + 1 : rows.length, 0, targetRow);
    }
    this.moveColumnToEmptyRow(currentRow, columnIndex, targetRow, pageContent);
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

  public async copyContentTextItemsInRow(row: PageContentRow): Promise<void> {
    for (const column of row.columns) {
      if (column.contentTextId) {
        const copiedContentText: ContentText = await this.contentTextService.copy(column.contentTextId);
        column.contentTextId = copiedContentText.id;
      }
      if (column.rows) {
        column.rows = await this.copyContentTextIdsInRows(column.rows);
      }
    }
  }

  public async copyContentTextIdsInRows(rows: PageContentRow[]): Promise<PageContentRow[]> {
    const clonedRows = cloneDeep(rows);
    for (const row of clonedRows) {
      await this.copyContentTextItemsInRow(row);
    }
    return clonedRows;
  }


}
