import { Component, EventEmitter, inject, OnDestroy, OnInit, Output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DurationLikeObject } from "luxon";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { CommitteeDisplayService } from "../committee/committee-display.service";
import { DateRangeUnit } from "../../models/search.model";
import { AdminSettingsPath } from "../../models/admin-route-paths.model";
import { UIDateFormat } from "../../models/date-format.model";
import { StoredValue } from "../../models/ui-actions";
import { CommitteeFile, CommitteeMeetingType } from "../../models/committee.model";
import { UpcomingBookedMeeting } from "../../models/video-meeting.model";
import { lastFileDateForAgendaType, lastMeetingEventDate, mergeUpcomingBookedMeetings } from "../../functions/upcoming-booked-meetings";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";

@Component({
  selector: "app-next-committee-meeting-banner",
  imports: [RouterLink, AlertPanelComponent],
  template: `
    @if (upcoming.length) {
      <app-alert-panel class="mb-3" [title]="upcomingHeading">
        @for (meeting of upcoming; track meeting.startTime + meeting.title; let first = $first) {
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2"
               [class.mt-2]="!first" [class.pt-2]="!first" [class.border-top]="!first"
               role="button" (click)="showOnCalendar(meeting)">
            <div>
              <div>{{ meeting.title }}</div>
              <div class="small">{{ dateLabel(meeting.startTime) }}</div>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary" (click)="showOnCalendar(meeting); $event.stopPropagation()">Calendar</button>
              @if (meeting.committeePath) {
                <a class="btn btn-quiet" [routerLink]="'/' + meeting.committeePath"
                   [queryParams]="committeeQuery(meeting)" (click)="$event.stopPropagation()">Committee page</a>
              }
            </div>
          </div>
        }
      </app-alert-panel>
    } @else if (suggestedNextDate) {
      <app-alert-panel class="mb-3" actionsEnd title="Next committee meeting due {{ suggestedNextDateLabel }}">
        Based on committee meetings
        <a [routerLink]="'/' + committeeSettingsPath" [queryParams]="{tab: 'configuration'}">{{ frequencyPhrase }}</a>.
        <button alertActions type="button" class="btn btn-primary" (click)="plan.emit({title: null, startTime: suggestedDateValue()})">
          Plan this meeting
        </button>
      </app-alert-panel>
    } @else if (committeeConfigLoaded && !hasFrequency) {
      <app-alert-panel class="mb-3" title="Set your committee meeting frequency">
        Tell us how often your committee meets in
        <a [routerLink]="'/' + committeeSettingsPath" [queryParams]="{tab: 'configuration'}">Committee Settings</a>
        and the date of the next meeting will be suggested here.
      </app-alert-panel>
    }`
})
export class NextCommitteeMeetingBannerComponent implements OnInit, OnDestroy {

  @Output() plan = new EventEmitter<UpcomingBookedMeeting>();

  private logger: Logger = inject(LoggerFactory).createLogger("NextCommitteeMeetingBannerComponent", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);
  private committeeConfigService = inject(CommitteeConfigService);
  private committeeFileService = inject(CommitteeFileService);
  private videoMeetingsService = inject(VideoMeetingsService);
  private committeeDisplay = inject(CommitteeDisplayService);
  private subscriptions: Subscription[] = [];

  protected meetingFrequencyAmount: number | null = null;
  protected meetingFrequencyUnit: DateRangeUnit | null = null;
  protected suggestedNextDate: number | null = null;
  protected committeeConfigLoaded = false;
  protected upcoming: UpcomingBookedMeeting[] = [];
  private agendaTypes: string[] = [];
  private meetingTypes: CommitteeMeetingType[] = [];

  protected readonly committeeSettingsPath = AdminSettingsPath.COMMITTEE_SETTINGS;

