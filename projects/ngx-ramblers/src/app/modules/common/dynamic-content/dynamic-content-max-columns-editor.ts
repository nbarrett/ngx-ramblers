import { Component, inject, Input, OnInit } from "@angular/core";
import { HasColumnRange, PageContentRow } from "../../../models/content-text.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "[app-dynamic-content-max-columns-editor]",
    template: `
      <div class="row g-2">
        <div class="col">
          <label [for]="id +'-min-cols'">Min Columns</label>
          <input [id]="id +'-min-cols'" #minInput (input)="actions.changeMinColumnsFor(minInput, hasColumnRange)"
                 [value]="hasColumnRange.minColumns || 1"
                 autocomplete="columns"
                 class="form-control input-sm column-input" placeholder="Min (1-4)"
                 type="number">
        </div>
        <div class="col">
          <label [for]="id +'-max-cols'">Max Columns</label>
          <input [id]="id +'-max-cols'" #maxInput (input)="actions.changeMaxColumnsFor(maxInput, hasColumnRange)"
                 [value]="hasColumnRange.maxColumns"
                 autocomplete="columns"
                 class="form-control input-sm column-input" placeholder="Max (1-4)"
                 type="number">
        </div>
      </div>
    `,
    imports: [FormsModule]
})

export class DynamicContentMaxColumnsEditorComponent implements OnInit {
  siteEditService = inject(SiteEditService);
  private numberUtils = inject(NumberUtilsService);
  actions = inject(PageContentActionsService);
  @Input()
  public hasColumnRange: HasColumnRange;
  protected id: string;

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
  }

}

