import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Location } from "@angular/common";
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from "@angular/cdk/drag-drop";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faChevronLeft, faChevronRight, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { chunk, first, last, uniq } from "es-toolkit/compat";
import { PageComponent } from "../../../page/page.component";
import { SectionToggle } from "../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../models/section-toggle.model";
import { WalkProgrammeViewSelector } from "../walk-programme-view-selector/walk-programme-view-selector";
import { StoredValue } from "../../../models/ui-actions";
import { CalendarColourBy } from "../../../models/walks-config.model";
import {
  CalendarDay,
  CalendarEntry,
  CalendarViewMode,
  CalendarWeek,
  COMMITTEE_EVENT_CALENDAR_COLOUR,
  displayedWalkProgrammeStatus,
  GROUP_EVENT_CALENDAR_COLOUR,
  programmeStatusDescriptor,
  PROGRAMME_STATUS_DESCRIPTORS,
  programmeStatusDescriptorsFor
} from "../../../models/walk-programme.model";
import { DisplayedWalk, EventType } from "../../../models/walk.model";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { walkLeaderDisplayName } from "../../../functions/walks/walk-leader-fields";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { PathSegment } from "../../../models/content-text.model";
import { WalkProgrammeService } from "../../../services/walks-and-events/walk-programme.service";
import { ScrollPositionService } from "../../../services/scroll-position.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { WalkDisplayService } from "../walk-display.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { UrlService } from "../../../services/url.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { BroadcastService } from "../../../services/broadcast-service";
import { NotifierService, AlertInstance } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { CommitteeDisplayService } from "../../committee/committee-display.service";
import { CommitteeFile } from "../../../models/committee.model";

const UNASSIGNED_CALENDAR_COLOUR = "rgb(153, 153, 153)";

const LEADER_GRADE_PALETTE: string[] = [
  "rgb(0, 151, 164)",
  "rgb(240, 128, 80)",
  "rgb(155, 200, 171)",
  "rgb(249, 177, 4)",
  "rgb(246, 176, 157)",
  "rgb(133, 173, 146)",
  "rgb(99, 134, 110)",
  "rgb(120, 144, 197)"
];

