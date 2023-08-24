import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";

@Component({
  selector: "app-action-buttons-settings",
  template: `
    <ng-container *ngIf="actions.isActionButtons(row)">
      <div class="row align-items-end">
        <div class="col">
          <label [for]="id +'max-cols'">Max Columns:</label>
          <input [id]="id +'max-cols'" [(ngModel)]="row.maxColumns"
                 autocomplete="columns"
                 class="form-control input-sm column-input" placeholder="Enter number of viewable columns (1-4)"
                 type="number">
        </div>
        <div class="col">
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
    </ng-container>
  `
})

export class ActionButtonsSettingsComponent implements OnInit {
  private logger: Logger;
  @Input()
  public row: PageContentRow;
  private id: string;

  constructor(loggerFactory: LoggerFactory,
              public siteEditService: SiteEditService,
              private numberUtils: NumberUtilsService,
              public actions: PageContentActionsService) {
    this.logger = loggerFactory.createLogger(ActionButtonsSettingsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
  }

}

