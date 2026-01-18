import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { PageContentRow } from "../../../models/content-text.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { FormsModule } from "@angular/forms";
import { DynamicContentMaxColumnsEditorComponent } from "./dynamic-content-max-columns-editor";

@Component({
    selector: "[app-row-settings-action-buttons]",
    template: `
      @if (actions.isActionButtons(row) || actions.isIndex(row)) {
        <div class="row align-items-center">
          <div class="col-auto" app-dynamic-content-max-columns-editor [hasColumnRange]="row" (columnsChange)="columnsChange.emit()"></div>
          @if (actions.isActionButtons(row) || actions.isIndex(row)) {
            <div class="col-auto">
              <div class="form-check form-check-inline mb-0">
                <input name="showSwiper" [(ngModel)]="row.showSwiper"
                       [checked]="row.showSwiper"
                       type="checkbox" class="form-check-input"
                       [id]="id +'-show-cols'">
                <label class="form-check-label"
                       [for]="id +'-show-cols'">Show Swiper
                </label>
              </div>
            </div>
          }
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
  @Output() columnsChange = new EventEmitter<void>();
  protected id: string;

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
  }

}
