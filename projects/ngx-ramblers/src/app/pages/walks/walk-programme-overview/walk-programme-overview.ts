import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronLeft, faChevronRight, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { DateTime } from "luxon";
import { WalkProgrammePageComponent } from "../walk-programme-view-selector/walk-programme-page";
import { DateRangeDirectionSelector } from "../../../components/date-range-selector/date-range-direction-selector";
import { DateRange } from "../../../components/date-range-slider/date-range-slider";
import { DateRangeSelector } from "../../../components/date-range-selector/date-range-selector";
import { DateValue } from "../../../models/date.model";
import { StoredValue } from "../../../models/ui-actions";
import { DATE_RANGE_DIRECTION_TABS, DateRangeDirection, defaultProgrammeRange } from "../../../models/search.model";
import {
  ProgrammeOverviewStatus,
  ProgrammeSortDirection,
  ProgrammeStatusDescriptor,
  PROGRAMME_STATUS_DESCRIPTORS,
  programmeStatusDescriptor,
  programmeStatusDescriptorsFor,
  WalkProgrammeSummaryPagination,
  WalkProgrammeSummaryResponse,
  WalkProgrammeSummaryRow
} from "../../../models/walk-programme.model";
import { WalkProgrammeService } from "../../../services/walks-and-events/walk-programme.service";
import { ScrollPositionService } from "../../../services/scroll-position.service";
import { WalkDisplayService } from "../walk-display.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkProgrammeRowComponent } from "../walk-programme-row/walk-programme-row";

