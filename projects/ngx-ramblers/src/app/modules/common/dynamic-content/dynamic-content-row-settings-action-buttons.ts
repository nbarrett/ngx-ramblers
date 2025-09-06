import { Component, inject, Input, OnInit } from "@angular/core";
import { PageContentRow } from "../../../models/content-text.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { FormsModule } from "@angular/forms";
import { DynamicContentMaxColumnsEditorComponent } from "./dynamic-content-max-columns-editor";

@Component({
    selector: "[app-row-settings-action-buttons]",
    template: `
      @if (actions.isActionButtons(row) || actions.isAlbumIndex(row)) {
        <div class="row align-items-end">
          <div class="col-auto" app-dynamic-content-max-columns-editor [hasMaxColumns]="row"></div>
          <div class="col-auto">
            <div class="form-check">
              <input name="showSwiper" [(ngModel)]="row.showSwiper"
                     [checked]="row.showSwiper"
                     type="checkbox" class="form-check-input"
                     [id]="id +'-show-cols'">
              <label class="form-check-label"
                     [for]="id +'-show-cols'">Show Swiper
              </label>
            </div>
          </div>
        </div>
      }
    `,
  imports: [FormsModule, DynamicContentMaxColumnsEditorComponent]
})

export class RowSettingsActionButtonsComponent implements OnInit {
  siteEditService = inject(SiteEditService);
  private numberUtils = inject(NumberUtilsService);
  actions = inject(PageContentActionsService);
  @Input()
  public row: PageContentRow;
  protected id: string;

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
  }

}
