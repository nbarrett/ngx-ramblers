import {inject} from "@angular/core";
import {NgxLoggerLevel} from "ngx-logger";
import {LoggerFactory} from "../logger-factory.service";
import {EmailComposerState, ReleaseNoteUpdateCoverage, ReleaseNoteUpdateCategory, ReleaseNoteUpdateConfiguration, ReleaseNoteUpdateDefaults, ReleaseNoteUpdateOption, ReleaseNoteUpdateSettings, ReleaseNoteUpdateWindow, PreviousReleaseNoteUpdate, RecipientMode} from "../../models/email-composer.model";
import {defaultReleaseNoteUpdateDefaults, defaultReleaseNoteUpdateSettings} from "../../functions/email-composer";
import {releaseNoteUpdateWindowFrom} from "../../functions/release-note-update-window";
import {DateUtilsService} from "../date-utils.service";
import {EmailCompositionsService} from "./email-compositions.service";
import {ReleaseNoteUpdateConfigService} from "./release-note-update-config.service";
import {dateRangeSliderBounds, DateRange} from "../../components/date-range-slider/date-range-slider";
import {RANGE_UNIT_OPTIONS} from "../../models/search.model";
import {DateTime} from "luxon";
import {Injectable} from "@angular/core";

@Injectable()
export class EmailComposerUpdateSettingsService {
  private dateUtils = inject(DateUtilsService);
  private compositionsService = inject(EmailCompositionsService);
  private releaseNoteUpdateConfigService = inject(ReleaseNoteUpdateConfigService);
  private logger = inject(LoggerFactory).createLogger("EmailComposerUpdateSettingsService", NgxLoggerLevel.ERROR);
  readonly rangeUnitOptions = RANGE_UNIT_OPTIONS;

  releaseNoteUpdateSettingsExpanded = false;

  releaseNoteUpdateDefaults: ReleaseNoteUpdateDefaults = defaultReleaseNoteUpdateDefaults();

  releaseNoteUpdateConfiguration: ReleaseNoteUpdateConfiguration = {defaultProfileId: "default", profiles: []};

  selectedReleaseNoteUpdateProfileId = "default";

  readonly releaseNoteUpdateCategoryOptions: ReleaseNoteUpdateOption<ReleaseNoteUpdateCategory>[] = [
    {value: ReleaseNoteUpdateCategory.EMAIL, label: "Email features", hint: "Inbox, newsletters, subscriptions, sending, delivery and member communications."},
    {value: ReleaseNoteUpdateCategory.NON_EMAIL, label: "Non-email features", hint: "Walks, events, website content, maps, images and social media."},
    {value: ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT, label: "Platform management", hint: "Managing websites, environments, setup and administration across NGX."}
  ];

  readonly releaseNoteUpdateCoverageOptions: ReleaseNoteUpdateOption<ReleaseNoteUpdateCoverage>[] = [
    {value: ReleaseNoteUpdateCoverage.COMPREHENSIVE, label: "Comprehensive", hint: "Cover every material consumer-facing capability in the selected period."},
    {value: ReleaseNoteUpdateCoverage.HIGHLIGHTS, label: "Highlights only", hint: "Choose the changes most likely to matter to volunteers and members."}
  ];

  previousReleaseNoteUpdate: PreviousReleaseNoteUpdate | null = null;

  previousReleaseNoteUpdateExists(state: EmailComposerState, currentDraftId: string | null): boolean {
    return !!this.previousReleaseNoteUpdate || !!state.releaseNoteUpdate?.previousDigestId;
  }

  releaseNoteUpdateWindowTitle(state: EmailComposerState, currentDraftId: string | null): string {
    const previousSentAt = this.previousReleaseNoteUpdate?.sentAt ?? state.releaseNoteUpdate?.previousSentAt;
    const sentAt = previousSentAt ? this.dateUtils.displayDate(previousSentAt) : "an unrecorded date";
    return this.previousReleaseNoteUpdateExists(state, currentDraftId) ? `Last update went out on ${sentAt}` : "This is the first update";
  }

  releaseNoteUpdateWindowDescription(state: EmailComposerState, currentDraftId: string | null): string {
    const range = this.releaseNoteUpdatePeriodDescription(state, currentDraftId) ?? "the dates shown below";
    return this.previousReleaseNoteUpdateExists(state, currentDraftId)
      ? `Covering ${range}. ${this.releaseNoteUpdateSettings(state, currentDraftId).excludePreviouslyIncluded ? "Changes already included in the previous update are left out." : "Release notes from the previous update may be included again."}`
      : `Covering ${range}.`;
  }

  previousReleaseNoteUpdateSentDate(state: EmailComposerState, currentDraftId: string | null): string {
    return this.previousReleaseNoteUpdate?.sentAt
      ? this.dateUtils.displayDate(this.previousReleaseNoteUpdate.sentAt)
      : "an unrecorded date";
  }

  releaseNoteUpdatePeriodDescription(state: EmailComposerState, currentDraftId: string | null): string | null {
    const from = state.releaseNoteUpdate?.fromMillis;
    const to = state.releaseNoteUpdate?.toMillis;
    return from && to ? `${this.dateUtils.displayDate(from)} to ${this.dateUtils.displayDate(to)}` : null;
  }

