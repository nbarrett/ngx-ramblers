import { Component, inject, Input, OnInit } from "@angular/core";
import { HasMaxColumns, PageContentRow } from "../../../models/content-text.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "[app-dynamic-content-max-columns-editor]",
    template: `
      <label [for]="id +'max-cols'">Max Columns</label>
      <input [id]="id +'max-cols'" #input (input)="actions.changeMaxColumnsFor(input, hasMaxColumns)"
             [value]="hasMaxColumns.maxColumns"
             autocomplete="columns"
             class="form-control input-sm column-input" placeholder="Enter number of viewable columns (1-4)"
             type="number">
    `,
    imports: [FormsModule]
})

export class DynamicContentMaxColumnsEditorComponent implements OnInit {
  siteEditService = inject(SiteEditService);
  private numberUtils = inject(NumberUtilsService);
  actions = inject(PageContentActionsService);
  @Input()
  public hasMaxColumns: HasMaxColumns;
  protected id: string;

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
  }

}

