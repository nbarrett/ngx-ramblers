import { Component, EventEmitter, inject, OnDestroy, OnInit, Output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarDay } from "@fortawesome/free-solid-svg-icons";
import { DurationLikeObject } from "luxon";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { DateRangeUnit } from "../../models/search.model";
import { AdminSettingsPath } from "../../models/admin-route-paths.model";

@Component({
  selector: "app-next-committee-meeting-banner",
  imports: [FontAwesomeModule, RouterLink],
  template: `
    @if (suggestedNextDate) {
      <div class="alert alert-warning d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <fa-icon [icon]="faCalendarDay" class="me-2"/>
          <strong>Next committee meeting due {{ suggestedNextDateLabel }}</strong>
          <span class="ms-1">based on committee meetings {{ frequencyPhrase }}.</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" (click)="plan.emit(suggestedDateValue())">
          Plan this meeting
        </button>
      </div>
    } @else if (committeeConfigLoaded && !hasFrequency) {
      <div class="alert alert-warning d-flex align-items-start">
        <fa-icon [icon]="faCalendarDay" class="me-2 mt-1"/>
        <div>
          <strong class="d-block">Set your committee meeting frequency</strong>
          Tell NGX how often your committee meets in
          <a [routerLink]="'/' + committeeSettingsPath" [queryParams]="{tab: 'configuration'}">Committee Settings</a>
          and the date of the next meeting will be suggested here.
        </div>
      </div>
    }`
})
export class NextCommitteeMeetingBannerComponent implements OnInit, OnDestroy {

  @Output() plan = new EventEmitter<number>();

  private logger: Logger = inject(LoggerFactory).createLogger("NextCommitteeMeetingBannerComponent", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);
  private committeeConfigService = inject(CommitteeConfigService);
  private committeeFileService = inject(CommitteeFileService);
  private subscriptions: Subscription[] = [];

  protected meetingFrequencyAmount: number | null = null;
  protected meetingFrequencyUnit: DateRangeUnit | null = null;
  protected suggestedNextDate: number | null = null;
  protected committeeConfigLoaded = false;

  protected readonly faCalendarDay = faCalendarDay;
  protected readonly committeeSettingsPath = AdminSettingsPath.COMMITTEE_SETTINGS;

  ngOnInit(): void {
    this.subscriptions.push(this.committeeConfigService.committeeConfigEvents().subscribe(committeeConfig => {
      this.committeeConfigLoaded = true;
      this.meetingFrequencyAmount = committeeConfig?.meetingFrequencyAmount ?? null;
      this.meetingFrequencyUnit = committeeConfig?.meetingFrequencyUnit ?? null;
      void this.computeNextMeetingSuggestion();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get hasFrequency(): boolean {
    return this.meetingFrequencyAmount > 0 && !!this.meetingFrequencyUnit;
  }

  get frequencyPhrase(): string {
    return this.hasFrequency
      ? (this.meetingFrequencyAmount === 1
        ? `every ${this.meetingFrequencyUnit.replace(/s$/, "")}`
        : `every ${this.meetingFrequencyAmount} ${this.meetingFrequencyUnit}`)
      : "";
  }

  suggestedDateValue(): number {
    return this.suggestedNextDate ? this.dateUtils.asValueNoTime(this.suggestedNextDate) : null;
  }

  get suggestedNextDateLabel(): string {
    return this.suggestedNextDate ? this.dateUtils.asString(this.suggestedNextDate, null, "cccc d MMMM yyyy") : "";
  }

  private async computeNextMeetingSuggestion(): Promise<void> {
    if (!this.hasFrequency) {
      this.suggestedNextDate = null;
    } else {
      try {
        const latest = await this.committeeFileService.all({criteria: {eventDate: {$exists: true}}, sort: {eventDate: -1}, limit: 1});
        const lastDate = latest?.[0]?.eventDate;
        const base = lastDate ? this.dateUtils.asDateTime(lastDate) : this.dateUtils.asDateTime(this.dateUtils.nowAsValue());
        const interval = {[this.meetingFrequencyUnit]: this.meetingFrequencyAmount} as DurationLikeObject;
        this.suggestedNextDate = base.plus(interval).toMillis();
      } catch (error) {
        this.logger.error("failed to compute next meeting suggestion", error);
        this.suggestedNextDate = null;
      }
    }
  }
}