@Component({
  selector: "app-walk-programme-overview",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [WalkProgrammePageComponent, DateRangeSelector, FontAwesomeModule, DateRangeDirectionSelector, WalkProgrammeRowComponent],
  styleUrls: ["./walk-programme-overview.sass"],
  template: `
    <app-walk-programme-page sticky>
      <app-date-range-direction-selector programmeChrome [minDate]="minDate" [maxDate]="maxDate"
                                         [direction]="dateRangeDirection"
                                         (directionChange)="onDirectionChange($event)"/>
      <div programmeSticky class="programme-sticky-slot">
        <div class="programme-toolbar sticky-collapsible">
          <app-date-range-selector class="range-controls" [minDate]="minDate" [maxDate]="maxDate"
                                   [direction]="dateRangeDirection" [range]="range"
                                   (rangeChange)="onRangeChange($event)"/>
        </div>

        <div class="stat-grid">
          @for (descriptor of visibleDescriptors(); track descriptor.status) {
            <button type="button" class="stat-card" [class.active]="status === descriptor.status"
                    [style.--stat-colour]="descriptor.colour" (click)="selectStatus(descriptor.status)">
              <span class="stat-count">{{ countFor(descriptor.status) }}</span>
              <span class="stat-label">{{ descriptor.title }}</span>
            </button>
          }
        </div>
      </div>
      <div class="programme">

        @if (status) {
          <div class="filter-chip">
            <span class="chip" [style.background-color]="activeDescriptor()?.colour"
                  [style.color]="activeDescriptor()?.textColour">{{ activeDescriptor()?.title }}</span>
            <span class="chip-count">{{ pagination.total }} {{ stringUtils.pluralise(pagination.total, "walk", "walks") }}</span>
            <button type="button" class="btn btn-sm btn-quiet clear-filter" (click)="clearStatus()">
              <fa-icon [icon]="faXmark"/>
              <span class="ms-1">Clear filter</span>
            </button>
          </div>
        }

        @if (loading && rows.length === 0) {
          <div class="programme-empty">Loading walks…</div>
        } @else if (!loading && rows.length === 0) {
          <div class="alert alert-warning d-flex align-items-start" role="alert">
            <fa-icon [icon]="faTriangleExclamation" class="me-2 mt-1"/>
            <div>
              <strong class="d-block">No walks in this view</strong>
              Nothing matches the selected date range{{ status ? " and status" : "" }}. Try widening the range or clearing
              the filter.
            </div>
          </div>
        } @else {
          <div class="walk-rows">
            @for (row of rows; track row.id) {
              <app-walk-programme-row [row]="row"
                                      [allowEdit]="allowEdit()"
                                      [showGroup]="showGroup()"
                                      [reserveThumbnail]="anyThumbnails()"/>
            }
          </div>

          @if (pagination.totalPages > 1) {
            <div class="programme-pagination">
              <button type="button" class="btn btn-sm btn-quiet" [disabled]="pagination.page <= 1"
                      (click)="goToPage(pagination.page - 1)">
                <fa-icon [icon]="faChevronLeft"/>
              </button>
              <span class="page-indicator">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
              <button type="button" class="btn btn-sm btn-quiet" [disabled]="pagination.page >= pagination.totalPages"
                      (click)="goToPage(pagination.page + 1)">
                <fa-icon [icon]="faChevronRight"/>
              </button>
            </div>
          }
        }
      </div>
    </app-walk-programme-page>
  `
})
export class WalkProgrammeOverviewComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkProgrammeOverviewComponent", NgxLoggerLevel.ERROR);
  private walkProgrammeService = inject(WalkProgrammeService);
  private scrollPosition = inject(ScrollPositionService);
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private memberLoginService = inject(MemberLoginService);
  private systemConfigService = inject(SystemConfigService);
  private walksConfigService = inject(WalksConfigService);
  protected stringUtils = inject(StringUtilsService);
  private route = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];

  protected dateFrom: DateValue;
  protected dateTo: DateValue;
  protected minDate: DateTime;
  protected maxDate: DateTime;
  protected range: DateRange;
  protected dateRangeDirection: DateRangeDirection = DateRangeDirection.FUTURE;
  protected status: ProgrammeOverviewStatus | null = null;
  protected page = 1;
  protected readonly limit = 12;
  protected loading = true;
  protected rows: WalkProgrammeSummaryRow[] = [];
  protected counts: WalkProgrammeSummaryResponse["counts"] = {};
  protected pagination: WalkProgrammeSummaryPagination = {total: 0, page: 1, limit: this.limit, totalPages: 1};

  protected readonly faXmark = faXmark;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;

  ngOnInit() {
    this.applyDateBounds();
    this.subscriptions.push(this.systemConfigService.events().subscribe(() => this.loadFromUrl()));
    this.subscriptions.push(this.walksConfigService.events().subscribe(() => this.loadFromUrl()));
    this.subscriptions.push(this.route.queryParamMap.subscribe(() => this.loadFromUrl()));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private defaultWeeks(): number {
    const configured = this.walksConfigService.walksConfig()?.programmeOverviewDefaultWeeks;
    return configured && configured > 0 ? configured : 12;
  }

  private async applyDateBounds() {
    const bounds = await this.walkProgrammeService.dateBounds();
    this.minDate = bounds.minDate;
    this.maxDate = bounds.maxDate;
    this.applyDefaultRangeIfUnset();
  }

  private applyDefaultRangeIfUnset() {
    const datesInUrl = this.uiActions.queryParameter(StoredValue.DATE_FROM) || this.uiActions.queryParameter(StoredValue.DATE_TO);
    if (datesInUrl) {
      this.logger.debug("applyDefaultRangeIfUnset: dates already set in the web address");
    } else {
      this.onRangeChange(defaultProgrammeRange(this.maxDate, this.dateUtils.dateTimeNowNoTime()));
    }
  }

  private loadFromUrl() {
    const fromParam = this.uiActions.queryParameter(StoredValue.DATE_FROM);
    const toParam = this.uiActions.queryParameter(StoredValue.DATE_TO);
    const statusParam = this.uiActions.queryParameter(StoredValue.STATUS);
    const pageParam = this.uiActions.queryParameter(StoredValue.PAGE);
    const directionParam = this.uiActions.queryParameter(StoredValue.DATE_RANGE_DIRECTION);
    const startOfToday = this.dateUtils.dateTimeNowNoTime();
    const fromMillis = fromParam ? this.dateUtils.asValueNoTime(fromParam) : startOfToday.valueOf();
    const toMillis = toParam ? this.dateUtils.asValueNoTime(toParam) : startOfToday.plus({weeks: this.defaultWeeks()}).valueOf();
    this.dateFrom = this.dateUtils.asDateValue(fromMillis);
    this.dateTo = this.dateUtils.asDateValue(toMillis);
    this.range = {from: fromMillis, to: toMillis};
    this.dateRangeDirection = DATE_RANGE_DIRECTION_TABS.find(tab => tab.value === directionParam)?.value || DateRangeDirection.FUTURE;
    this.status = this.validStatus(statusParam);
    this.page = pageParam ? Math.max(1, Number(pageParam)) : 1;
    this.load();
  }

  private validStatus(statusParam: string | null): ProgrammeOverviewStatus | null {
    const match = PROGRAMME_STATUS_DESCRIPTORS.find(descriptor => descriptor.status === statusParam);
    return match ? match.status : null;
  }

  private async load() {
    this.loading = true;
    try {
      const response = await this.walkProgrammeService.programmeSummary({
        dateFrom: this.dateFrom.value,
        dateTo: this.dateUtils.asDateTime(this.dateTo.value).endOf("day").valueOf(),
        status: this.status || undefined,
        page: this.page,
        limit: this.limit,
        sortDirection: ProgrammeSortDirection.ASC
      });
      this.counts = response.counts;
      this.rows = response.response;
      this.pagination = response.pagination;
      this.logger.info("load:counts", this.counts, "rows", this.rows.length);
    } catch (error) {
      this.logger.error("load:error", error);
      this.rows = [];
      this.counts = {};
      this.pagination = {total: 0, page: 1, limit: this.limit, totalPages: 1};
    } finally {
      this.loading = false;
      this.scrollPosition.restore();
    }
  }

  visibleDescriptors(): ProgrammeStatusDescriptor[] {
    return programmeStatusDescriptorsFor(this.display.walkPopulationWalksManager());
  }

  countFor(status: ProgrammeOverviewStatus): number {
    return this.counts[status] || 0;
  }

  anyThumbnails(): boolean {
    return this.rows.some(row => !!row.thumbnailUrl);
  }

  showGroup(): boolean {
    const config = this.systemConfigService.systemConfig();
    const areaGroupCount = config?.area?.groups?.length || 0;
    return areaGroupCount > 1;
  }

  activeDescriptor(): ProgrammeStatusDescriptor | null {
    return this.status ? programmeStatusDescriptor(this.status) : null;
  }

  selectStatus(status: ProgrammeOverviewStatus) {
    const nextStatus = this.status === status ? null : status;
    this.uiActions.updateQueryParameters({
      [StoredValue.STATUS]: nextStatus,
      [StoredValue.PAGE]: null
    });
  }

  clearStatus() {
    this.uiActions.updateQueryParameters({[StoredValue.STATUS]: null, [StoredValue.PAGE]: null});
  }

  onDirectionChange(direction: DateRangeDirection) {
    this.dateRangeDirection = direction;
  }

  onRangeChange(range: DateRange) {
    this.uiActions.updateQueryParameters({
      [StoredValue.DATE_FROM]: this.dateUtils.asString(range.from, null, this.dateUtils.formats.yearMonthDayWithDashes),
      [StoredValue.DATE_TO]: this.dateUtils.asString(range.to, null, this.dateUtils.formats.yearMonthDayWithDashes),
      [StoredValue.DATE_RANGE_DIRECTION]: this.dateRangeDirection,
      [StoredValue.PAGE]: null
    });
  }

  goToPage(page: number) {
    this.scrollPosition.retain();
    this.uiActions.updateQueryParameters({[StoredValue.PAGE]: page});
  }

  allowEdit(): boolean {
    return this.display.walkPopulationLocal() && this.memberLoginService.allowWalkAdminEdits();
  }
}
