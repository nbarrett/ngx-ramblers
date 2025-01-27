import { Component, inject, Input, OnInit } from "@angular/core";
import { PageContentRow } from "../../../models/content-text.model";
import { PageContentRowService } from "../../../services/page-content-row.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
    selector: "app-bulk-action-selector",
    template: `
      <div class="custom-control custom-checkbox float-right">
          <input (click)="pageContentRowService.toggleSelection(row)"
                 [checked]="pageContentRowService.isSelected(row)"
                 type="checkbox" class="custom-control-input"
                 [id]="id">
          <label class="custom-control-label"
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

