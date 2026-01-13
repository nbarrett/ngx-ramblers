import { CommonModule } from "@angular/common";
import { Component, Input, SimpleChanges, TemplateRef, ViewChild, inject, OnChanges, AfterViewInit } from "@angular/core";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgxLoggerLevel } from "ngx-logger";
import { AGMSummaryTableComponent } from "./agm-summary-table";
import {
  AgmChartType,
  ChangeClassFn,
  GetYearLabelFn,
  SortedRowsFn,
  SortIconFn,
  SummaryRow,
  ToggleSortFn
} from "../../../models/agm-stats.model";
import { LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "[app-agm-membership-tab]",
  standalone: true,
  imports: [CommonModule, BaseChartDirective, FontAwesomeModule, AGMSummaryTableComponent],
  styleUrls: ["./agm-stats.sass"],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <ng-container *ngTemplateOutlet="dateRangeControls"></ng-container>
      <div class="row mb-4">
        <div class="col-12">
          <h3>Membership Activity Analysis</h3>
          <div class="chart-container">
            @if (membershipChartData?.datasets?.length > 0) {
              <canvas baseChart
                      [data]="membershipChartData"
                      [options]="chartOptions"
                      [type]="chartType">
              </canvas>
            } @else {
              <div class="d-flex justify-content-center align-items-center" style="min-height: 300px;">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading chart...</span>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="row mb-4">
        <div class="col-12">
          <h3>Membership Statistics Summary</h3>
          <div class="table-responsive">
            <div app-agm-summary-table
                 [years]="years"
                 [rows]="membershipSummaryRows"
                 [summaryKey]="membershipSummaryKey"
                 [sortedRowsFn]="sortedRowsFn"
                 [toggleSortFn]="toggleSortFn"
                 [sortIconFn]="sortIconFn"
                 [changeClassFn]="changeClassFn"
                 [getYearLabelFn]="getYearLabelFn">
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AGMMembershipTabComponent implements AfterViewInit, OnChanges {
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AGMMembershipTabComponent", NgxLoggerLevel.ERROR);
  @Input() tabActive = false;
  @Input() dateRangeControls: TemplateRef<any>;
  @Input() membershipChartData: ChartConfiguration["data"];
  @Input() chartOptions: ChartConfiguration["options"];
  @Input() chartType: AgmChartType;
  @Input() years: string[] = [];
  @Input() membershipSummaryRows: SummaryRow[] = [];
  @Input() membershipSummaryKey = "membershipSummary";
  @Input() sortedRowsFn: SortedRowsFn;
  @Input() toggleSortFn: ToggleSortFn;
  @Input() sortIconFn: SortIconFn;
  @Input() changeClassFn: ChangeClassFn;
  @Input() getYearLabelFn: GetYearLabelFn;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  ngAfterViewInit() {
    this.logger.info("ngAfterViewInit:", {
      membershipSummaryRows: this.membershipSummaryRows,
      membershipChartData: this.membershipChartData
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes["tabActive"] && this.tabActive) || changes["membershipChartData"] || changes["chartType"]) {
      setTimeout(() => this.chart?.update());
    }
  }
}
