import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { faArrowsLeftRight, faArrowsLeftRightToLine } from "@fortawesome/free-solid-svg-icons";
import { PageContentColumn } from "../../../models/content-text.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-column-width",
    template: `
      <label [for]="id">Width (1-12)</label>
      <div class="input-group">
          <input #input (input)="actions.changeColumnWidthFor(input, column)"
                 [id]="id"
                 [value]="column.columns"
                 autocomplete="columns"
                 class="form-control input-sm"
                 placeholder="Enter number of columns (1-12)"
                 type="number">
          <button type="button" class="btn btn-outline-secondary" [tooltip]="expandAction" (click)="toggleExpand()">
              <fa-icon [icon]="expanded? faArrowsLeftRightToLine:faArrowsLeftRight" class="fa-icon"></fa-icon>
          </button>
      </div>
  `,
    imports: [TooltipDirective, FontAwesomeModule]
})

export class ColumnWidthComponent implements OnInit {
  private numberUtils = inject(NumberUtilsService);
  actions = inject(PageContentActionsService);
  @Input()
  public column: PageContentColumn;
  @Output() expandToggle: EventEmitter<boolean> = new EventEmitter();
  public id: string;
  public expanded = false;

  protected readonly faArrowsLeftRight = faArrowsLeftRight;
  protected readonly faArrowsLeftRightToLine = faArrowsLeftRightToLine;

  expandAction: string;
  INITIAL_EXPAND_TOOLTIP = "Temporarily expand this column to full width to make it easier to edit content";

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
    this.expandAction = this.INITIAL_EXPAND_TOOLTIP;
  }

  toggleExpand() {
    if (this.expanded) {
      this.expandAction = this.INITIAL_EXPAND_TOOLTIP;
    } else {
      this.expandAction = `Collapse to original width of ${this.column.columns}`;
    }
    this.expanded = !this.expanded;
    this.expandToggle.emit(this.expanded);
  }
}
