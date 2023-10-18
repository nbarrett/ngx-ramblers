import { Component, Input, OnInit } from "@angular/core";
import { range } from "lodash-es";
import { NgxLoggerLevel } from "ngx-logger";
import { TitleLine } from "../../../models/banner-configuration.model";
import { Margin } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

@Component({
  selector: "[app-margin-select]",
  template: `
    <label [for]="id">{{label}}</label>
    <select class="form-control input-sm"
            [id]="id"
            (ngModelChange)="changeMargin($event)"
            [(ngModel)]="data[field]">
      <option *ngFor="let margin of margins; trackBy: marginTracker"
              [ngValue]="margin.value">{{margin.description}}</option>
    </select>
  `
})

export class MarginSelectComponent implements OnInit {
  private logger: Logger;
  @Input()
  public label: TitleLine;
  public id: string;
  @Input()
  public data: object;
  @Input()
  public field: any;

  public margins: Margin[] = [];

  constructor(loggerFactory: LoggerFactory,
              private numberUtils: NumberUtilsService,
              public actions: PageContentActionsService) {
    this.logger = loggerFactory.createLogger(MarginSelectComponent, NgxLoggerLevel.OFF);
  }

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

