import { Component, EventEmitter, inject, OnDestroy, OnInit, Output } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DurationLikeObject } from "luxon";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { CommitteeDisplayService } from "../committee/committee-display.service";
import { DateRangeUnit } from "../../models/search.model";
import { AdminPath, AdminSettingsPath } from "../../models/admin-route-paths.model";
import { UIDateFormat } from "../../models/date-format.model";
import { StoredValue } from "../../models/ui-actions";
import { CommitteeFile, CommitteeFileType } from "../../models/committee.model";
import { UpcomingBookedMeeting } from "../../models/video-meeting.model";
import { lastMeetingEventDate, upcomingBookedMeetings } from "../../functions/upcoming-booked-meetings";
import { videoMeetingDisplayName } from "../../functions/video-meeting-join";
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
              <div>{{ bannerTitle(meeting) }}</div>
              <div class="small">{{ dateLabel(meeting.startTime) }}</div>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button type="button" class="btn btn-primary" (click)="showOnCalendar(meeting); $event.stopPropagation()">Calendar</button>
              @if (meeting.committeePath) {
                <a class="btn btn-quiet" [routerLink]="'/' + meeting.committeePath"
                   [queryParams]="committeeQuery(meeting)" (click)="$event.stopPropagation()">Committee page</a>
              }
              @if (meeting.room) {
                <a class="btn btn-quiet" [routerLink]="'/' + minutesPath + '/' + meeting.room"
                   (click)="$event.stopPropagation()">Minutes</a>
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
  private committeeDisplay = inject(CommitteeDisplayService);
  private subscriptions: Subscription[] = [];

  protected meetingFrequencyAmount: number | null = null;
  protected meetingFrequencyUnit: DateRangeUnit | null = null;
  protected suggestedNextDate: number | null = null;
  protected committeeConfigLoaded = false;
  protected upcoming: UpcomingBookedMeeting[] = [];
  private fileTypes: CommitteeFileType[] = [];

  protected readonly committeeSettingsPath = AdminSettingsPath.COMMITTEE_SETTINGS;
  protected readonly minutesPath = AdminPath.MEETING_MINUTES;

  ngOnInit(): void {
    this.subscriptions.push(this.committeeConfigService.committeeConfigEvents().subscribe(committeeConfig => {
      this.committeeConfigLoaded = true;
      this.meetingFrequencyAmount = committeeConfig?.meetingFrequencyAmount ?? null;
      this.meetingFrequencyUnit = committeeConfig?.meetingFrequencyUnit ?? null;
      this.fileTypes = committeeConfig?.fileTypes ?? [];
      void this.reload();
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

  bannerTitle(meeting: UpcomingBookedMeeting): string {
    return videoMeetingDisplayName(meeting.title, meeting.meetingType);
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

  async reload(): Promise<void> {
    await this.loadUpcoming();
    await this.computeNextMeetingSuggestion();
  }

  private async loadUpcoming(): Promise<void> {
    const fromTime = this.dateUtils.dateTimeNowNoTime().toMillis();
    try {
      const committeeFiles = await this.committeeFileService.all({
        criteria: {eventDate: {$exists: true}},
        sort: {eventDate: 1}
      }) as CommitteeFile[];
      const merged = upcomingBookedMeetings(committeeFiles, fromTime, this.fileTypes);
      this.upcoming = await Promise.all(merged.map(item => this.withCommitteeLinks(item, committeeFiles)));
    } catch (error) {
      this.logger.error("failed to load upcoming meetings", error);
      this.upcoming = [];
    }
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
        composedDocument: this.committeeDisplay.isComposedDocument(file),
        room: meeting.room || file.meeting?.room
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
        const lastDate = lastMeetingEventDate(latest as CommitteeFile[], this.fileTypes);
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