  releaseNoteUpdateSliderMinDate: DateTime = this.dateUtils.dateTimeNow().minus({years: 2}).startOf("day");

  releaseNoteUpdateSliderMaxDate: DateTime = this.dateUtils.dateTimeNow().endOf("day");

  digestSliderRange: DateRange | null = null;

  releaseNoteUpdateSliderRange(state: EmailComposerState, currentDraftId: string | null): DateRange {
    const from = state.releaseNoteUpdate?.fromMillis ?? this.releaseNoteUpdateSliderMinDate.toMillis();
    const to = state.releaseNoteUpdate?.toMillis ?? this.releaseNoteUpdateSliderMaxDate.toMillis();
    if (!this.digestSliderRange || this.digestSliderRange.from !== from || this.digestSliderRange.to !== to) {
      this.digestSliderRange = {from, to};
    }
    return this.digestSliderRange;
  }

  releaseNoteUpdateSettings(state: EmailComposerState, currentDraftId: string | null): ReleaseNoteUpdateSettings {
    if (!state.releaseNoteUpdate) {
      state.releaseNoteUpdate = this.releaseNoteUpdateSettingsFromSelectedProfile(state, currentDraftId);
      this.applyReleaseNoteUpdateWindow(state, currentDraftId);
    }
    return state.releaseNoteUpdate;
  }

  releaseNoteUpdateCategoryIsLastSelected(state: EmailComposerState, currentDraftId: string | null, category: ReleaseNoteUpdateCategory): boolean {
    const categories = this.releaseNoteUpdateSettings(state, currentDraftId).categories;
    return categories.length === 1 && categories.includes(category);
  }

  setReleaseNoteUpdateCategory(state: EmailComposerState, currentDraftId: string | null, category: ReleaseNoteUpdateCategory, selected: boolean): void {
    const categories = this.releaseNoteUpdateSettings(state, currentDraftId).categories;
    this.releaseNoteUpdateSettings(state, currentDraftId).categories = selected
      ? categories.includes(category) ? categories : categories.concat(category)
      : categories.filter(candidate => candidate !== category);
  }

  releaseNoteUpdateCoverageHint(state: EmailComposerState, currentDraftId: string | null): string {
    return this.releaseNoteUpdateCoverageOptions.find(option => option.value === this.releaseNoteUpdateSettings(state, currentDraftId).coverage)?.hint ?? "";
  }

  releaseNoteUpdateSettingsSummary(state: EmailComposerState, currentDraftId: string | null): string {
    const settings = this.releaseNoteUpdateSettings(state, currentDraftId);
    const categories = this.releaseNoteUpdateCategoryOptions
      .filter(option => settings.categories.includes(option.value))
      .map(option => option.label)
      .join(", ");
    const periodUnitLabel = this.rangeUnitOptions.find(option => option.value === settings.periodUnit)?.label.toLowerCase() ?? settings.periodUnit;
    const periodUnit = settings.periodAmount === 1 ? periodUnitLabel.replace(/s$/, "") : periodUnitLabel;
    const imageSummary = settings.includeImages ? "Suitable release-note images included." : "No images.";
    return `Report on information from the last ${settings.periodAmount} ${periodUnit}. ${categories}. ${this.releaseNoteUpdateCoverageOptions.find(option => option.value === settings.coverage)?.label ?? ""}. ${imageSummary}`;
  }

  applyReleaseNoteUpdateWindow(state: EmailComposerState, currentDraftId: string | null): void {
    const settings = this.releaseNoteUpdateSettingsWithoutSeedingWindow(state, currentDraftId);
    const window = releaseNoteUpdateWindowFrom(
      settings.periodAmount,
      settings.periodUnit,
      this.dateUtils.dateTimeNow().toMillis()
    );
    this.applyReleaseNoteUpdateDates(state, currentDraftId, window);
  }

  releaseNoteUpdateSettingsWithoutSeedingWindow(state: EmailComposerState, currentDraftId: string | null): ReleaseNoteUpdateSettings {
    if (!state.releaseNoteUpdate) {
      state.releaseNoteUpdate = this.releaseNoteUpdateSettingsFromSelectedProfile(state, currentDraftId);
    }
    return state.releaseNoteUpdate;
  }

  releaseNoteUpdateSettingsFromSelectedProfile(state: EmailComposerState, currentDraftId: string | null): ReleaseNoteUpdateSettings {
    const defaults = defaultReleaseNoteUpdateSettings();
    const profile = this.releaseNoteUpdateConfiguration.profiles.find(candidate => candidate.id === this.selectedReleaseNoteUpdateProfileId);
    return {
      ...defaults,
      ...this.releaseNoteUpdateDefaults,
      profileId: profile?.id ?? this.selectedReleaseNoteUpdateProfileId,
      periodAmount: profile?.periodAmount ?? defaults.periodAmount,
      periodUnit: profile?.periodUnit ?? defaults.periodUnit
    };
  }

