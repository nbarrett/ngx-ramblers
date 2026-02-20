import { CommonModule } from "@angular/common";
import { keys } from "es-toolkit/compat";
import { Component, Input, TemplateRef, OnChanges, SimpleChanges, ViewChild, inject, AfterViewInit } from "@angular/core";
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
  ToggleSortFn,
  SocialRow
} from "../../../models/agm-stats.model";
import { UIDateFormat } from "../../../models/date-format.model";
import { LoggerFactory } from "../../../services/logger-factory.service";

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
            @if (socialChartData?.datasets?.length > 0) {
              <canvas baseChart
                [data]="socialChartData"
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
export class AGMSocialsTabComponent implements AfterViewInit, OnChanges {
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AGMSocialsTabComponent", NgxLoggerLevel.ERROR);
  protected readonly UIDateFormat = UIDateFormat;
  @Input() tabActive = false;
  @Input() dateRangeControls: TemplateRef<any>;
  @Input() years: string[] = [];
  @Input() socialSummaryRows: SummaryRow[] = [];
  @Input() socialSummaryKey = "socialSummary";
  @Input() fromDate: number;
  @Input() toDate: number;
  @Input() socialChartData: ChartConfiguration["data"];
  @Input() chartOptions: ChartConfiguration["options"];
  @Input() chartType: AgmChartType;
  @Input() aggregatedSocialEvents: SocialRow[] = [];
  @Input() organisers: Array<{ id: string; name: string; eventCount: number }> = [];
  @Input() sortedRowsFn: SortedRowsFn;
  @Input() toggleSortFn: ToggleSortFn;
  @Input() sortIconFn: SortIconFn;
  @Input() changeClassFn: ChangeClassFn;
  @Input() getYearLabelFn: GetYearLabelFn;
  @Input() socialLinkFn: (event: SocialRow) => string;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  ngAfterViewInit() {
    this.logger.info("ngAfterViewInit:", {
      aggregatedSocialEvents: this.aggregatedSocialEvents,
      organisers: this.organisers,
      fromDate: this.fromDate,
      toDate: this.toDate
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    this.logger.info("ngOnChanges - input changes detected:", {
      changedProperties: keys(changes),
      aggregatedSocialEvents: this.aggregatedSocialEvents,
      organisers: this.organisers,
      fromDate: this.fromDate,
      toDate: this.toDate,
      socialSummaryRows: this.socialSummaryRows,
      socialChartData: this.socialChartData
    });

    if ((changes["tabActive"] && this.tabActive) || changes["socialChartData"]) {
      setTimeout(() => this.chart?.update());
    }
  }
}
