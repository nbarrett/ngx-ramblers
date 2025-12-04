import { Component, inject, Input, OnInit } from "@angular/core";
import { faTableCells } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  ContentTextStyles,
  ListStyle,
  PageContent,
  PageContentColumn,
  PageContentRow
} from "../../../models/content-text.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { ContentFormattingSelectorComponent } from "../content-formatting-selector/content-formatting-selector";
import { isNull, isUndefined } from "es-toolkit/compat";

@Component({
    selector: "app-actions-dropdown",
    styles: [`
    .column-input
      width: 44px
      padding-left: 6px
      padding-right: 6px

    .input-sm
      margin-top: 0
      height: 29px
  `],
    template: `
      <div class="btn-group" [ngClass]="{'w-100': fullWidth}" dropdown>
        <button aria-controls="dropdown-animated" class="dropdown-toggle badge-button border-0"
                [ngClass]="{'w-100': fullWidth}" dropdownToggle
                type="button">
          <fa-icon [icon]="faTableCells"></fa-icon>
          <span class="ms-2">{{ actionType() }} Actions</span><span class="caret"></span>
        </button>
        <ul *dropdownMenu class="dropdown-menu" [ngClass]="{'w-100': fullWidth}" (click)="actionClicked($event)"
            id="dropdown-animated" role="menu">
          @if (showRowActions && allowMoveRowUp()) {
            <li role="menuitem">
              <a (click)="actions.moveRowUp(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
                Move <b>Row</b> up
              </a>
            </li>
          }
          @if (showRowActions && allowEqualiseColumnWidths()) {
            <li role="menuitem">
              <a (click)="actions.equaliseColumnWidths(row)" class="dropdown-item">
                Column Widths Equal
              </a>
            </li>
          }
          @if (showRowActions && allowMoveRowDown()) {
            <li role="menuitem">
              <a (click)="actions.moveRowDown(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
                Move <b>Row</b> down
              </a>
            </li>
          }
          @if (showRowActions && allowUnnestToPreviousOuterRow()) {
            <li role="menuitem">
              <a (click)="actions.unnestToPreviousOuterRow(pageContent, rowIndex, column)" class="dropdown-item">
                Unnest to <b>previous outer row</b>
              </a>
            </li>
          }
          @if (showRowActions && allowUnnestToNextOuterRow()) {
            <li role="menuitem">
              <a (click)="actions.unnestToNextOuterRow(pageContent, rowIndex, column)" class="dropdown-item">
                Unnest to <b>next outer row</b>
              </a>
            </li>
          }
          @if (showRowActions && allowTextRowActions()) {
            <li role="menuitem">
              <a (click)="actions.duplicateRow(row, rowIndex, pageContent)" class="dropdown-item">
                Duplicate <b>Row</b>
              </a>
            </li>
          }
          @if (showRowActions && allowDeleteRow()) {
            <li role="menuitem">
              <a (click)="actions.deleteRow(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
                Delete <b>Row</b>
              </a>
            </li>
          }
          @if (showColumnActions && allowInsertNestedRows()) {
            <li role="menuitem">
              <a (click)="actions.addNestedRows(column)" class="dropdown-item">
                Insert <b>Nested Rows</b>
              </a>
            </li>
          }
          @if (showColumnActions && allowDeleteNestedRows()) {
            <li role="menuitem">
              <a (click)="actions.removeNestedRows(column)" class="dropdown-item">
                Delete <b>Nested Rows</b>
              </a>
            </li>
          }
          @if (showColumnActions && allowColumnActions()) {
            <li role="menuitem">
              <a (click)="actions.addColumn(row, columnIndex, pageContent)" class="dropdown-item">
                Insert <b>Column</b> to left
              </a>
            </li>
          }
          @if (showColumnActions && allowColumnActions()) {
            <li role="menuitem">
              <a (click)="actions.addColumn(row, columnIndex+1, pageContent)" class="dropdown-item">
                Insert <b>Column</b> to right
              </a>
            </li>
          }
          @if (showColumnActions && allowColumnMoveLeft()) {
            <li role="menuitem">
              <a (click)="actions.moveColumnLeft(row.columns, columnIndex)" class="dropdown-item">
                Move <b>Column</b> to left
              </a>
            </li>
          }
          @if (showColumnActions && allowColumnMoveRight()) {
            <li role="menuitem">
              <a (click)="actions.moveColumnRight(row.columns, columnIndex, pageContent)" class="dropdown-item">
                Move <b>Column</b> to right
              </a>
            </li>
          }
          @if (showColumnActions && allowMoveColumnToPreviousRow()) {
            <li role="menuitem">
              <a (click)="actions.moveColumnToPreviousRow(pageContent, row, columnIndex)" class="dropdown-item">
                Move <b>Column</b> to previous row
              </a>
            </li>
          }
          @if (showColumnActions && allowMoveColumnToNextRow()) {
            <li role="menuitem">
              <a (click)="actions.moveColumnToNextRow(pageContent, row, columnIndex)" class="dropdown-item">
                Move <b>Column</b> to next row
              </a>
            </li>
          }
          @if (showColumnActions && allowMoveColumnToFirstEmptyRow()) {
            <li role="menuitem">
              <a (click)="actions.moveColumnToFirstEmptyRow(pageContent, row, columnIndex)" class="dropdown-item">
                Move <b>Column</b> to first empty row
              </a>
            </li>
          }
          @if (showColumnActions && allowColumnActions()) {
            <li role="menuitem">
              <a (click)="actions.duplicateColumn(row, columnIndex, pageContent)" class="dropdown-item">
                Duplicate <b>Column</b>
              </a>
            </li>
          }
          @if (showColumnActions && allowColumnDelete()) {
            <li role="menuitem">
              <a (click)="actions.deleteColumn(row, columnIndex, pageContent)" class="dropdown-item">
                Delete <b>Column</b>
              </a>
            </li>
          }
          @if (allowColumnActions() && markdownEditorComponentInjected()) {
            <li>
              <hr class="dropdown-divider">
            </li>
            <app-content-formatting-selector
              [styles]="styles()"
              [standaloneMenu]="false"
              (listStyleChange)="assignListStyleTo($event)"
              (textStyleChange)="assignTextStyleTo($event)">
            </app-content-formatting-selector>
          }
          @if (showRowActions && allowTextRowActions()) {
            <li role="menuitem">
              <a (click)="actions.addRow(rowIndex,'text', rows())" class="dropdown-item">
                Add <b>Row</b> above
              </a>
            </li>
          }
          @if (showRowActions && allowTextRowActions()) {
            <li role="menuitem">
              <a (click)="actions.addRow(rowIndex + 1, 'text', rows())" class="dropdown-item">
                Add <b>Row</b> below
              </a>
            </li>
          }
          @if (showRowActions && allowActionButtonActions()) {
            <li role="menuitem">
              <a (click)="actions.addRow(rowIndex, 'action-buttons', rows())" class="dropdown-item">
                Add <b>Action Buttons</b> above
              </a>
            </li>
          }
          @if (showRowActions && allowActionButtonActions()) {
            <li role="menuitem">
              <a (click)="actions.addRow(rowIndex + 1, 'action-buttons', rows())" class="dropdown-item">
                Add <b>Action Buttons</b> below
              </a>
            </li>
          }
        </ul>
      </div>`,
    imports: [BsDropdownDirective, BsDropdownToggleDirective, FontAwesomeModule, BsDropdownMenuDirective, NgClass, ContentFormattingSelectorComponent]
})
export class ActionsDropdownComponent implements OnInit {