  async loadReleaseNoteUpdateDefaults(state: EmailComposerState, currentDraftId: string | null): Promise<void> {
    try {
      this.releaseNoteUpdateConfiguration = await this.releaseNoteUpdateConfigService.loadConfiguration();
      this.selectedReleaseNoteUpdateProfileId = this.releaseNoteUpdateConfiguration.defaultProfileId;
      this.releaseNoteUpdateDefaults = this.releaseNoteUpdateConfiguration.profiles.find(profile => profile.id === this.selectedReleaseNoteUpdateProfileId)?.defaults ?? defaultReleaseNoteUpdateDefaults();
    } catch (error) {
      this.logger.error("loadReleaseNoteUpdateDefaults failed", error);
      this.releaseNoteUpdateDefaults = defaultReleaseNoteUpdateDefaults();
    }
  }

  async applyReleaseNoteUpdateProfile(state: EmailComposerState, currentDraftId: string | null, profileId: string): Promise<void> {
    const profile = this.releaseNoteUpdateConfiguration.profiles.find(candidate => candidate.id === profileId);
    if (profile) {
      this.selectedReleaseNoteUpdateProfileId = profile.id;
      this.releaseNoteUpdateDefaults = profile.defaults;
      state.releaseNoteUpdate = {
        ...this.releaseNoteUpdateSettings(state, currentDraftId),
        ...profile.defaults,
        profileId: profile.id,
        periodAmount: profile.periodAmount,
        periodUnit: profile.periodUnit
      };
      await this.loadPreviousReleaseNoteUpdate(state, currentDraftId);
      this.applyReleaseNoteUpdateWindow(state, currentDraftId);
    }
  }

  applyReleaseNoteUpdateDates(state: EmailComposerState, currentDraftId: string | null, window: ReleaseNoteUpdateWindow): void {
    if (state.releaseNoteUpdate) {
      state.releaseNoteUpdate.fromMillis = window.fromMillis;
      state.releaseNoteUpdate.toMillis = window.toMillis;
      const {minDate, maxDate} = dateRangeSliderBounds(
        this.dateUtils.asDateTime(window.fromMillis),
        this.dateUtils.asDateTime(window.toMillis)
      );
      if (!this.releaseNoteUpdateSliderMinDate.hasSame(minDate, "day")) {
        this.releaseNoteUpdateSliderMinDate = minDate;
      }
      if (!this.releaseNoteUpdateSliderMaxDate.hasSame(maxDate, "day")) {
        this.releaseNoteUpdateSliderMaxDate = maxDate;
      }
    }
  }

  onReleaseNoteUpdatePeriodAmountChange(state: EmailComposerState, currentDraftId: string | null, amount: number): void {
    const numeric = Number(amount);
    const settings = this.releaseNoteUpdateSettings(state, currentDraftId);
    settings.periodAmount = numeric >= 1 ? numeric : 1;
    this.applyReleaseNoteUpdateWindow(state, currentDraftId);
  }

  onReleaseNoteUpdatePeriodUnitChange(state: EmailComposerState, currentDraftId: string | null, unit: string): void {
    const matched = RANGE_UNIT_OPTIONS.find(option => option.value === unit);
    if (matched) {
      this.releaseNoteUpdateSettings(state, currentDraftId).periodUnit = matched.value;
      this.applyReleaseNoteUpdateWindow(state, currentDraftId);
    }
  }

  onReleaseNoteUpdateDateRangeChange(state: EmailComposerState, currentDraftId: string | null, range: DateRange): void {
    const settings = this.releaseNoteUpdateSettings(state, currentDraftId);
    settings.fromMillis = range.from;
    settings.toMillis = range.to;
  }

  async loadPreviousReleaseNoteUpdate(state: EmailComposerState, currentDraftId: string | null): Promise<void> {
    const profile = this.releaseNoteUpdateConfiguration.profiles.find(candidate => candidate.id === this.selectedReleaseNoteUpdateProfileId);
    this.previousReleaseNoteUpdate = await this.compositionsService.previousReleaseNoteUpdate(
      profile?.id ?? this.selectedReleaseNoteUpdateProfileId,
      profile?.recipientMode ?? RecipientMode.SELECTED_MEMBERS,
      profile?.selectedListId ?? null,
      currentDraftId
    );
    const existing = this.releaseNoteUpdateSettings(state, currentDraftId);
    state.releaseNoteUpdate = {
      ...existing,
      previousDigestId: this.previousReleaseNoteUpdate?.id ?? null,
      previousSentAt: this.previousReleaseNoteUpdate?.sentAt ?? null,
      previousWindowEnd: this.previousReleaseNoteUpdate?.windowEnd ?? null,
      previouslyIncludedPaths: this.previousReleaseNoteUpdate?.includedPaths ?? []
    };
    if ((this.previousReleaseNoteUpdate?.selectedMemberIds ?? []).length && !(state.selectedMemberIds ?? []).length) {
      state.selectedMemberIds = [...this.previousReleaseNoteUpdate.selectedMemberIds];
    }
  }
}