  ngOnInit(): void {
    this.subscriptions.push(this.committeeConfigService.committeeConfigEvents().subscribe(committeeConfig => {
      this.committeeConfigLoaded = true;
      this.meetingFrequencyAmount = committeeConfig?.meetingFrequencyAmount ?? null;
      this.meetingFrequencyUnit = committeeConfig?.meetingFrequencyUnit ?? null;
      this.meetingTypes = committeeConfig?.meetingTypes || [];
      this.agendaTypes = this.meetingTypes
        .map(type => type.agendaFileType)
        .filter(Boolean);
      void this.refresh();
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

  get upcomingHeading(): string {
    return this.upcoming.length === 1 ? "There is a meeting already booked" : "There are meetings already booked";
  }

  suggestedDateValue(): number {
    return this.suggestedNextDate ? this.dateUtils.asValueNoTime(this.suggestedNextDate) : null;
  }

  get suggestedNextDateLabel(): string {
    return this.suggestedNextDate
      ? this.dateUtils.asString(this.suggestedNextDate, null, UIDateFormat.DISPLAY_DATE_NO_COMMA)
      : "";
  }

  dateLabel(value: number): string {
    if (value === this.dateUtils.asValueNoTime(value)) {
      return this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_NO_COMMA);
    } else {
      return this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_AND_TIME);
    }
  }

  showOnCalendar(meeting: UpcomingBookedMeeting): void {
    this.plan.emit({
      ...meeting,
      startTime: this.dateUtils.asValueNoTime(meeting.startTime)
    });
  }

  committeeQuery(meeting: UpcomingBookedMeeting): Record<string, string> {
    if (!meeting.committeeSlug) {
      return {};
    } else if (meeting.composedDocument) {
      return {[StoredValue.DOCUMENT]: meeting.committeeSlug};
    } else {
      return {[StoredValue.FILE]: meeting.committeeSlug};
    }
  }

  private async refresh(): Promise<void> {
    await this.loadUpcoming();
    await this.computeNextMeetingSuggestion();
  }

  private async loadUpcoming(): Promise<void> {
    const fromTime = this.dateUtils.dateTimeNowNoTime().toMillis();
    try {
      const [meetings, files] = await Promise.all([
        this.videoMeetingsService.meetings({sort: {startTime: 1}}),
        this.committeeFileService.all({
          criteria: {eventDate: {$exists: true}},
          sort: {eventDate: 1}
        })
      ]);
      const committeeFiles = files as CommitteeFile[];
      const merged = mergeUpcomingBookedMeetings(meetings, committeeFiles, fromTime, this.agendaTypes);
      const source = merged.length ? merged : this.meetingsFromConfiguredTypes(committeeFiles, fromTime);
      this.upcoming = await Promise.all(source.map(item => this.withCommitteeLinks(item, committeeFiles)));
    } catch (error) {
      this.logger.error("failed to load upcoming meetings", error);
      this.upcoming = [];
    }
  }

  private meetingsFromConfiguredTypes(files: CommitteeFile[], fromTime: number): UpcomingBookedMeeting[] {
    if (!this.hasFrequency) {
      return [];
    } else {
      const fallbackLast = lastMeetingEventDate(files, this.agendaTypes);
      return this.meetingTypes
        .filter(type => type.description && !/^other$/i.test(type.description))
        .map(type => {
          const last = lastFileDateForAgendaType(files, type.agendaFileType);
          const startTime = this.dateUtils.asValueNoTime(last && last >= fromTime
            ? last
            : this.nextDateAfter(last || fallbackLast, fromTime));
          return {title: type.description, startTime};
        })
        .filter(meeting => !!meeting.startTime);
    }
  }

  private nextDateAfter(lastDate: number | null, fromTime: number): number {
    const start = lastDate && lastDate >= fromTime
      ? lastDate
      : this.dateUtils.asDateTime(lastDate || fromTime).plus({
        [this.meetingFrequencyUnit]: this.meetingFrequencyAmount
      }).toMillis();
    const found = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      .map(step => this.dateUtils.asDateTime(start).plus({
        [this.meetingFrequencyUnit]: this.meetingFrequencyAmount * step
      }).toMillis())
      .find(value => value >= fromTime);
    return found || start;
  }

  private async withCommitteeLinks(
    meeting: UpcomingBookedMeeting,
    files: CommitteeFile[]
  ): Promise<UpcomingBookedMeeting> {
    const file = meeting.committeeFileId
      ? files.find(candidate => candidate.id === meeting.committeeFileId)
      : null;
    if (!file) {
      return meeting;
    } else {
      const path = await this.committeeFileService.documentsPagePathFor(file);
      return {
        ...meeting,
        committeePath: path,
        committeeSlug: this.committeeDisplay.committeeFileSlug(file),
        composedDocument: this.committeeDisplay.isComposedDocument(file)
      };
    }
  }

  private async computeNextMeetingSuggestion(): Promise<void> {
    if (!this.hasFrequency || this.upcoming.length) {
      this.suggestedNextDate = null;
    } else {
      try {
        const latest = await this.committeeFileService.all({
          criteria: {eventDate: {$exists: true}},
          sort: {eventDate: -1},
          limit: 50
        });
        const lastDate = lastMeetingEventDate(latest as CommitteeFile[], this.agendaTypes);
        const base = lastDate
          ? this.dateUtils.asDateTime(lastDate)
          : this.dateUtils.asDateTime(this.dateUtils.nowAsValue());
        const interval = {[this.meetingFrequencyUnit]: this.meetingFrequencyAmount} as DurationLikeObject;
        this.suggestedNextDate = base.plus(interval).toMillis();
      } catch (error) {
        this.logger.error("failed to compute next meeting suggestion", error);
        this.suggestedNextDate = null;
      }
    }
  }
}
