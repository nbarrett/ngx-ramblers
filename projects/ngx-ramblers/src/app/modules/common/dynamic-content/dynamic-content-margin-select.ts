import { Component, inject, Input, OnInit } from "@angular/core";
import { range } from "lodash-es";
import { NgxLoggerLevel } from "ngx-logger";
import { TitleLine } from "../../../models/banner-configuration.model";
import { Margin } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-margin-select,[app-margin-select]",
    template: `
    <label [for]="id">{{label}}</label>
    <select class="form-control input-sm"
      [id]="id"
      (ngModelChange)="changeMargin($event)"
      [(ngModel)]="data[field]">
      @for (margin of margins; track marginTracker($index, margin)) {
        <option
        [ngValue]="margin.value">{{margin.description}}</option>
      }
    </select>
    `,
    imports: [FormsModule]
})

export class MarginSelectComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("MarginSelectComponent", NgxLoggerLevel.ERROR);
  private numberUtils = inject(NumberUtilsService);
  actions = inject(PageContentActionsService);
  @Input()
  public label: TitleLine;
  public id: string;
  @Input()
  public data: object;
  @Input()
  public field: any;
  public margins: Margin[] = [];

  ngOnInit() {
    this.id = this.numberUtils.generateUid();
    this.margins = [{value: undefined, description: "none"}].concat(range(1, 6).map(value => ({value, description: value.toString()})));
    this.logger.debug("ngOnInit");
  }

  marginTracker = (index: number, margin: Margin) => {
    const returned = margin.value || undefined;
    this.logger.debug("marginTracker:index:", index, "margin:", margin, "returned:", returned);
    return returned;
  };

  marginComparer = (item1: Margin, item2: Margin): boolean => {
    const matched = (item1?.value === item2?.value) || ((item2?.value || 0) === (item1?.value || 0));
    this.logger.debug("marginComparer:item1:", item1, "item2:", item2, "matched:", matched);
    return matched;
  };

  changeMargin($event: any) {
    this.logger.debug("changeMargin:", $event, typeof $event);
  }

}