@Component({
  selector: "app-walk-programme-calendar",
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, FormsModule, FontAwesomeModule, CdkDropListGroup, CdkDropList, CdkDrag, WalkProgrammeViewSelector, SectionToggle],
  styleUrls: ["./walk-programme-calendar.sass"],
  template: `
    <app-page autoTitle>
      @if (!selectMode) {
        <app-walk-programme-view-selector/>
      } @else {
        <div class="select-mode-nav">
          <button type="button" class="btn pager-btn rounded" (click)="goBackFromSelect()">
            <fa-icon [icon]="faArrowLeft" class="me-2"/>Back
          </button>
        </div>
      }
      <div class="calendar">
        <div class="calendar-sticky sticky-toolbar">
        <div class="calendar-toolbar">
          <div class="calendar-nav">
            <button type="button" class="btn btn-sm btn-quiet" (click)="previous()">
              <fa-icon [icon]="faChevronLeft"/>
            </button>
            <button type="button" class="btn btn-sm btn-quiet" (click)="today()">Today</button>
            <button type="button" class="btn btn-sm btn-quiet" (click)="next()">
              <fa-icon [icon]="faChevronRight"/>
            </button>
            <span class="calendar-title">{{ periodTitle() }}</span>
          </div>
          <div class="calendar-controls">
            <app-section-toggle stackOnMobile [tabs]="viewModeTabs" [selectedTab]="viewMode"
                                (selectedTabChange)="setViewMode($event)"/>
            <div class="control-field">
              <label id="calendar-colour-by-label">Colour by</label>
              <app-section-toggle stackOnMobile [tabs]="colourByTabs" [selectedTab]="colourBy"
                                  (selectedTabChange)="setColourBy($event)"/>
            </div>
            @if (!display.walkPopulationWalksManager()) {
              <div class="form-check control-toggle">
                <input id="calendar-walks-only" type="checkbox" class="form-check-input" [ngModel]="walksOnly"
                       [ngModelOptions]="{standalone: true}" (ngModelChange)="setWalksOnly($event)">
                <label class="form-check-label" for="calendar-walks-only">Walks only</label>
              </div>
            }
          </div>
        </div>

        @if (dragEnabled()) {
          <div class="calendar-hint">Drag a walk to another day to reschedule it.</div>
        }

        @if (notifyTarget.showAlert) {
          <div class="alert {{ notifyTarget.alertClass }} d-flex align-items-start" role="alert">
            <fa-icon [icon]="notifyTarget.alert.icon" class="me-2 mt-1"/>
            <div><strong>{{ notifyTarget.alertTitle }}</strong> {{ notifyTarget.alertMessage }}</div>
          </div>
        }

        <div class="calendar-grid-header">
          @for (dayName of weekdayHeaders; track dayName) {
            <div class="weekday">{{ dayName }}</div>
          }
        </div>
        </div>

        <div class="calendar-weeks" cdkDropListGroup [class.week-view]="viewMode === CalendarViewMode.WEEK">
          @for (week of weeks; track week.label) {
            @if (viewMode === CalendarViewMode.WEEK) {
              <div class="week-heading">
                <span class="week-range">{{ week.label }}</span>
                <span class="week-count">{{ weekCountLabel(week) }}</span>
              </div>
            }
            <div class="calendar-grid">
              @for (day of week.days; track day.value) {
                <div class="calendar-cell" [class.outside]="!day.inCurrentPeriod" [class.today]="day.isToday"
                     [class.suggested]="day.value === suggestedDate"
                     [class.weekend]="day.isWeekend" [class.selectable]="selectMode" (click)="onCellClick(day)"
                     cdkDropList [cdkDropListData]="day"
                     [cdkDropListDisabled]="!dragEnabled()" (cdkDropListDropped)="onDrop($event)">
                  <div class="cell-date">{{ day.dayOfMonth }}</div>
                  <div class="cell-mobile-date">{{ mobileDayLabel(day.value) }}</div>
                  <div class="cell-entries">
                    @for (entry of day.entries; track entry.id) {
                      <div class="calendar-entry" cdkDrag [cdkDragData]="entry" [cdkDragDisabled]="!dragEnabled() || entry.isGroupEvent || entry.isCommitteeEvent"
                           [class.group-event]="entry.isGroupEvent || entry.isCommitteeEvent" [style.--entry-colour]="entry.colour"
                           (click)="openEntry(entry)">
                        <span class="entry-time">{{ entry.time }}</span>
                        <span class="entry-title">{{ entry.title }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <div class="calendar-legend">
          @for (legend of legendItems(); track legend.label) {
            <span class="legend-item">
              <span class="legend-swatch" [style.--entry-colour]="legend.colour"></span>{{ legend.label }}
            </span>
          }
        </div>
      </div>
    </app-page>
  `
})
export class WalkProgrammeCalendarComponent implements OnInit, OnDestroy {

  @Input() selectMode = false;
  @Input() includeCommitteeEvents = false;
  @Output() dateSelected = new EventEmitter<number>();

