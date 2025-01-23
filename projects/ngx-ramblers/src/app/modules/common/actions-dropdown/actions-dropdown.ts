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
import { textStyleSelectors } from "../../../models/system.model";
import { BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { ColourSelectorComponent } from "../../../pages/banner/colour-selector";

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
    <div class="btn-group" dropdown>
      <button aria-controls="dropdown-animated" class="dropdown-toggle badge-button" dropdownToggle
              type="button">
        <fa-icon [icon]="faTableCells"></fa-icon>
        <span class="ml-2">{{ actionType() }} Actions</span><span class="caret"></span>
      </button>
      <ul *dropdownMenu class="dropdown-menu" (click)="actionClicked($event)"
          id="dropdown-animated" role="menu">
        @if (allowMoveRowUp()) {
          <li role="menuitem">
            <a (click)="actions.moveRowUp(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
              Move <b>Row</b> up
            </a>
          </li>
        }
        @if (allowMoveRowDown()) {
          <li role="menuitem">
            <a (click)="actions.moveRowDown(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
              Move <b>Row</b> down
            </a>
          </li>
        }
        @if (allowDeleteRow()) {
          <li role="menuitem">
            <a (click)="actions.deleteRow(pageContent, rowIndex, rowIsNested, column)" class="dropdown-item">
              Delete <b>Row</b>
            </a>
          </li>
        }
        @if (allowInsertNestedRows()) {
          <li role="menuitem">
            <a (click)="actions.addNestedRows(column)" class="dropdown-item">
              Insert <b>Nested Rows</b>
            </a>
          </li>
        }
        @if (allowDeleteNestedRows()) {
          <li role="menuitem">
            <a (click)="actions.removeNestedRows(column)" class="dropdown-item">
              Delete <b>Nested Rows</b>
            </a>
          </li>
        }
        @if (allowColumnActions()) {
          <li role="menuitem">
            <a (click)="actions.addColumn(row, columnIndex, pageContent)" class="dropdown-item">
              Insert <b>Column</b> to left
            </a>
          </li>
        }
        @if (allowColumnActions()) {
          <li role="menuitem">
            <a (click)="actions.addColumn(row, columnIndex+1, pageContent)" class="dropdown-item">
              Insert <b>Column</b> to right
            </a>
          </li>
        }
        @if (allowColumnMoveLeft()) {
          <li role="menuitem">
            <a (click)="actions.moveColumnLeft(row.columns, columnIndex, pageContent)" class="dropdown-item">
              Move <b>Column</b> to left
            </a>
          </li>
        }
        @if (allowColumnMoveRight()) {
          <li role="menuitem">
            <a (click)="actions.moveColumnRight(row.columns, columnIndex, pageContent)" class="dropdown-item">
              Move <b>Column</b> to right
            </a>
          </li>
        }
        @if (allowColumnActions()) {
          <li role="menuitem">
            <a (click)="actions.duplicateColumn(row, columnIndex, pageContent)" class="dropdown-item">
              Duplicate <b>Column</b>
            </a>
          </li>
        }
        @if (allowColumnDelete()) {
          <li role="menuitem">
            <a (click)="actions.deleteColumn(row, columnIndex, pageContent)" class="dropdown-item">
              Delete <b>Column</b>
            </a>
          </li>
        }
        @if (allowColumnActions() && markdownEditorComponentInjected()) {
          <hr>
          <div class="ml-2">Bullet style</div>
          <a (click)="assignListStyleTo(ListStyle.ARROW)" class="dropdown-item">
            <li role="menuitem" class="list-style-arrow">
              <small class="p-2"
                     [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.ARROW)}">{{ listStyleIs(ListStyle.ARROW) ? 'Selected' : '' }}</small>
            </li>
          </a>
          <a (click)="assignListStyleTo(ListStyle.TICK_MEDIUM)" class="dropdown-item">
            <li role="menuitem" class="list-style-tick-medium">
              <small class="p-2"
                     [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.TICK_MEDIUM)}">{{ listStyleIs(ListStyle.TICK_MEDIUM) ? 'Selected' : '' }}</small>
            </li>
          </a>
          <a (click)="assignListStyleTo(ListStyle.TICK_LARGE)" class="dropdown-item">
            <li role="menuitem" class="list-style-tick-large">
              <small class="p-2"
                     [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.TICK_LARGE)}">{{ listStyleIs(ListStyle.TICK_LARGE) ? 'Selected' : '' }}</small>
            </li>
          </a>
          <a (click)="assignListStyleTo(ListStyle.NO_IMAGE)" class="dropdown-item">
            <li role="menuitem" class="list-style-none"><small>(no image)</small>
              <small class="p-2"
                     [ngClass]="{'font-weight-bold': listStyleIs(ListStyle.NO_IMAGE)}">{{ listStyleIs(ListStyle.NO_IMAGE) ? 'Selected' : '' }}</small>
            </li>
          </a>
          <hr>
          <div class="ml-2 mb-2">Styling Options</div>
          <a (click)="backgroundColourClick($event)" class="dropdown-item">
            <li role="menuitem">
              <app-colour-selector noLabel [colours]="textStyleSelectors" [itemWithClassOrColour]="styles()"/>
            </li>
          </a>
        }
        @if (allowTextRowActions()) {
          <li role="menuitem">
            <a (click)="actions.addRow(rowIndex,'text', rows())" class="dropdown-item">
              Add <b>Row</b> above
            </a>
          </li>
        }
        @if (allowTextRowActions()) {
          <li role="menuitem">
            <a (click)="actions.addRow(rowIndex + 1, 'text', rows())" class="dropdown-item">
              Add <b>Row</b> below
            </a>
          </li>
        }
        @if (allowActionButtonActions()) {
          <li role="menuitem">
            <a (click)="actions.addRow(rowIndex, 'action-buttons', rows())" class="dropdown-item">
              Add <b>Action Buttons</b> above
            </a>
          </li>
        }
        @if (allowActionButtonActions()) {
          <li role="menuitem">
            <a (click)="actions.addRow(rowIndex + 1, 'action-buttons', rows())" class="dropdown-item">
              Add <b>Action Buttons</b> below
            </a>
          </li>
        }
      </ul>
    </div>`,
    imports: [BsDropdownDirective, BsDropdownToggleDirective, FontAwesomeModule, BsDropdownMenuDirective, NgClass, ColourSelectorComponent]
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
  protected readonly textStyleSelectors = textStyleSelectors;

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

  ngOnInit() {
    this.logger.info("actionType:", this.actionType(), "row:", this.row, "column:", this.column, "rowIndex:", this.rowIndex, "columnIndex:", this.columnIndex, "rowIsNested:", this.rowIsNested, "pageContent:", this.pageContent, "markdownEditorComponent:", this.markdownEditorComponent);
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

  allowTextRowActions() {
    return this.rowIndex >= 0;
  }

  allowActionButtonActions() {
    return this.rowIndex >= 0 && !this.rowIsNested;
  }

  allowColumnDelete() {
    return this.columnIndex > 0;
  }

  assignListStyleTo(listStyle: ListStyle) {
    this.markdownEditorComponent.assignListStyleTo(listStyle);
  }

  listStyleIs(listStyle: ListStyle): boolean {
    return this.markdownEditorComponent.listStyleIs(listStyle);
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

  backgroundColourClick($event: MouseEvent) {
    this.logger.info("backgroundColourClick:", $event);
    $event.stopPropagation();
  }

  public actionType(): string {
    return this.actions.actionType(this.columnIndex, this.rowIndex, this.rowIsNested);
  }
}
