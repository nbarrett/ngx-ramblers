import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { DateTime } from "luxon";
import { PageComponent } from "../../../page/page.component";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { WalkProgrammeViewSelector } from "../walk-programme-view-selector/walk-programme-view-selector";
import { DateRangeDirectionSelector } from "../../../components/date-range-selector/date-range-direction-selector";
import { WalksMapView } from "../walk-list/walks-map-view";
import { DateRange } from "../../../components/date-range-slider/date-range-slider";
import { DateRangeSelector } from "../../../components/date-range-selector/date-range-selector";
import { StoredValue } from "../../../models/ui-actions";
import { DATE_RANGE_DIRECTION_TABS, DateRangeDirection, defaultProgrammeRange } from "../../../models/search.model";
import {
  displayedWalkProgrammeStatus,
  ProgrammeOverviewStatus,
  ProgrammeStatusDescriptor,
  PROGRAMME_STATUS_DESCRIPTORS,
  programmeStatusDescriptorsFor
} from "../../../models/walk-programme.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { WalkProgrammeService } from "../../../services/walks-and-events/walk-programme.service";
import { WalkDisplayService } from "../walk-display.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

const ALL_STATUSES = "all-statuses";

@Component({
  selector: "app-walk-programme-map",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, WalksMapView, DateRangeSelector, FontAwesomeModule, WalkProgrammeViewSelector, SectionToggle, DateRangeDirectionSelector],
  styleUrls: ["./walk-programme-map.sass"],
  template: `
    <app-page autoTitle>
      <div class="view-row">
          <app-walk-programme-view-selector/>
          <app-date-range-direction-selector [minDate]="minDate" [maxDate]="maxDate"
                                             [direction]="dateRangeDirection"
                                             (directionChange)="onDirectionChange($event)"/>
        </div>
      <div class="programme-map">
        <app-date-range-selector [minDate]="minDate" [maxDate]="maxDate" [direction]="dateRangeDirection"
                                 [range]="range" (rangeChange)="onRangeChange($event)"/>
        <app-section-toggle [tabs]="statusTabs()" [selectedTab]="status || ALL_STATUSES"
                            (selectedTabChange)="selectStatusTab($event)"/>

        @if (!loading && filteredWalks.length === 0) {
          <div class="alert alert-warning d-flex align-items-start" role="alert">
            <fa-icon [icon]="faTriangleExclamation" class="me-2 mt-1"/>
            <div>
              <strong class="d-block">No mappable walks</strong>
              No walks with a location match this view. Walks without a start location cannot appear on the map.
            </div>
          </div>
        } @else {
          <app-walks-map-view [filteredWalks]="filteredWalks" [loading]="loading" [showControlsByDefault]="false"
                              (selected)="onMapSelect($event)"/>
        }
      </div>
    </app-page>
  `
})
export class WalkProgrammeMapComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkProgrammeMapComponent", NgxLoggerLevel.ERROR);
  private walkProgrammeService = inject(WalkProgrammeService);
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private walksConfigService = inject(WalksConfigService);
  private systemConfigService = inject(SystemConfigService);
  protected stringUtils = inject(StringUtilsService);
  private route = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];

  protected loading = true;
  protected status: ProgrammeOverviewStatus | null = null;
  protected readonly ALL_STATUSES = ALL_STATUSES;
  protected minDate: DateTime;
  protected maxDate: DateTime;
  protected range: DateRange;
  protected dateRangeDirection: DateRangeDirection = DateRangeDirection.FUTURE;
  private allWalks: DisplayedWalk[] = [];
  protected filteredWalks: DisplayedWalk[] = [];
  protected readonly faTriangleExclamation = faTriangleExclamation;

  ngOnInit() {
    this.applyDateBounds();
    this.subscriptions.push(this.systemConfigService.events().subscribe(() => this.loadFromUrl()));
    this.subscriptions.push(this.walksConfigService.events().subscribe(() => this.loadFromUrl()));
    this.subscriptions.push(this.route.queryParamMap.subscribe(() => this.loadFromUrl()));
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
    const directionParam = this.uiActions.queryParameter(StoredValue.DATE_RANGE_DIRECTION);
    const startOfToday = this.dateUtils.dateTimeNowNoTime();
    const fromMillis = fromParam ? this.dateUtils.asValueNoTime(fromParam) : startOfToday.valueOf();
    const toMillis = toParam ? this.dateUtils.asValueNoTime(toParam) : startOfToday.plus({weeks: this.defaultWeeks()}).valueOf();
    this.range = {from: fromMillis, to: toMillis};
    this.dateRangeDirection = DATE_RANGE_DIRECTION_TABS.find(tab => tab.value === directionParam)?.value || DateRangeDirection.FUTURE;
    this.status = this.validStatus(this.uiActions.queryParameter(StoredValue.STATUS));
    this.reload();
  }

  onDirectionChange(direction: DateRangeDirection) {
    this.dateRangeDirection = direction;
  }

  onMapSelect(displayedWalk: DisplayedWalk) {
    if (displayedWalk?.walk) {
      void this.display.openWalkView(displayedWalk.walk);
    }
  }

  onRangeChange(range: DateRange) {
    this.uiActions.updateQueryParameters({
      [StoredValue.DATE_FROM]: this.dateUtils.asString(range.from, null, this.dateUtils.formats.yearMonthDayWithDashes),
      [StoredValue.DATE_TO]: this.dateUtils.asString(range.to, null, this.dateUtils.formats.yearMonthDayWithDashes),
      [StoredValue.DATE_RANGE_DIRECTION]: this.dateRangeDirection
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private defaultWeeks(): number {
    const configured = this.walksConfigService.walksConfig()?.programmeOverviewDefaultWeeks;
    return configured && configured > 0 ? configured : 12;
  }

  private validStatus(statusParam: string | null): ProgrammeOverviewStatus | null {
    const match = PROGRAMME_STATUS_DESCRIPTORS.find(descriptor => descriptor.status === statusParam);
    return match ? match.status : null;
  }

  private async reload() {
    this.loading = true;
    try {
      const events: ExtendedGroupEvent[] = await this.walkProgrammeService.eventsInRange({
        dateFrom: this.range.from,
        dateTo: this.dateUtils.asDateTime(this.range.to).endOf("day").valueOf(),
        walksOnly: true
      });
      this.allWalks = events.map(event => this.display.toDisplayedWalk(event));
      this.applyFilter();
    } catch (error) {
      this.logger.error("reload:error", error);
      this.allWalks = [];
      this.applyFilter();
    } finally {
      this.loading = false;
    }
  }

  private applyFilter() {
    const withLocation = this.allWalks.filter(displayedWalk => this.hasLocation(displayedWalk));
    this.filteredWalks = this.status
      ? withLocation.filter(displayedWalk => displayedWalkProgrammeStatus(displayedWalk.walk, displayedWalk.status) === this.status)
      : withLocation;
    this.logger.info("applyFilter:status", this.status, "filteredWalks", this.filteredWalks.length);
  }

  private hasLocation(displayedWalk: DisplayedWalk): boolean {
    const startLocation = displayedWalk.walk?.groupEvent?.start_location;
    const location = displayedWalk.walk?.groupEvent?.location;
    return !!(startLocation?.latitude || location?.latitude);
  }

  visibleDescriptors(): ProgrammeStatusDescriptor[] {
    return programmeStatusDescriptorsFor(this.display.walkPopulationWalksManager());
  }

  statusTabs(): SectionToggleTab[] {
    return [{value: ALL_STATUSES, label: "All statuses"},
      ...this.visibleDescriptors().map(descriptor => ({
        value: descriptor.status,
        label: descriptor.title,
        swatchColour: descriptor.colour
      }))];
  }

  selectStatusTab(value: string) {
    this.selectStatus(value === ALL_STATUSES ? null : value as ProgrammeOverviewStatus);
  }

  selectStatus(status: ProgrammeOverviewStatus | null) {
    const nextStatus = this.status === status ? null : status;
    this.uiActions.updateQueryParameters({[StoredValue.STATUS]: nextStatus});
  }
}