  private logger: Logger = inject(LoggerFactory).createLogger("WalkProgrammeCalendarComponent", NgxLoggerLevel.ERROR);
  private elementRef = inject(ElementRef);
  private walkProgrammeService = inject(WalkProgrammeService);
  private scrollPosition = inject(ScrollPositionService);
  private walksAndEventsService = inject(WalksAndEventsService);
  protected display = inject(WalkDisplayService);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private urlService = inject(UrlService);
  private location = inject(Location);
  private memberLoginService = inject(MemberLoginService);
  private systemConfigService = inject(SystemConfigService);
  private walksConfigService = inject(WalksConfigService);
  private broadcastService = inject<BroadcastService<ExtendedGroupEvent>>(BroadcastService);
  private notifierService = inject(NotifierService);
  private committeeFileService = inject(CommitteeFileService);
  private committeeDisplayService = inject(CommitteeDisplayService);
  private route = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];
  private notify: AlertInstance;

  protected notifyTarget: AlertTarget = {};
  protected anchor = this.dateUtils.dateTimeNowNoTime().valueOf();
  protected suggestedDate: number | null = null;
  protected viewMode: CalendarViewMode = CalendarViewMode.MONTH;
  protected colourBy: CalendarColourBy = CalendarColourBy.STATUS;
  protected walksOnly = false;
  protected days: CalendarDay[] = [];
  protected weeks: CalendarWeek[] = [];
  protected readonly weekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  protected readonly CalendarViewMode = CalendarViewMode;
  protected readonly CalendarColourBy = CalendarColourBy;
  protected readonly colourByTabs: SectionToggleTab[] = [
    {value: CalendarColourBy.STATUS, label: "Status"},
    {value: CalendarColourBy.GRADE, label: "Grade"},
    {value: CalendarColourBy.LEADER, label: "Leader"}
  ];
  protected readonly viewModeTabs: SectionToggleTab[] = [
    {value: CalendarViewMode.MONTH, label: "Month"},
    {value: CalendarViewMode.WEEK, label: "Weeks"}
  ];
  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faTriangleExclamation = faTriangleExclamation;

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(() => this.applyDefaultsAndReload()));
    this.subscriptions.push(this.walksConfigService.events().subscribe(() => this.applyDefaultsAndReload()));
    this.subscriptions.push(this.route.queryParamMap.subscribe(() => this.applyFromUrl()));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private applyDefaultsAndReload() {
    if (!this.uiActions.queryParameter(StoredValue.CALENDAR_COLOUR_BY)) {
      this.colourBy = this.walksConfigService.walksConfig()?.calendarDefaultColourBy || CalendarColourBy.STATUS;
    }
    this.reload();
  }

  private applyFromUrl() {
    const viewParam = this.uiActions.queryParameter(StoredValue.CALENDAR_VIEW);
    const colourParam = this.uiActions.queryParameter(StoredValue.CALENDAR_COLOUR_BY);
    const dateParam = this.uiActions.queryParameter(StoredValue.CALENDAR_DATE);
    const walksOnlyParam = this.uiActions.queryParameter(StoredValue.WALKS_ONLY);
    this.viewMode = viewParam === CalendarViewMode.WEEK ? CalendarViewMode.WEEK : CalendarViewMode.MONTH;
    this.colourBy = this.validColourBy(colourParam) || this.walksConfigService.walksConfig()?.calendarDefaultColourBy || CalendarColourBy.STATUS;
    this.anchor = dateParam ? this.dateUtils.asValueNoTime(dateParam) : this.dateUtils.dateTimeNowNoTime().valueOf();
    this.walksOnly = walksOnlyParam === "true";
    this.reload();
  }

  private validColourBy(value: string | null): CalendarColourBy | null {
    return [CalendarColourBy.STATUS, CalendarColourBy.GRADE, CalendarColourBy.LEADER].find(item => item === value) || null;
  }

  private rangeStart() {
    return this.dateUtils.asDateTime(this.anchor).startOf("month").startOf("week");
  }

  private rangeEnd() {
    return this.dateUtils.asDateTime(this.anchor).endOf("month").endOf("week");
  }

  private async reload() {
    const start = this.rangeStart();
    const end = this.rangeEnd();
    try {
      const events = await this.walkProgrammeService.eventsInRange({
        dateFrom: start.valueOf(),
        dateTo: end.endOf("day").valueOf(),
        walksOnly: this.walksOnly || this.display.walkPopulationWalksManager()
      });
      const committeeFiles = await this.committeeFilesInRange(start.valueOf(), end.endOf("day").valueOf());
      this.buildDays(start.valueOf(), end.valueOf(), events, committeeFiles);
    } catch (error) {
      this.logger.error("reload:error", error);
      this.buildDays(start.valueOf(), end.valueOf(), [], []);
    }
    this.scrollPosition.restore();
    this.scrollSuggestedIntoView();
  }

  private async committeeFilesInRange(fromValue: number, toValue: number): Promise<CommitteeFile[]> {
    if (this.includeCommitteeEvents) {
      return this.committeeFileService.filesInDateRange(fromValue, toValue);
    } else {
      return [];
    }
  }

  private buildDays(startValue: number, endValue: number, events: ExtendedGroupEvent[], committeeFiles: CommitteeFile[]) {
    const anchorMonth = this.dateUtils.asDateTime(this.anchor).month;
    const todayValue = this.dateUtils.dateTimeNowNoTime().valueOf();
    const entriesByDay = this.entriesByDay(events);
    this.mergeCommitteeEntries(entriesByDay, committeeFiles);
    this.days = this.dateUtils.inclusiveDayRange(startValue, endValue).map(dayValue => {
      const dayDateTime = this.dateUtils.asDateTime(dayValue);
      return {
        value: dayValue,
        dayOfMonth: dayDateTime.day,
        inCurrentPeriod: dayDateTime.month === anchorMonth,
        isToday: dayValue === todayValue,
        isWeekend: dayDateTime.weekday >= 6,
        entries: entriesByDay.get(dayValue) || []
      };
    });
    this.weeks = chunk(this.days, this.weekdayHeaders.length).map(days => this.toWeek(days));
  }

  private toWeek(days: CalendarDay[]): CalendarWeek {
    const walkCount = days.flatMap(day => day.entries).filter(entry => !entry.isGroupEvent && !entry.isCommitteeEvent).length;
    return {label: this.weekLabel(days), walkCount, days};
  }

  private weekLabel(days: CalendarDay[]): string {
    const firstDayValue = first(days).value;
    const lastDayValue = last(days).value;
    const sameMonth = this.dateUtils.asDateTime(firstDayValue).month === this.dateUtils.asDateTime(lastDayValue).month;
    const fromFormat = sameMonth ? "d" : "d MMM";
    return `${this.dateUtils.asString(firstDayValue, null, fromFormat)} - ${this.dateUtils.asString(lastDayValue, null, "d MMM")}`;
  }

  weekCountLabel(week: CalendarWeek): string {
    if (week.walkCount === 0) {
      return "No walks";
    } else if (week.walkCount === 1) {
      return "1 walk";
    } else {
      return `${week.walkCount} walks`;
    }
  }

  private entriesByDay(events: ExtendedGroupEvent[]): Map<number, CalendarEntry[]> {
    const entriesByDay = new Map<number, CalendarEntry[]>();
    events.filter(event => this.display.statusFor(event) !== EventType.DELETED).forEach(event => {
      const dayValue = this.dateUtils.asValueNoTime(event?.groupEvent?.start_date_time);
      const entry = this.toEntry(event);
      const existing = entriesByDay.get(dayValue) || [];
      existing.push(entry);
      entriesByDay.set(dayValue, existing);
    });
    entriesByDay.forEach(entries => entries.sort((left, right) => left.dateValue - right.dateValue));
    return entriesByDay;
  }

  private mergeCommitteeEntries(entriesByDay: Map<number, CalendarEntry[]>, committeeFiles: CommitteeFile[]): void {
    committeeFiles.forEach(committeeFile => {
      const dayValue = this.dateUtils.asValueNoTime(committeeFile.eventDate);
      const existing = entriesByDay.get(dayValue) || [];
      existing.push(this.committeeEntry(committeeFile));
      existing.sort((left, right) => left.dateValue - right.dateValue);
      entriesByDay.set(dayValue, existing);
    });
  }

  private committeeEntry(committeeFile: CommitteeFile): CalendarEntry {
    return {
      id: committeeFile.id,
      isGroupEvent: false,
      isCommitteeEvent: true,
      colour: COMMITTEE_EVENT_CALENDAR_COLOUR,
      title: this.committeeDisplayService.fileTitle(committeeFile),
      time: this.dateUtils.displayTime(committeeFile.eventDate),
      dateValue: this.dateUtils.asValue(committeeFile.eventDate)
    };
  }

  private toEntry(event: ExtendedGroupEvent): CalendarEntry {
    const displayedWalk = this.display.toDisplayedWalk(event);
    const isGroupEvent = event?.groupEvent?.item_type === RamblersEventType.GROUP_EVENT;
    return {
      id: event.id,
      displayedWalk,
      isGroupEvent,
      colour: this.colourFor(displayedWalk, isGroupEvent),
      title: this.entryTitle(event),
      time: this.dateUtils.displayTime(event?.groupEvent?.start_date_time),
      dateValue: this.dateUtils.asValue(event?.groupEvent?.start_date_time)
    };
  }

  private colourFor(displayedWalk: DisplayedWalk, isGroupEvent: boolean): string {
    if (isGroupEvent) {
      return GROUP_EVENT_CALENDAR_COLOUR;
    } else if (this.colourBy === CalendarColourBy.STATUS) {
      const status = displayedWalkProgrammeStatus(displayedWalk.walk, displayedWalk.status);
      return programmeStatusDescriptor(status).colour;
    } else {
      const key = this.colourKeyFor(displayedWalk);
      return key ? this.paletteColour(key) : UNASSIGNED_CALENDAR_COLOUR;
    }
  }

  private entryTitle(event: ExtendedGroupEvent): string {
    const title = (event?.groupEvent?.title || "").trim();
    const leader = walkLeaderDisplayName(event);
    if (title) {
      return title;
    } else if (leader) {
      return `Led by ${leader}`;
    } else {
      return "Walk slot";
    }
  }

  private colourKeyFor(displayedWalk: DisplayedWalk): string {
    if (this.colourBy === CalendarColourBy.GRADE) {
      return displayedWalk.walk?.groupEvent?.difficulty?.description;
    } else if (this.colourBy === CalendarColourBy.LEADER) {
      return walkLeaderDisplayName(displayedWalk.walk);
    } else {
      return null;
    }
  }

  private walkEntriesInPeriod(): CalendarEntry[] {
    return (this.days || []).flatMap(day => day.entries || []).filter(entry => !entry.isGroupEvent && !entry.isCommitteeEvent);
  }

  private keyedLegendItems(): { label: string; colour: string }[] {
    const entries = this.walkEntriesInPeriod();
    const keyed = uniq(entries.map(entry => this.colourKeyFor(entry.displayedWalk)).filter(key => key)).sort();
    const namedItems = keyed.map(key => ({label: key, colour: this.paletteColour(key)}));
    const unassignedLabel = this.colourBy === CalendarColourBy.GRADE ? "No grade" : "No leader";
    const anyUnassigned = entries.some(entry => !this.colourKeyFor(entry.displayedWalk));
    const unassignedItems = anyUnassigned ? [{label: unassignedLabel, colour: UNASSIGNED_CALENDAR_COLOUR}] : [];
    return [...namedItems, ...unassignedItems];
  }

  private paletteColour(key: string): string {
    const hash = key.split("").reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
    return LEADER_GRADE_PALETTE[hash % LEADER_GRADE_PALETTE.length];
  }

  legendItems(): { label: string; colour: string }[] {
    const groupEventLegend = this.walksOnly || this.display.walkPopulationWalksManager()
      ? []
      : [{label: "Group event", colour: GROUP_EVENT_CALENDAR_COLOUR}];
    const committeeLegend = this.includeCommitteeEvents
      ? [{label: "Committee event", colour: COMMITTEE_EVENT_CALENDAR_COLOUR}]
      : [];
    if (this.colourBy === CalendarColourBy.STATUS) {
      const statusLegend = programmeStatusDescriptorsFor(this.display.walkPopulationWalksManager())
        .map(descriptor => ({label: descriptor.title, colour: descriptor.colour}));
      return [...statusLegend, ...groupEventLegend, ...committeeLegend];
    } else {
      return [...this.keyedLegendItems(), ...groupEventLegend, ...committeeLegend];
    }
  }

  dragEnabled(): boolean {
    return this.display.walkPopulationLocal()
      && this.memberLoginService.allowWalkAdminEdits()
      && !!this.walksConfigService.walksConfig()?.allowCalendarDragToReschedule;
  }

  async onDrop(event: CdkDragDrop<CalendarDay>) {
    const entry: CalendarEntry = event.item.data;
    const targetDay: CalendarDay = event.container.data;
    const movedToAnotherDay = event.previousContainer !== event.container;
    if (movedToAnotherDay && !entry.isGroupEvent) {
      await this.reschedule(entry, targetDay.value);
    }
  }

  private async reschedule(entry: CalendarEntry, targetDayValue: number) {
    this.notify.hide();
    try {
      const walk = await this.walksAndEventsService.queryById(entry.id);
      if (!walk) {
        this.notify.error({title: "Reschedule failed", message: "Could not load the walk to move it."});
      } else {
        const originalDateTime = this.dateUtils.asDateTime(walk.groupEvent.start_date_time);
        const targetDateTime = this.dateUtils.asDateTime(targetDayValue).set({
          hour: originalDateTime.hour,
          minute: originalDateTime.minute
        });
        walk.groupEvent.start_date_time = this.dateUtils.isoDateTime(targetDateTime.valueOf());
        await this.walksAndEventsService.createOrUpdate(walk);
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.WALK_SAVED, walk));
        this.notify.success({
          title: "Walk rescheduled",
          message: `Moved to ${this.dateUtils.asString(targetDayValue, null, "ccc d MMM yyyy")}.`
        });
        await this.reload();
      }
    } catch (error) {
      this.logger.error("reschedule:error", error);
      this.notify.error({title: "Reschedule failed", message: "The walk could not be moved. Please try again."});
    }
  }

  openEntry(entry: CalendarEntry) {
    if (!this.selectMode && !entry.isCommitteeEvent) {
      if (entry.isGroupEvent) {
        this.display.openGroupEventView(entry.displayedWalk?.walk);
      } else {
        this.display.openWalkView(entry.displayedWalk?.walk);
      }
    }
  }

  onCellClick(day: CalendarDay) {
    if (this.selectMode) {
      this.dateSelected.emit(day.value);
    }
  }

  goBackFromSelect() {
    this.location.back();
  }

  mobileDayLabel(dayValue: number): string {
    return this.dateUtils.asString(dayValue, null, "cccc d MMMM");
  }

  periodTitle(): string {
    return this.dateUtils.asString(this.anchor, null, "MMMM yyyy");
  }

  previous() {
    this.shiftAnchor(-1);
  }

  next() {
    this.shiftAnchor(1);
  }

  private shiftAnchor(direction: number) {
    const shifted = this.dateUtils.asDateTime(this.anchor).plus({months: direction});
    this.storeAnchor(shifted.valueOf());
  }

  today() {
    this.storeAnchor(this.dateUtils.dateTimeNowNoTime().valueOf());
  }

  showDate(value: number): void {
    this.suggestedDate = this.dateUtils.asValueNoTime(value);
    const sameMonth = this.dateUtils.asDateTime(this.anchor).hasSame(this.dateUtils.asDateTime(this.suggestedDate), "month");
    this.storeAnchor(this.suggestedDate);
    if (sameMonth) {
      this.scrollSuggestedIntoView();
    }
  }

  private storeAnchor(value: number): Promise<boolean> {
    this.scrollPosition.retain();
    return this.uiActions.updateQueryParameters({
      [StoredValue.CALENDAR_DATE]: this.dateUtils.asString(value, null, this.dateUtils.formats.yearMonthDayWithDashes)
    });
  }

  private scrollSuggestedIntoView(): void {
    if (this.suggestedDate) {
      requestAnimationFrame(() => {
        const cell = this.elementRef.nativeElement.querySelector(".calendar-cell.suggested");
        if (cell) {
          cell.scrollIntoView({behavior: "smooth", block: "center"});
        }
      });
    }
  }

  setViewMode(viewMode: CalendarViewMode) {
    this.uiActions.updateQueryParameters({[StoredValue.CALENDAR_VIEW]: viewMode});
  }

  setColourBy(colourBy: CalendarColourBy) {
    this.uiActions.updateQueryParameters({[StoredValue.CALENDAR_COLOUR_BY]: colourBy});
  }

  setWalksOnly(walksOnly: boolean) {
    this.uiActions.updateQueryParameters({[StoredValue.WALKS_ONLY]: walksOnly});
  }
}
