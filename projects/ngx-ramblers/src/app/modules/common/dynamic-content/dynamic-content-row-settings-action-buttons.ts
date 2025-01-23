import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";

@Component({
  selector: "[app-row-settings-action-buttons]",
  template: `
      @if (actions.isActionButtons(row) || actions.isAlbumIndex(row)) {
        <div class="row align-items-end">
          <div class="col-auto">
            <label [for]="id +'max-cols'">Max Columns</label>
            <input [id]="id +'max-cols'" #input (input)="actions.changeMaxColumnsFor(input, row)"
              [value]="row.maxColumns"
              autocomplete="columns"
              class="form-control input-sm column-input" placeholder="Enter number of viewable columns (1-4)"
              type="number">
          </div>
          <div class="col-auto">
            <div class="custom-control custom-checkbox">
              <input name="showSwiper" [(ngModel)]="row.showSwiper"
                [checked]="row.showSwiper"
                type="checkbox" class="custom-control-input"
                [id]="id +'-show-cols'">
              <label class="custom-control-label"
                [for]="id +'-show-cols'">Show Swiper
              </label>
            </div>
          </div>
        </div>
      }
      `,
  standalone: false
})

export class RowSettingsActionButtonsComponent implements OnInit {
  private logger: Logger;
  @Input()
  public row: PageContentRow;
  protected id: string;

  constructor(loggerFactory: LoggerFactory,
              public siteEditService: SiteEditService,
              private numberUtils: NumberUtilsService,
              public actions: PageContentActionsService) {
    this.logger = loggerFactory.createLogger("RowSettingsActionButtonsComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
  }

}

