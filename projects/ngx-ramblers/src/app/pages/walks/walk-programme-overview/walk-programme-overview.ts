import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowRightToBracket, faChevronLeft, faChevronRight, faCircleExclamation, faLocationDot, faPenToSquare, faPersonWalking, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { DateTime } from "luxon";
import { PageComponent } from "../../../page/page.component";
import { WalkProgrammeViewSelector } from "../walk-programme-view-selector/walk-programme-view-selector";
import { DateRangeDirectionSelector } from "../../../components/date-range-selector/date-range-direction-selector";
import { DateRange } from "../../../components/date-range-slider/date-range-slider";
import { DateRangeSelector } from "../../../components/date-range-selector/date-range-selector";
import { DateValue } from "../../../models/date.model";
import { PathSegment } from "../../../models/content-text.model";
import { StoredValue } from "../../../models/ui-actions";
import { defaultProgrammeRange } from "../../../models/search.model";
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
import { UrlService } from "../../../services/url.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-walk-programme-overview",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, DateRangeSelector, FontAwesomeModule, WalkProgrammeViewSelector, DateRangeDirectionSelector],  styleUrls: ["./walk-programme-overview.sass"],
  template: `
    <app-page autoTitle>
      <div class="programme-sticky sticky-toolbar">
        <div class="view-row">
          <app-walk-programme-view-selector/>
          <app-date-range-direction-selector [minDate]="minDate" [maxDate]="maxDate"/>
        </div>
        <div class="programme-toolbar">
          <app-date-range-selector class="range-controls" [minDate]="minDate" [maxDate]="maxDate" [range]="range"
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
          <div class="walk-rows" [class.with-thumbnails]="anyThumbnails()">
            @for (row of rows; track row.id) {
              <div class="walk-row" role="button" tabindex="0" [style.--status-colour]="descriptorFor(row.status).colour"
                   (click)="openWalk(row)" (keydown.enter)="openWalk(row)" (keydown.space)="openWalk(row)">
                <div class="walk-row-date">
                  <span class="walk-day">{{ dayName(row.startDateTime) }}</span>
                  <span class="walk-date">{{ dateShort(row.startDateTime) }}</span>
                  <span class="walk-countdown">{{ countdown(row.startDateTime) }}</span>
                </div>
                @if (anyThumbnails()) {
                  <div class="walk-row-thumbnail-cell">
                    @if (row.thumbnailUrl) {
                      <img class="walk-row-thumbnail" [src]="thumbnailSource(row)" [alt]="row.title || 'Walk image'"/>
                    }
                  </div>
                }
                <div class="walk-row-main">
                  <div class="walk-row-title">
                    @if (showGroup()) {
                      <span class="group-badge">{{ groupLabel(row) }}</span>
                    }
                    {{ row.title || "Untitled walk slot" }}
                  </div>
                  <div class="walk-row-meta">
                    <span><fa-icon [icon]="faPersonWalking"/> {{ row.leaderName || "No leader" }}</span>
                    @if (row.distanceMiles) {
                      <span>{{ row.distanceMiles }} miles</span>
                    }
                    @if (row.gradeDescription) {
                      <span>{{ row.gradeDescription }}</span>
                    }
                    @if (!row.hasLocation) {
                      <span class="muted"><fa-icon [icon]="faLocationDot"/> No location</span>
                    }
                  </div>
                  @if (whatsMissing(row).length > 0) {
                    <div class="walk-row-missing">
                      <fa-icon [icon]="faCircleExclamation"/>
                      <span>Needs: {{ whatsMissing(row).join(", ") }}</span>
                    </div>
                  }
                </div>
                <div class="walk-row-status">
                  <span class="status-badge" [style.background-color]="descriptorFor(row.status).colour"
                        [style.color]="descriptorFor(row.status).textColour">{{ descriptorFor(row.status).title }}</span>
                </div>
                <div class="walk-row-actions">
                  <button type="button" class="btn btn-sm btn-quiet" (click)="openWalk(row)"
                          [title]="'View ' + (row.title || 'this walk') + ' as it appears on the website'">
                    <fa-icon [icon]="faArrowRightToBracket"/>
                    <span class="ms-1">Open</span>
                  </button>
                  @if (allowEdit()) {
                    <button type="button" class="btn btn-sm btn-quiet" [title]="actionTooltip(row)"
                            (click)="editWalk(row); $event.stopPropagation()">
                      <fa-icon [icon]="faPenToSquare"/>
                      <span class="ms-1">{{ actionLabel(row) }}</span>
                    </button>
                  }
                </div>
              </div>
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
    </app-page>
  `
})
export class WalkProgrammeOverviewComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkProgrammeOverviewComponent", NgxLoggerLevel.ERROR);
  private walkProgrammeService = inject(WalkProgrammeService);
  private scrollPosition = inject(ScrollPositionService);
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private urlService = inject(UrlService);
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
  protected status: ProgrammeOverviewStatus | null = null;
  protected page = 1;
  protected readonly limit = 12;
  protected loading = true;
  protected rows: WalkProgrammeSummaryRow[] = [];
  protected counts: WalkProgrammeSummaryResponse["counts"] = {};
  protected pagination: WalkProgrammeSummaryPagination = {total: 0, page: 1, limit: this.limit, totalPages: 1};

  protected readonly faXmark = faXmark;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faPersonWalking = faPersonWalking;
  protected readonly faLocationDot = faLocationDot;
  protected readonly faPenToSquare = faPenToSquare;
  protected readonly faArrowRightToBracket = faArrowRightToBracket;
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
    const startOfToday = this.dateUtils.dateTimeNowNoTime();
    const fromMillis = fromParam ? this.dateUtils.asValueNoTime(fromParam) : startOfToday.valueOf();
    const toMillis = toParam ? this.dateUtils.asValueNoTime(toParam) : startOfToday.plus({weeks: this.defaultWeeks()}).valueOf();
    this.dateFrom = this.dateUtils.asDateValue(fromMillis);
    this.dateTo = this.dateUtils.asDateValue(toMillis);
    this.range = {from: fromMillis, to: toMillis};
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

  thumbnailSource(row: WalkProgrammeSummaryRow): string {
    return this.urlService.imageSource(row.thumbnailUrl, false, true);
  }

  showGroup(): boolean {
    const config = this.systemConfigService.systemConfig();
    const areaGroupCount = config?.area?.groups?.length || 0;
    return areaGroupCount > 1;
  }

  groupLabel(row: WalkProgrammeSummaryRow): string {
    return row.groupName || row.groupCode || "";
  }

  descriptorFor(status: ProgrammeOverviewStatus): ProgrammeStatusDescriptor {
    return programmeStatusDescriptor(status);
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

  onRangeChange(range: DateRange) {
    this.uiActions.updateQueryParameters({
      [StoredValue.DATE_FROM]: this.dateUtils.asString(range.from, null, this.dateUtils.formats.yearMonthDayWithDashes),
      [StoredValue.DATE_TO]: this.dateUtils.asString(range.to, null, this.dateUtils.formats.yearMonthDayWithDashes),
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

  private awaitingApproval(row: WalkProgrammeSummaryRow): boolean {
    return row.status === ProgrammeOverviewStatus.AWAITING_APPROVAL;
  }

  inPast(row: WalkProgrammeSummaryRow): boolean {
    return this.daysUntil(row.startDateTime) < 0;
  }

  actionLabel(row: WalkProgrammeSummaryRow): string {
    return this.awaitingApproval(row) ? "Review & approve" : this.inPast(row) ? "Edit past walk" : "Edit walk";
  }

  actionTooltip(row: WalkProgrammeSummaryRow): string {
    const walkName = row.title || "this walk";
    return this.awaitingApproval(row)
      ? `Open ${walkName} to check its details and approve it`
      : this.inPast(row)
        ? `Open ${walkName} for editing. This walk has already taken place, so nothing normally needs doing to it.`
        : `Open ${walkName} for editing`;
  }

  whatsMissing(row: WalkProgrammeSummaryRow): string[] {
    return [
      row.leaderName ? null : "leader",
      row.title ? null : "walk details",
      row.distanceMiles ? null : "distance",
      row.gradeDescription ? null : "grade",
      row.hasLocation ? null : "start location"
    ].filter(item => item);
  }

  dayName(startDateTime: string): string {
    return this.dateUtils.asString(startDateTime, null, "ccc");
  }

  dateShort(startDateTime: string): string {
    return this.dateUtils.asString(startDateTime, null, "d MMM yyyy");
  }

  private daysUntil(startDateTime: string): number {
    return Math.round(this.dateUtils.asDateTime(startDateTime).startOf("day").diff(this.dateUtils.dateTimeNowNoTime(), "days").days);
  }

  countdown(startDateTime: string): string {
    return this.dateUtils.relativeDay(startDateTime);
  }

  private navIdentifier(row: WalkProgrammeSummaryRow): string {
    const slug = (row.url || "").split("/").filter(segment => segment).pop();
    return slug || row.id;
  }

  openWalk(row: WalkProgrammeSummaryRow) {
    this.display.openWalkViewFor(this.navIdentifier(row));
  }

  editWalk(row: WalkProgrammeSummaryRow) {
    this.display.openWalkEditFor(this.navIdentifier(row));
  }
}
