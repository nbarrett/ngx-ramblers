import { inject, Injectable } from "@angular/core";
import { cloneDeep, first, isEqual, isNull, isUndefined, kebabCase, remove } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import {
  ActionType,
  AlbumData,
  AlbumView,
  ColumnInsertData,
  ContentText,
  DEFAULT_GALLERY_OPTIONS,
  DEFAULT_GRID_OPTIONS,
  HasColumnRange,
  HasPageContentRows,
  Index,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType,
  View
} from "../models/content-text.model";
import { AccessLevel } from "../models/member-resource.model";
import { move } from "../functions/arrays";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NumberUtilsService } from "./number-utils.service";
import { StringUtilsService } from "./string-utils.service";
import { KeyValue } from "../functions/enums";
import { UrlService } from "./url.service";
import { DEFAULT_OS_STYLE, MapProvider } from "../models/map.model";

@Injectable({
  providedIn: "root"
})
export class PageContentActionsService {

  private logger: Logger = inject(LoggerFactory).createLogger("PageContentActionsService", NgxLoggerLevel.ERROR);
  private stringUtils = inject(StringUtilsService);
  private urlService = inject(UrlService);
  private numberUtils = inject(NumberUtilsService);
  public rowsInEdit: number[] = [];
  public draggedRowIndex: number = null;
  public draggedColumnRowIndex: number = null;
  public draggedColumnIndex: number = null;
  public draggedColumnSourceRow: PageContentRow = null;
  public draggedNestedColumnIndex: number = null;
  public draggedNestedRowIndex: number = null;
  public nestedDragTargetColumnIndex: number = null;
  public nestedDragTargetRowIndex: number = null;
  public draggedColumnIsNested = false;
  public draggedColumnParentColumnIndex: number = null;
  public dragStartX: number = null;
  public dragStartY: number = null;
  public dragHasMoved = false;
  public dragOverColumnRowIndex: number = null;
  public dragOverColumnIndex: number = null;
  public dragOverColumnParentColumnIndex: number = null;
  public dragInsertAfter = false;

