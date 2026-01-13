import { CommonModule } from "@angular/common";
import { Component, Input, SimpleChanges, TemplateRef, ViewChildren, inject, OnChanges, AfterViewInit, QueryList } from "@angular/core";
import { BaseChartDirective } from "ng2-charts";
import { ChartConfiguration } from "chart.js";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
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
  RankedLeaderRow
} from "../../../models/agm-stats.model";
import { LeaderStats, WalkListItem } from "../../../models/group-event.model";
import { UIDateFormat } from "../../../models/date-format.model";
import { LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "[app-agm-walks-tab]",
  standalone: true,
  imports: [CommonModule, BaseChartDirective, FontAwesomeModule, AGMSummaryTableComponent],
  styleUrls: ["./agm-stats.sass"],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <ng-container *ngTemplateOutlet="dateRangeControls"/>
      <div class="row mb-4">
        <div class="col-12">
          <h3>Walk Activity Analysis</h3>
          <div class="chart-container">
            @if (walkChartData?.datasets?.length > 0) {
              <canvas baseChart
                      [data]="walkChartData"
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
          <h4 class="mt-4">Active Walk Leaders Per Year</h4>
          <div class="chart-container">
            @if (leaderChartData?.datasets?.length > 0) {
              <canvas baseChart
                      [data]="leaderChartData"
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
          <h3>Walk Statistics Summary</h3>
          <div class="table-responsive">
            <div app-agm-summary-table
                 [years]="years"
                 [rows]="walkSummaryRows"
                 [summaryKey]="walkSummaryKey"
                 [sortedRowsFn]="sortedRowsFn"
                 [toggleSortFn]="toggleSortFn"
                 [sortIconFn]="sortIconFn"
                 [changeClassFn]="changeClassFn"
                 [getYearLabelFn]="getYearLabelFn">
            </div>
          </div>
        </div>
      </div>
      @if (unfilledSlotsList.length > 0) {
        <div class="row mb-4">
          <div class="col-12">
            <h4 class="pointer" (click)="showUnfilled = !showUnfilled">
              <fa-icon [icon]="showUnfilled ? faChevronUp : faChevronDown" class="me-2"/>
              Walk Slots Not Filled ({{ unfilledSlotsList.length }})
            </h4>
            @if (showUnfilled) {
              <div class="table-responsive">
                <table class="table table-sm table-striped table-bordered">
                  <thead class="table-dark">
                  <tr>
                    <th class="sortable" (click)="toggleSortFn('unfilledSlots', 'startDate')">
                      Date
                      @if (sortIconFn('unfilledSlots', 'startDate')) {
                        <fa-icon [icon]="sortIconFn('unfilledSlots', 'startDate')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('unfilledSlots', 'title')">
                      Title
                      @if (sortIconFn('unfilledSlots', 'title')) {
                        <fa-icon [icon]="sortIconFn('unfilledSlots', 'title')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('unfilledSlots', 'distance')">
                      Distance (miles)
                      @if (sortIconFn('unfilledSlots', 'distance')) {
                        <fa-icon [icon]="sortIconFn('unfilledSlots', 'distance')" class="ms-1" size="xs"/>
                      }
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                    @for (walk of sortedRowsFn(unfilledSlotsList, 'unfilledSlots'); track walk.id) {
                      <tr>
                        <td>{{ walk.startDate | date: UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED }}</td>
                        <td>
                          <a [href]="walk.url" target="_blank" rel="noreferrer">
                            {{ walk.title || 'Untitled' }}
                          </a>
                        </td>
                        <td>{{ walk.distance || '-' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
      @if (morningWalksList.length > 0) {
        <div class="row mb-4">
          <div class="col-12">
            <h4 class="pointer" (click)="showConfirmed = !showConfirmed">
              <fa-icon [icon]="showConfirmed ? faChevronUp : faChevronDown" class="me-2"/>
              Morning Walks ({{ morningWalksList.length }})
            </h4>
            @if (showConfirmed) {
              <div class="table-responsive">
                <table class="table table-sm table-striped table-bordered">
                  <thead class="table-dark">
                  <tr>
                    <th class="sortable" (click)="toggleSortFn('confirmedWalks', 'startDate')">
                      Date
                      @if (sortIconFn('confirmedWalks', 'startDate')) {
                        <fa-icon [icon]="sortIconFn('confirmedWalks', 'startDate')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('confirmedWalks', 'title')">
                      Title
                      @if (sortIconFn('confirmedWalks', 'title')) {
                        <fa-icon [icon]="sortIconFn('confirmedWalks', 'title')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('confirmedWalks', 'walkLeader')">
                      Leader
                      @if (sortIconFn('confirmedWalks', 'walkLeader')) {
                        <fa-icon [icon]="sortIconFn('confirmedWalks', 'walkLeader')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('confirmedWalks', 'distance')">
                      Distance (miles)
                      @if (sortIconFn('confirmedWalks', 'distance')) {
                        <fa-icon [icon]="sortIconFn('confirmedWalks', 'distance')" class="ms-1" size="xs"/>
                      }
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                    @for (walk of sortedRowsFn(morningWalksList, 'confirmedWalks'); track walk.id) {
                      <tr>
                        <td>{{ walk.startDate | date: UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED }}</td>
                        <td>
                          <a [href]="walk.url" target="_blank" rel="noreferrer">
                            {{ walk.title || 'Untitled' }}
                          </a>
                        </td>
                        <td>{{ walk.walkLeader || '-' }}</td>
                        <td>{{ walk.distance || '-' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
      @if (cancelledWalksList.length > 0) {
        <div class="row mb-4">
          <div class="col-12">
            <h4 class="pointer" (click)="showCancelled = !showCancelled">
              <fa-icon [icon]="showCancelled ? faChevronUp : faChevronDown" class="me-2"/>
              Cancelled Walks ({{ cancelledWalksList.length }})
            </h4>
            @if (showCancelled) {
              <div class="table-responsive">
                <table class="table table-sm table-striped table-bordered">
                  <thead class="table-dark">
                  <tr>
                    <th class="sortable" (click)="toggleSortFn('cancelledWalks', 'startDate')">
                      Date
                      @if (sortIconFn('cancelledWalks', 'startDate')) {
                        <fa-icon [icon]="sortIconFn('cancelledWalks', 'startDate')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('cancelledWalks', 'title')">
                      Title
                      @if (sortIconFn('cancelledWalks', 'title')) {
                        <fa-icon [icon]="sortIconFn('cancelledWalks', 'title')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('cancelledWalks', 'walkLeader')">
                      Leader
                      @if (sortIconFn('cancelledWalks', 'walkLeader')) {
                        <fa-icon [icon]="sortIconFn('cancelledWalks', 'walkLeader')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('cancelledWalks', 'distance')">
                      Distance (miles)
                      @if (sortIconFn('cancelledWalks', 'distance')) {
                        <fa-icon [icon]="sortIconFn('cancelledWalks', 'distance')" class="ms-1" size="xs"/>
                      }
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                    @for (walk of sortedRowsFn(cancelledWalksList, 'cancelledWalks'); track walk.id) {
                      <tr>
                        <td>{{ walk.startDate | date: UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED }}</td>
                        <td>
                          @if (walk.url) {
                            <a [href]="walk.url" target="_blank" rel="noreferrer">{{ walk.title }}</a>
                          } @else {
                            {{ walk.title }}
                          }
                        </td>
                        <td>{{ walk.walkLeader || 'None' }}</td>
                        <td>{{ walk.distance }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
      @if (eveningWalksList.length > 0) {
        <div class="row mb-4">
          <div class="col-12">
            <h4 class="pointer" (click)="showEvening = !showEvening">
              <fa-icon [icon]="showEvening ? faChevronUp : faChevronDown" class="me-2"/>
              Evening Walks ({{ eveningWalksList.length }})
            </h4>
            @if (showEvening) {
              <div class="table-responsive">
                <table class="table table-sm table-striped table-bordered">
                  <thead class="table-dark">
                  <tr>
                    <th class="sortable" (click)="toggleSortFn('eveningWalks', 'startDate')">
                      Date
                      @if (sortIconFn('eveningWalks', 'startDate')) {
                        <fa-icon [icon]="sortIconFn('eveningWalks', 'startDate')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('eveningWalks', 'title')">
                      Title
                      @if (sortIconFn('eveningWalks', 'title')) {
                        <fa-icon [icon]="sortIconFn('eveningWalks', 'title')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('eveningWalks', 'walkLeader')">
                      Leader
                      @if (sortIconFn('eveningWalks', 'walkLeader')) {
                        <fa-icon [icon]="sortIconFn('eveningWalks', 'walkLeader')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('eveningWalks', 'distance')">
                      Distance (miles)
                      @if (sortIconFn('eveningWalks', 'distance')) {
                        <fa-icon [icon]="sortIconFn('eveningWalks', 'distance')" class="ms-1" size="xs"/>
                      }
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                    @for (walk of sortedRowsFn(eveningWalksList, 'eveningWalks'); track walk.id) {
                      <tr>
                        <td>{{ walk.startDate | date: UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED }}</td>
                        <td>
                          @if (walk.url) {
                            <a [href]="walk.url" target="_blank" rel="noreferrer">{{ walk.title }}</a>
                          } @else {
                            {{ walk.title }}
                          }
                        </td>
                        <td>{{ walk.walkLeader }}</td>
                        <td>{{ walk.distance }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
      @if (newLeadersList.length > 0) {
        <div class="row mb-4">
          <div class="col-12">
            <h3>New Walk Leaders (Current Year)</h3>
            <div class="table-responsive">
              <table class="table table-striped table-bordered">
                <thead class="table-dark">
                <tr>
                  <th class="sortable" (click)="toggleSortFn('newLeaders', 'name')">
                    Leader
                    @if (sortIconFn('newLeaders', 'name')) {
                      <fa-icon [icon]="sortIconFn('newLeaders', 'name')" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable" (click)="toggleSortFn('newLeaders', 'walkCount')">
                    Walks Led
                    @if (sortIconFn('newLeaders', 'walkCount')) {
                      <fa-icon [icon]="sortIconFn('newLeaders', 'walkCount')" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable" (click)="toggleSortFn('newLeaders', 'totalMiles')">
                    Miles Led
                    @if (sortIconFn('newLeaders', 'totalMiles')) {
                      <fa-icon [icon]="sortIconFn('newLeaders', 'totalMiles')" class="ms-1" size="xs"/>
                    }
                  </th>
                </tr>
                </thead>
                <tbody>
                  @for (leader of sortedRowsFn(newLeadersList, 'newLeaders'); track leader.id || leader.name) {
                    <tr>
                      <td>{{ leader.name }}</td>
                      <td>{{ leader.walkCount }}</td>
                      <td>{{ leader.totalMiles }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="text-center">No new leaders</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }
      <div class="row mb-4">
        <div class="col-12">
          <h3>Top Walk Leaders (Current Year)</h3>
          <div class="table-responsive">
            <table class="table table-striped table-bordered">
              <thead class="table-dark">
              <tr>
                <th class="sortable" (click)="toggleSortFn('leaders', 'rank')">
                  Rank
                  @if (sortIconFn('leaders', 'rank')) {
                    <fa-icon [icon]="sortIconFn('leaders', 'rank')" class="ms-1" size="xs"/>
                  }
                </th>
                <th class="sortable" (click)="toggleSortFn('leaders', 'name')">
                  Leader
                  @if (sortIconFn('leaders', 'name')) {
                    <fa-icon [icon]="sortIconFn('leaders', 'name')" class="ms-1" size="xs"/>
                  }
                </th>
                <th class="sortable" (click)="toggleSortFn('leaders', 'walkCount')">
                  Walks Led
                  @if (sortIconFn('leaders', 'walkCount')) {
                    <fa-icon [icon]="sortIconFn('leaders', 'walkCount')" class="ms-1" size="xs"/>
                  }
                </th>
                <th class="sortable" (click)="toggleSortFn('leaders', 'totalMiles')">
                  Miles Led
                  @if (sortIconFn('leaders', 'totalMiles')) {
                    <fa-icon [icon]="sortIconFn('leaders', 'totalMiles')" class="ms-1" size="xs"/>
                  }
                </th>
              </tr>
              </thead>
              <tbody>
                @for (leader of sortedRowsFn(currentLeaders, 'leaders'); track leader.id || leader.name) {
                  <tr>
                    <td>{{ leader.rank }}</td>
                    <td>{{ leader.name }}</td>
                    <td>{{ leader.walkCount }}</td>
                    <td>{{ leader.totalMiles }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="text-center">No leaders found</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="row mb-4">
        <div class="col-12">
          <h3>Aggregate Walk Leaders ({{ aggregateYearsLabel }})</h3>
          <div class="table-responsive">
            <table class="table table-striped table-bordered">
              <thead class="table-dark">
              <tr>
                <th class="sortable" (click)="toggleSortFn('aggregateLeaders', 'rank')">
                  Rank
                  @if (sortIconFn('aggregateLeaders', 'rank')) {
                    <fa-icon [icon]="sortIconFn('aggregateLeaders', 'rank')" class="ms-1" size="xs"/>
                  }
                </th>
                <th class="sortable" (click)="toggleSortFn('aggregateLeaders', 'name')">
                  Leader
                  @if (sortIconFn('aggregateLeaders', 'name')) {
                    <fa-icon [icon]="sortIconFn('aggregateLeaders', 'name')" class="ms-1" size="xs"/>
                  }
                </th>
                <th class="sortable" (click)="toggleSortFn('aggregateLeaders', 'walkCount')">
                  Walks Led
                  @if (sortIconFn('aggregateLeaders', 'walkCount')) {
                    <fa-icon [icon]="sortIconFn('aggregateLeaders', 'walkCount')" class="ms-1" size="xs"/>
                  }
                </th>
                <th class="sortable" (click)="toggleSortFn('aggregateLeaders', 'totalMiles')">
                  Miles Led
                  @if (sortIconFn('aggregateLeaders', 'totalMiles')) {
                    <fa-icon [icon]="sortIconFn('aggregateLeaders', 'totalMiles')" class="ms-1" size="xs"/>
                  }
                </th>
              </tr>
              </thead>
              <tbody>
                @for (leader of sortedRowsFn(aggregateLeaders, 'aggregateLeaders'); track leader.id || leader.name) {
                  <tr>
                    <td>{{ leader.rank }}</td>
                    <td>{{ leader.name }}</td>
                    <td>{{ leader.walkCount }}</td>
                    <td>{{ leader.totalMiles }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="text-center">No aggregate leaders found</td>
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
export class AGMWalksTabComponent implements AfterViewInit, OnChanges {
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AGMWalksTabComponent", NgxLoggerLevel.ERROR);
  protected readonly UIDateFormat = UIDateFormat;
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  @Input() tabActive = false;
  @Input() dateRangeControls: TemplateRef<any>;
  @Input() walkChartData: ChartConfiguration["data"];
  @Input() leaderChartData: ChartConfiguration["data"];
  @Input() chartOptions: ChartConfiguration["options"];
  @Input() chartType: AgmChartType;
  @Input() years: string[] = [];
  @Input() walkSummaryRows: SummaryRow[] = [];
  @Input() walkSummaryKey = "walkSummary";
  @Input() currentLeaders: Array<{ id?: string; rank?: number; name: string; email?: string; walkCount: number; totalMiles: number }> = [];
  @Input() newLeadersList: LeaderStats[] = [];
  @Input() aggregateLeaders: Array<{ id?: string; rank?: number; name: string; email?: string; walkCount: number; totalMiles: number }> = [];
  @Input() aggregateYearsLabel = "All Years";
  @Input() cancelledWalksList: WalkListItem[] = [];
  @Input() eveningWalksList: WalkListItem[] = [];
  @Input() unfilledSlotsList: WalkListItem[] = [];
  @Input() morningWalksList: WalkListItem[] = [];
  @Input() sortedRowsFn: SortedRowsFn;
  @Input() toggleSortFn: ToggleSortFn;
  @Input() sortIconFn: SortIconFn;
  @Input() changeClassFn: ChangeClassFn;
  @Input() getYearLabelFn: GetYearLabelFn;
  @ViewChildren(BaseChartDirective) charts?: QueryList<BaseChartDirective>;
  showCancelled = false;
  showEvening = false;
  showUnfilled = false;
  showConfirmed = false;

  ngAfterViewInit() {
    this.logger.info("ngAfterViewInit:", {
      currentLeaders: this.currentLeaders,
      newLeadersList: this.newLeadersList,
      aggregateLeaders: this.aggregateLeaders,
      cancelledWalksList: this.cancelledWalksList,
      eveningWalksList: this.eveningWalksList,
      unfilledSlotsList: this.unfilledSlotsList
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes["tabActive"] && this.tabActive) || changes["walkChartData"] || changes["leaderChartData"] || changes["chartType"]) {
      setTimeout(() => this.charts?.forEach(chart => chart.update()));
    }
  }
}