  @Input("markdownEditorComponent") set valueForMarkdownEditorComponent(markdownEditorComponent: MarkdownEditorComponent) {
    if (markdownEditorComponent) {
      this.logger.off("markdownEditorComponent set to:", markdownEditorComponent);
      this.markdownEditorComponent = markdownEditorComponent;
    }
  }
  public actions: PageContentActionsService = inject(PageContentActionsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("ActionsDropdownComponent", NgxLoggerLevel.ERROR);
  private markdownEditorComponent: MarkdownEditorComponent;
  protected readonly faTableCells = faTableCells;
  protected readonly ListStyle = ListStyle;
  @Input() public fullWidth = false;
  @Input() public pageContent: PageContent;
  @Input() public row: PageContentRow;
  @Input() public column: PageContentColumn;
  @Input() public columnIndex: number;
  @Input() public rowIndex: number;
  @Input() public rowIsNested: boolean;
  @Input() public showRowActions = true;
  @Input() public showColumnActions = true;

  ngOnInit() {
    if (isUndefined(this.columnIndex) || isNull(this.columnIndex) || isNaN(this.columnIndex as any)) {
      this.showColumnActions = false;
    }
    this.logger.info("actionType:", this.actionType(), "row:", this.row, "column:", this.column, "rowIndex:", this.rowIndex, "columnIndex:", this.columnIndex, "rowIsNested:", this.rowIsNested, "pageContent:", this.pageContent, "markdownEditorComponent:", this.markdownEditorComponent, "showRowActions:", this.showRowActions, "showColumnActions:", this.showColumnActions);
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

  allowUnnestToPreviousOuterRow(): boolean {
    return this.rowIsNested && this.rowIndex >= 0;
  }

  allowUnnestToNextOuterRow(): boolean {
    return this.rowIsNested && this.rowIndex >= 0;
  }

  allowDeleteRow() {
    return this.rows().length > 1 && this.rowIndex >= 0;
  }

  allowInsertNestedRows(): boolean {
    return this.actions.isTextRow(this.row) && this.columnIndex >= 0 && !this.rowIsNested && !this.actions.nestedRowsExistFor(this?.column);
  }

  allowDeleteNestedRows(): boolean {
    return !this.rowIsNested && this.actions.nestedRowsExistFor(this?.column);
  }

  allowColumnMoveLeft() {
    return this.columnIndex > 0;
  }

  allowColumnMoveRight() {
    return this.columnIndex < this?.row?.columns?.length - 1;
  }

  allowColumnActions() {
    return this.columnIndex >= 0;
  }

  allowMoveColumnToPreviousRow(): boolean {
    return !this.rowIsNested && this.rowIndex > 0 && this.columnIndex >= 0;
  }

  allowMoveColumnToNextRow(): boolean {
    return !this.rowIsNested && this.rowIndex >= 0 && this.rowIndex < this.rows().length - 1 && this.columnIndex >= 0;
  }

  allowMoveColumnToFirstEmptyRow(): boolean {
    return !this.rowIsNested && this.columnIndex >= 0;
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

  allowEqualiseColumnWidths() {
    return this.row?.columns?.length > 0;
  }

  assignListStyleTo(listStyle: ListStyle) {
    this.markdownEditorComponent.assignListStyleTo(listStyle);
  }

  assignTextStyleTo(className: string) {
    this.markdownEditorComponent.assignTextStyleTo(className);
  }

  actionClicked($event: MouseEvent) {
    this.logger.info("actionClicked:", $event);
  }

  markdownEditorComponentInjected(): boolean {
    return !!this.markdownEditorComponent;
  }

  styles(): ContentTextStyles {
    this.logger.info("markdownEditorComponent content:", this?.markdownEditorComponent?.content, "background:", this?.markdownEditorComponent?.content?.styles?.class);
    return this?.markdownEditorComponent?.content?.styles;
  }

  public actionType(): string {
    return this.actions.actionType(this.columnIndex, this.rowIndex, this.rowIsNested);
  }
}
