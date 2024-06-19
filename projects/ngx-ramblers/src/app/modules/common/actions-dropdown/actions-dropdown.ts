import { Component, Input, OnInit } from "@angular/core";
import { faTableCells } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
  selector: "app-actions-dropdown",
  styles: [`
    .column-input
      width: 44px
      padding-left: 6px
      padding-right: 6px

    .input-sm
      margin-top: 0
      height: 29px`
  ],
  template: `
    <div class="btn-group" dropdown>
      <button aria-controls="dropdown-animated" class="dropdown-toggle badge-button" dropdownToggle
              type="button">
        <fa-icon [icon]="faTableCells"></fa-icon>
        <span class="ml-2">Actions</span><span class="caret"></span>
      </button>
      <ul *dropdownMenu class="dropdown-menu"
          id="dropdown-animated" role="menu">
        <li *ngIf="allowMoveRowUp()" role="menuitem">
          <a (click)="actions.moveRowUp(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
            Move this <b>Row</b> up
          </a>
        </li>
        <li *ngIf="allowMoveRowDown()" role="menuitem">
          <a (click)="actions.moveRowDown(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
            Move this <b>Row</b> down
          </a>
        </li>
        <li *ngIf="allowDeleteRow()" role="menuitem">
          <a (click)="actions.deleteRow(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
            Delete this <b>Row</b>
          </a>
        </li>
        <li *ngIf="allowInsertNestedRows()" role="menuitem">
          <a (click)="actions.addNestedRows(column)" class="dropdown-item">
            Insert <b>Nested Rows</b>
          </a>
        </li>
        <li *ngIf="allowDeleteNestedRows()" role="menuitem">
          <a (click)="actions.removeNestedRows(column)" class="dropdown-item">
            Delete <b>Nested Rows</b>
          </a>
        </li>
        <li *ngIf="allowColumnActions()" role="menuitem">
          <a (click)="actions.addColumn(row, columnIndex, pageContent)" class="dropdown-item">
            Insert <b>Column</b> to left
          </a>
        </li>
        <li *ngIf="allowColumnActions()" role="menuitem">
          <a (click)="actions.addColumn(row, columnIndex+1, pageContent)" class="dropdown-item">
            Insert <b>Column</b> to right
          </a>
        </li>
        <li *ngIf="allowColumnMoveLeft()" role="menuitem">
          <a (click)="actions.moveColumnLeft(row.columns, columnIndex, pageContent)" class="dropdown-item">
            Move <b>Column</b> to left
          </a>
        </li>
        <li *ngIf="allowColumnMoveRight()" role="menuitem">
          <a (click)="actions.moveColumnRight(row.columns, columnIndex, pageContent)" class="dropdown-item">
            Move <b>Column</b> to right
          </a>
        </li>
        <li *ngIf="allowColumnActions()" role="menuitem">
          <a (click)="actions.duplicateColumn(row, columnIndex, pageContent)" class="dropdown-item">
            Duplicate this <b>Column</b>
          </a>
        </li>
        <li *ngIf="allowColumnDelete()" role="menuitem">
          <a (click)="actions.deleteColumn(row, columnIndex, pageContent)" class="dropdown-item">
            Delete <b>Column</b>
          </a>
        </li>
        <li *ngIf="allowTextRowActions()" role="menuitem">
          <a (click)="actions.addRow(rowIndex,'text', rows())" class="dropdown-item">
            Add <b>Row</b> above
          </a>
        </li>
        <li *ngIf="allowTextRowActions()" role="menuitem">
          <a (click)="actions.addRow(rowIndex + 1, 'text', rows())" class="dropdown-item">
            Add <b>Row</b> below
          </a>
        </li>
        <li *ngIf="allowActionButtonActions()" role="menuitem">
          <a (click)="actions.addRow(rowIndex, 'action-buttons', rows())" class="dropdown-item">
            Add <b>Action Buttons</b> above
          </a>
        </li>
        <li *ngIf="allowActionButtonActions()" role="menuitem">
          <a (click)="actions.addRow(rowIndex + 1, 'action-buttons', rows())" class="dropdown-item">
            Add <b>Action Buttons</b> below
          </a>
        </li>
      </ul>
    </div>`
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
    this.logger = loggerFactory.createLogger(ActionsDropdownComponent, NgxLoggerLevel.ERROR);
  }

  ngOnInit() {
    this.logger.info("row:", this.row, "column:", this.column, "rowIndex:", this.rowIndex, "columnIndex:", this.columnIndex, "rowIsNested:", this.rowIsNested, "pageContent:", this.pageContent)
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

  allowColumnMoveLeft() {
    return this.columnIndex > 0;
  }

  allowColumnMoveRight() {
    return this.columnIndex < this.row.columns.length - 1;
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
