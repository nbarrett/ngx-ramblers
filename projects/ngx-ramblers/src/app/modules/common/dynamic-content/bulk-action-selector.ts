import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { PageContentRowService } from "../../../services/page-content-row.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
  selector: "app-bulk-action-selector",
  template: `
    <div class="col mr-2">
      <div class="custom-control custom-checkbox">
        <input name="showSwiper" (click)="pageContentRowService.toggleSelection(row)"
               [checked]="pageContentRowService.isSelected(row)"
               type="checkbox" class="custom-control-input"
               [id]="id">
        <label class="custom-control-label"
               [for]="id">Select Row
        </label>
      </div>
    </div>
  `
})

export class BulkActionSelectorComponent implements OnInit {
  private logger: Logger;
  @Input()
  public row: PageContentRow;
  public id: string;

  constructor(loggerFactory: LoggerFactory,
              public pageContentRowService: PageContentRowService,
              private numberUtils: NumberUtilsService,
              public actions: PageContentActionsService) {
    this.logger = loggerFactory.createLogger(BulkActionSelectorComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
  }

}

