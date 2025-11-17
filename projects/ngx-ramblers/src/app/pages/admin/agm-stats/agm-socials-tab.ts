import { CommonModule } from "@angular/common";
import { Component, Input, TemplateRef, OnChanges, SimpleChanges, ViewChild } from "@angular/core";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { AGMSummaryTableComponent, ChangeClassFn, GetYearLabelFn, SortedRowsFn, SortIconFn, SummaryRow, ToggleSortFn } from "./agm-summary-table";
import { UIDateFormat } from "../../../models/date-format.model";

export interface SocialRow {
  date: number;
  description: string;
  organiserName?: string;
  id?: string;
  link?: string;
  groupEvent?: {
    url?: string;
    external_url?: string;
    title?: string;
    description?: string;
    item_type?: string;
    id?: string;
  };
}

@Component({
  selector: "[app-agm-socials-tab]",
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, BaseChartDirective, AGMSummaryTableComponent],
  styleUrls: ["./agm-stats.sass"],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <ng-container *ngTemplateOutlet="dateRangeControls"></ng-container>
      <div class="row mb-4">
        <div class="col-12">
          <h3>Social Activity Analysis</h3>
          <div class="chart-container">
            <canvas baseChart
              [data]="socialChartData"
              [options]="chartOptions"
              [type]="chartType">
            </canvas>
          </div>
        </div>
      </div>

      <div class="row mb-4">
        <div class="col-12">
          <h3>Social Statistics Summary</h3>
          <div class="table-responsive">
            <div app-agm-summary-table
              [years]="years"
              [rows]="socialSummaryRows"
              [summaryKey]="socialSummaryKey"
              [sortedRowsFn]="sortedRowsFn"
              [toggleSortFn]="toggleSortFn"
              [sortIconFn]="sortIconFn"
              [changeClassFn]="changeClassFn"
              [getYearLabelFn]="getYearLabelFn">
            </div>
          </div>
        </div>
      </div>

      <div class="row mb-4">
        <div class="col-12">
          <h3>Social Events ({{ fromDate | date: UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED }} - {{ toDate | date: UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED }})</h3>
          <div class="table-responsive">
            <table class="table table-striped table-bordered">
              <thead class="table-dark">
                <tr>
                  <th class="sortable" (click)="toggleSortFn('socialEvents', 'date')">
                    Date
                    @if (sortIconFn('socialEvents', 'date')) {
                      <fa-icon [icon]="sortIconFn('socialEvents', 'date')" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable" (click)="toggleSortFn('socialEvents', 'description')">
                    Description
                    @if (sortIconFn('socialEvents', 'description')) {
                      <fa-icon [icon]="sortIconFn('socialEvents', 'description')" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable" (click)="toggleSortFn('socialEvents', 'organiserName')">
                    Organiser
                    @if (sortIconFn('socialEvents', 'organiserName')) {
                      <fa-icon [icon]="sortIconFn('socialEvents', 'organiserName')" class="ms-1" size="xs"/>
                    }
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (social of sortedRowsFn(aggregatedSocialEvents, 'socialEvents'); track social.date) {
                  <tr>
                    <td>{{ social.date | date: UIDateFormat.DAY_MONTH_YEAR_WITH_SLASHES }}</td>
                    <td>
                      <a [href]="socialLinkFn(social)" target="_blank" rel="noreferrer">
                        {{ social.description }}
                      </a>
                    </td>
                    <td>{{ social.organiserName || "Unknown" }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" class="text-center">No social events found</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="row mb-4">
        <div class="col-12">
          <h3>Social Organisers</h3>
          <div class="table-responsive">
            <table class="table table-striped table-bordered">
              <thead class="table-dark">
                <tr>
                  <th class="sortable" (click)="toggleSortFn('organisers', 'name')">
                    Organiser
                    @if (sortIconFn('organisers', 'name')) {
                      <fa-icon [icon]="sortIconFn('organisers', 'name')" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable" (click)="toggleSortFn('organisers', 'eventCount')">
                    Events Organised
                    @if (sortIconFn('organisers', 'eventCount')) {
                      <fa-icon [icon]="sortIconFn('organisers', 'eventCount')" class="ms-1" size="xs"/>
                    }
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (organiser of sortedRowsFn(organisers, 'organisers'); track organiser.id) {
                  <tr>
                    <td>{{ organiser.name }}</td>
                    <td>{{ organiser.eventCount }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="2" class="text-center">No social organisers found</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AGMSocialsTabComponent implements OnChanges {
  @Input() tabActive = false;
  protected readonly UIDateFormat = UIDateFormat;
  @Input() dateRangeControls: TemplateRef<any>;
  @Input() years: number[] = [];
  @Input() socialSummaryRows: SummaryRow[] = [];
  @Input() socialSummaryKey = "socialSummary";
  @Input() fromDate: number;
  @Input() toDate: number;
  @Input() socialChartData: ChartConfiguration["data"];
  @Input() chartOptions: ChartConfiguration["options"];
  @Input() chartType: "bar" | "line";
  @Input() aggregatedSocialEvents: SocialRow[] = [];
  @Input() organisers: Array<{ id: string; name: string; eventCount: number }> = [];
  @Input() sortedRowsFn: SortedRowsFn;
  @Input() toggleSortFn: ToggleSortFn;
  @Input() sortIconFn: SortIconFn;
  @Input() changeClassFn: ChangeClassFn;
  @Input() getYearLabelFn: GetYearLabelFn;
  @Input() socialLinkFn: (event: SocialRow) => string;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  ngOnChanges(changes: SimpleChanges) {
    if ((changes["tabActive"] && this.tabActive) || changes["socialChartData"]) {
      setTimeout(() => this.chart?.update());
    }
  }
}