  public clearColumnDragState() {
    this.draggedColumnIndex = null;
    this.draggedColumnRowIndex = null;
    this.draggedColumnSourceRow = null;
    this.dragOverColumnRowIndex = null;
    this.dragOverColumnIndex = null;
    this.dragOverColumnParentColumnIndex = null;
    this.dragInsertAfter = false;
    this.draggedColumnIsNested = false;
    this.draggedColumnParentColumnIndex = null;
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
    return View.EDIT;
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

  notifyPageContentTextChange(contentText: ContentText, column: PageContentColumn, pageContent?: PageContent) {
    this.logger.info("notifyPageContentTextChange:contentText:", contentText,"column:", column, pageContent);
    if (column.contentText !== contentText?.text) {
      column.contentText = contentText?.text;
    }
    const incomingStyles = contentText?.styles ? cloneDeep(contentText.styles) : undefined;
    const currentStyles = column?.styles;
    const stylesChanged = !isEqual(incomingStyles, currentStyles);
    if (stylesChanged || (!incomingStyles && currentStyles)) {
      column.styles = incomingStyles;
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

  defaultIndex(): Index {
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

  public rowHeading(rowIndex: number, columnCount: number): string {
    return `Row ${rowIndex + 1}${(this.columnCount(columnCount))}`;
  }

  private columnCount(columnCount: number) {
    return columnCount > 0 ? ` (${this.stringUtils.pluraliseWithCount(columnCount, "column")})` : "";
  }

  public nestedRowHeading(rowIndex: number, columnIndex: number, rowCount: number): string {
    return `Row ${rowIndex + 1} column ${columnIndex + 1} (${this.stringUtils.pluraliseWithCount(rowCount, "nested row")})`;
  }

  public nestedRowDescription(nestedRowIndex: number, columnIndex: number, columnCount: number): string {
    return `Row ${nestedRowIndex + 1} (nested row ${nestedRowIndex + 1}  column ${columnIndex + 1}${(this.columnCount(columnCount))})`;
  }

  public nestedInnerRowHeading(rowIndex: number, innerRowIndex: number, rowType: PageContentType): string {
    return `Row ${rowIndex + 1}: nested row ${innerRowIndex + 1} ${rowType}`;
  }


  addNestedRows(column: PageContentColumn) {
    if (!column.rows) {
      column.rows = [];
      this.addRow(0, PageContentType.TEXT, column.rows);
      this.transferColumnContentToNestedColumn(column, column.rows[0]?.columns?.[0]);
    }
  }

  removeNestedRows(column: PageContentColumn) {
    if (column.rows) {
      delete column.rows;
    }
  }

  private transferColumnContentToNestedColumn(sourceColumn: PageContentColumn, targetColumn?: PageContentColumn) {
    if (!targetColumn) {
      return;
    }
    if (sourceColumn.contentText) {
      targetColumn.contentText = sourceColumn.contentText;
      delete sourceColumn.contentText;
    }
    if (sourceColumn.imageSource) {
      targetColumn.imageSource = sourceColumn.imageSource;
      delete sourceColumn.imageSource;
    }
    if (sourceColumn.alt) {
      targetColumn.alt = sourceColumn.alt;
      delete sourceColumn.alt;
    }
    if (!isUndefined(sourceColumn.imageBorderRadius)) {
      targetColumn.imageBorderRadius = sourceColumn.imageBorderRadius;
      delete sourceColumn.imageBorderRadius;
    }
    if (sourceColumn.imageAspectRatio) {
      targetColumn.imageAspectRatio = sourceColumn.imageAspectRatio;
      delete sourceColumn.imageAspectRatio;
    }
    if (!isUndefined(sourceColumn.showTextAfterImage)) {
      targetColumn.showTextAfterImage = sourceColumn.showTextAfterImage;
      delete sourceColumn.showTextAfterImage;
    }
    if (!isUndefined(sourceColumn.showPlaceholderImage)) {
      targetColumn.showPlaceholderImage = sourceColumn.showPlaceholderImage;
      delete sourceColumn.showPlaceholderImage;
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
  }

  async duplicateColumn(row: PageContentRow, columnIndex: number, pageContent: PageContent) {
    const columnData: PageContentColumn = await this.duplicateContentItemsInColumn(row, columnIndex);
    row.columns.splice(columnIndex, 0, columnData);
    this.logger.debug("pageContent:", pageContent);
  }

  async duplicateRow(row: PageContentRow, rowIndex: number, pageContent: PageContent) {
    const pageContentRow: PageContentRow = await this.duplicateContentItemsInRow(row);
    pageContent.rows.splice(rowIndex, 0, pageContentRow);
    this.logger.debug("pageContent:", pageContent);
  }

  private async duplicateContentItemsInColumn(row: PageContentRow, columnIndex: number): Promise<PageContentColumn> {
    const pageContentColumn = cloneDeep(row.columns[columnIndex]);
    this.logger.info("About to duplicate content items in:", row, "columnIndex:", columnIndex, "pageContentColumn:", pageContentColumn);

    if (pageContentColumn.rows) {
      this.logger.info("Duplicating", pageContentColumn.rows.length, "nested rows in column");
      pageContentColumn.rows = await this.copyContentTextIdsInRows(pageContentColumn.rows);
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

  changeMaxColumnsFor(inputElement: HTMLInputElement, row: HasColumnRange) {
    row.maxColumns = this.constrainInput(inputElement, 1, 4);
  }

  changeMinColumnsFor(inputElement: HTMLInputElement, row: HasColumnRange) {
    row.minColumns = this.constrainInput(inputElement, 1, 4);
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
    return !isNull(columnIndex) ? `column-${columnIndex + 1}` : "";
  }

  private rowPrefixFor(rowIndex: number) {
    return !isNull(rowIndex) ? `row-${rowIndex + 1}` : "";
  }

  private nestedRowPrefixFor(rowIndex: number) {
    return !isNull(rowIndex) ? `nested-row-${rowIndex + 1}` : "";
  }

  private nestedColumnPrefixFor(nestedColumnIndex: number) {
    return !isNull(nestedColumnIndex) ? `nested-column-${nestedColumnIndex + 1}` : "";
  }

  rowColumnIdentifierFor(rowIndex: number, columnIndex: number, identifier: string): string {
    return kebabCase(`${identifier}-${this.rowColFor(rowIndex, columnIndex)}`);
  }

  columnIdentifierFor(columnIndex: number, identifier: string): string {
    return kebabCase(`${identifier}-${this.rowColFor(null, columnIndex)}`);
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

  public isIndex(row: PageContentRow) {
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

  public isMap(row: PageContentRow) {
    return row?.type === PageContentType.MAP;
  }

  public ensureMapData(row: PageContentRow) {
    if (!row?.map) {
      row.map = {
        text: "",
        mapCenter: [51.25, 0.75],
        mapZoom: 10,
        mapHeight: 500,
        provider: MapProvider.OSM,
        osStyle: DEFAULT_OS_STYLE,
        showControlsDefault: true,
        allowControlsToggle: true,
        routes: []
      };
      this.logger.debug("ensureMapData: initialised map for row:", row);
    } else {
      if (isUndefined(row.map.showControlsDefault)) {
        row.map.showControlsDefault = true;
      }
      if (isUndefined(row.map.allowControlsToggle)) {
        row.map.allowControlsToggle = true;
      }
    }
  }

  public ensureAlbumIndexMapConfigDefaults(row: PageContentRow) {
    if (!row?.albumIndex?.mapConfig) {
      return;
    }
    if (isUndefined(row.albumIndex.mapConfig.showControlsDefault)) {
      row.albumIndex.mapConfig.showControlsDefault = true;
    }
    if (isUndefined(row.albumIndex.mapConfig.allowControlsToggle)) {
      row.albumIndex.mapConfig.allowControlsToggle = true;
    }
  }

  public isSharedFragment(row: PageContentRow) {
    return row?.type === PageContentType.SHARED_FRAGMENT;
  }

  public isLocation(row: PageContentRow): boolean {
    return row?.type === PageContentType.LOCATION;
  }

  public pageContentFound(pageContent: PageContent, queryCompleted: boolean) {
    const hasRows = pageContent?.rows?.length > 0;
    this.logger.debug("pageContentFound:hasRows:", hasRows, "queryCompleted:", queryCompleted);
    return hasRows && queryCompleted;
  }

  public rowContainer(pageContent: PageContent, rowIsNested: boolean, column: PageContentColumn): HasPageContentRows {
    return rowIsNested && column?.rows ? column : pageContent;
  }

  public moveColumnLeft(columns: PageContentColumn[], fromIndex: number) {
    const toIndex = fromIndex - 1;
    this.logger.info("moving column left fromIndex:", fromIndex, "toIndex:", toIndex);
    move(columns, fromIndex, toIndex);
  }

  public moveColumnRight(columns: PageContentColumn[], fromIndex: number, pageContent: PageContent) {
    const toIndex = fromIndex + 1;
    this.logger.info("moving column left fromIndex:", fromIndex, "toIndex:", toIndex);
    move(columns, fromIndex, toIndex);
  }

  public moveRowUp(pageContent: PageContent, rowIndex: number, rowIsNested: boolean, column: PageContentColumn) {
    move(this.rowContainer(pageContent, rowIsNested, column).rows, rowIndex, rowIndex - 1);
  }

  public moveRowDown(pageContent: PageContent, rowIndex: number, rowIsNested: boolean, column: PageContentColumn) {
    move(this.rowContainer(pageContent, rowIsNested, column).rows, rowIndex, rowIndex + 1);
  }

  public unnestToPreviousOuterRow(pageContent: PageContent, nestedRowIndex: number, column: PageContentColumn) {
    this.transferNestedRowToParent(pageContent, column, nestedRowIndex, 0);
  }

  public unnestToNextOuterRow(pageContent: PageContent, nestedRowIndex: number, column: PageContentColumn) {
    this.transferNestedRowToParent(pageContent, column, nestedRowIndex, 1);
  }

  private transferNestedRowToParent(pageContent: PageContent, column: PageContentColumn, nestedRowIndex: number, parentInsertOffset: number) {
    if (!column?.rows || nestedRowIndex < 0 || nestedRowIndex >= column.rows.length) {
      this.logger.warn("Cannot unnest: invalid parameters");
      return;
    }
    const parentRowIndex = this.parentRowIndexForColumn(pageContent, column);
    if (parentRowIndex < 0) {
      this.logger.warn("Cannot find parent row for column");
      return;
    }
    const [nestedRow] = column.rows.splice(nestedRowIndex, 1);
    if (!nestedRow) {
      return;
    }
    pageContent.rows.splice(parentRowIndex + parentInsertOffset, 0, nestedRow);
  }

  private parentRowIndexForColumn(pageContent: PageContent, column: PageContentColumn): number {
    return pageContent.rows.findIndex(row => row.columns.includes(column));
  }

  dragHasMovedEvent(event: DragEvent) {
    this.dragHasMoved = false;
    try {
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        const dragEl = (event.target as HTMLElement) || (event.currentTarget as HTMLElement);
        if (dragEl && event.dataTransfer.setDragImage) {
          event.dataTransfer.setDragImage(dragEl, 10, 10);
        }
      }
    } catch {
    }
  }

  public moveColumnBetweenRows(sourceRow: PageContentRow, sourceIndex: number, targetRow: PageContentRow, targetIndex: number) {
    if (!Array.isArray(sourceRow?.columns)) { return; }
    const [col] = sourceRow.columns.splice(sourceIndex, 1);
    if (!Array.isArray(targetRow.columns)) { targetRow.columns = []; }
    const safeIndex = Math.max(0, Math.min(targetIndex, targetRow.columns.length));
    targetRow.columns.splice(safeIndex, 0, col);
    const sourceIncrement = -1;
    const targetIncrement = 1;
    this.calculateColumnsFor(sourceRow, sourceIncrement);
    this.calculateColumnsFor(targetRow, targetIncrement);
  }

  public moveColumnToPreviousRow(pageContent: PageContent, currentRow: PageContentRow, columnIndex: number) {
    const rows = pageContent?.rows || [];
    const rowIndex = rows.indexOf(currentRow);
    if (rowIndex > 0) {
      this.calculateColumnsFor(rows[rowIndex - 1], 1);
      this.calculateColumnsFor(currentRow, -1);
      const [col] = currentRow.columns.splice(columnIndex, 1);
      rows[rowIndex - 1].columns.push(col);
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
    }
  }

  public clearNestedRowDragState() {
    this.draggedNestedColumnIndex = null;
    this.draggedNestedRowIndex = null;
  }

  public clearNestedDragTargets() {
    this.nestedDragTargetColumnIndex = null;
    this.nestedDragTargetRowIndex = null;
  }

  public nestedRowDragTooltip(columnIndex: number, nestedRowIndex: number): string | null {
    const sCol = this.draggedNestedColumnIndex;
    const sRow = this.draggedNestedRowIndex;
    if (isNull(sCol) || isNull(sRow)) {
      return null;
    }
    if (this.nestedDragTargetColumnIndex !== columnIndex || this.nestedDragTargetRowIndex !== nestedRowIndex) {
      return null;
    }
    if (sCol === columnIndex && sRow === nestedRowIndex) {
      return "Drop: no change";
    }
    const where = sCol === columnIndex ? (sRow < nestedRowIndex ? "after" : "before") : "into column " + (columnIndex + 1);
    return `Drop nested row ${sRow + 1} ${where} ${sCol === columnIndex ? "row " + (nestedRowIndex + 1) : ""}`.trim();
  }

  public columnDragTooltip(rowIndex: number, columnIndex: number, isNestedLevel: boolean, parentColumnIndex: number | null): string | null {
    const srcIndex = this.draggedColumnIndex;
    if (isNull(srcIndex) || isUndefined(srcIndex)) { return null; }
    if (!this.dragHasMoved) { return null; }
    if (this.draggedColumnIsNested !== isNestedLevel) { return null; }
    if (this.dragOverColumnRowIndex !== rowIndex || this.dragOverColumnIndex !== columnIndex) { return null; }
    if (isNestedLevel && this.dragOverColumnParentColumnIndex !== parentColumnIndex) { return null; }
    const beforeAfter = this.dragInsertAfter ? "after" : "before";
    return `Drop ${beforeAfter} Col ${columnIndex + 1}`;
  }

  public moveNestedRowBetweenColumns(parentRow: PageContentRow, sourceColumnIndex: number, sourceNestedRowIndex: number, targetColumnIndex: number, targetNestedRowIndex: number) {
    if (!parentRow?.columns) {
      return;
    }
    const ensureRows = (colIndex: number) => {
      const col = parentRow.columns[colIndex];
      if (!col) {
        return;
      }
      if (!col.rows) {
        this.addNestedRows(col);
      }
    };
    ensureRows(sourceColumnIndex);
    ensureRows(targetColumnIndex);
    if (sourceColumnIndex === targetColumnIndex) {
      const rows = parentRow.columns[targetColumnIndex].rows || [];
      const [item] = rows.splice(sourceNestedRowIndex, 1);
      rows.splice(targetNestedRowIndex, 0, item);
    } else {
      const sourceRows = parentRow.columns[sourceColumnIndex].rows || [];
      const targetRows = parentRow.columns[targetColumnIndex].rows || [];
      const [item] = sourceRows.splice(sourceNestedRowIndex, 1);
      targetRows.splice(targetNestedRowIndex, 0, item);
    }
  }

  public joinWithPreviousRow(pageContent: PageContent, currentRow: PageContentRow, nestedParentColumn?: PageContentColumn) {
    const rows = nestedParentColumn?.rows || pageContent?.rows || [];
    const rowIndex = rows.indexOf(currentRow);

    if (rowIndex <= 0) {
      return;
    }

    const previousRow = rows[rowIndex - 1];
    if (!this.canJoinRows(currentRow, previousRow)) {
      return;
    }

    const currentColumn = currentRow.columns[0];
    const previousColumn = previousRow.columns[0];

    previousColumn.contentText = [previousColumn.contentText || "", currentColumn.contentText || ""]
      .filter(t => t.trim().length > 0)
      .join("\n\n");

    if (currentColumn.imageSource && !previousColumn.imageSource) {
      previousColumn.imageSource = currentColumn.imageSource;
      previousColumn.alt = currentColumn.alt;
      previousColumn.imageBorderRadius = currentColumn.imageBorderRadius;
      previousColumn.imageAspectRatio = currentColumn.imageAspectRatio;
      previousColumn.showTextAfterImage = currentColumn.showTextAfterImage;
    }

    rows.splice(rowIndex, 1);
  }

  public joinWithNextRow(pageContent: PageContent, currentRow: PageContentRow, nestedParentColumn?: PageContentColumn) {
    const rows = nestedParentColumn?.rows || pageContent?.rows || [];
    const rowIndex = rows.indexOf(currentRow);

    if (rowIndex < 0 || rowIndex >= rows.length - 1) {
      return;
    }

    const nextRow = rows[rowIndex + 1];
    if (!this.canJoinRows(currentRow, nextRow)) {
      return;
    }

    const currentColumn = currentRow.columns[0];
    const nextColumn = nextRow.columns[0];

    currentColumn.contentText = [currentColumn.contentText || "", nextColumn.contentText || ""]
      .filter(t => t.trim().length > 0)
      .join("\n\n");

    if (nextColumn.imageSource && !currentColumn.imageSource) {
      currentColumn.imageSource = nextColumn.imageSource;
      currentColumn.alt = nextColumn.alt;
      currentColumn.imageBorderRadius = nextColumn.imageBorderRadius;
      currentColumn.imageAspectRatio = nextColumn.imageAspectRatio;
      currentColumn.showTextAfterImage = nextColumn.showTextAfterImage;
    }

    rows.splice(rowIndex + 1, 1);
  }

  public canJoinRows(row1: PageContentRow, row2: PageContentRow): boolean {
    return row1?.type === "text"
      && row2?.type === "text"
      && row1?.columns?.length === 1
      && row2?.columns?.length === 1
      && !row1.columns[0]?.rows
      && !row2.columns[0]?.rows;
  }

  public equaliseColumnWidths(row: PageContentRow) {
    const count = row?.columns?.length || 0;
    if (count <= 0) { return; }
    const base = Math.floor(12 / count);
    let remainder = 12 - (base * count);
    row.columns.forEach((column, index) => {
      const extra = remainder > 0 ? 1 : 0;
      column.columns = base + extra;
      if (remainder > 0) { remainder--; }
    });
  }

  public moveColumnToEmptyRow(sourceRow: PageContentRow, sourceIndex: number, targetRow: PageContentRow, pageContent: PageContent) {
    const [col] = sourceRow.columns.splice(sourceIndex, 1);
    this.calculateColumnsFor(sourceRow, -1);
    if (!targetRow.columns) { targetRow.columns = []; }
    col.columns = 12;
    targetRow.columns.splice(0, 0, col);
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
