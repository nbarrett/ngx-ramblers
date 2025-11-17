import { CommonModule } from "@angular/common";
import { Component, Input, SimpleChanges, TemplateRef, ViewChild } from "@angular/core";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { AGMSummaryTableComponent, ChangeClassFn, GetYearLabelFn, SortedRowsFn, SortIconFn, SummaryRow, ToggleSortFn } from "./agm-summary-table";

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
            <canvas baseChart
              [data]="membershipChartData"
              [options]="chartOptions"
              [type]="chartType">
            </canvas>
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
export class AGMMembershipTabComponent {
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  @Input() tabActive = false;
  @Input() dateRangeControls: TemplateRef<any>;
  @Input() membershipChartData: ChartConfiguration["data"];
  @Input() chartOptions: ChartConfiguration["options"];
  @Input() chartType: "bar" | "line";
  @Input() years: number[] = [];
  @Input() membershipSummaryRows: SummaryRow[] = [];
  @Input() membershipSummaryKey = "membershipSummary";
  @Input() sortedRowsFn: SortedRowsFn;
  @Input() toggleSortFn: ToggleSortFn;
  @Input() sortIconFn: SortIconFn;
  @Input() changeClassFn: ChangeClassFn;
  @Input() getYearLabelFn: GetYearLabelFn;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  ngOnChanges(changes: SimpleChanges) {
    if ((changes["tabActive"] && this.tabActive) || changes["membershipChartData"] || changes["chartType"]) {
      setTimeout(() => this.chart?.update());
    }
  }
}
