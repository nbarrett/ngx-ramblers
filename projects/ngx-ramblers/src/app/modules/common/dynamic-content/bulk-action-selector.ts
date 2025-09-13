import { Component, inject, Input, OnInit } from "@angular/core";
import { PageContentRow } from "../../../models/content-text.model";
import { PageContentRowService } from "../../../services/page-content-row.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
    selector: "app-bulk-action-selector",
    template: `
      <div class="form-check form-check-inline mb-0 float-end d-inline-flex align-items-center">
          <input (click)="pageContentRowService.toggleSelection(row)"
                 [checked]="pageContentRowService.isSelected(row)"
                 type="checkbox" class="form-check-input"
                 [id]="id">
          <label class="form-check-label"
                 [for]="id">Select Row
          </label>
      </div>`
})

export class BulkActionSelectorComponent implements OnInit {
  pageContentRowService = inject(PageContentRowService);
  private numberUtils = inject(NumberUtilsService);
  actions = inject(PageContentActionsService);

  @Input()
  public row: PageContentRow;
  public id: string;

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
  }

}
