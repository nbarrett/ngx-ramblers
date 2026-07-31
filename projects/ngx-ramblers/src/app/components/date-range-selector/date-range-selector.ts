import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DateTime } from "luxon";
import { DateRange, DateRangeSlider } from "../date-range-slider/date-range-slider";
import {
  AdvancedSearchPreset,
  DATE_RANGE_DIRECTION_TABS,
  DateRangeDirection,
  DateRangeUnit,
  availableDirectionFor,
  directionApplicableFor,
  presetRangesFor,
  RANGE_UNIT_OPTIONS
} from "../../models/search.model";
import { SectionToggle } from "../../shared/components/section-toggle";
import { SectionToggleTab } from "../../models/section-toggle.model";
import { StoredValue } from "../../models/ui-actions";
import { UiActionsService } from "../../services/ui-actions.service";
import { DateUtilsService } from "../../services/date-utils.service";

const DAY_MILLIS = 24 * 60 * 60 * 1000;
const CUSTOM_PRESET_LABEL = "Custom";

@Component({
  selector: "app-date-range-selector",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [FormsModule, DateRangeSlider, SectionToggle],
  template: `
    <div class="date-range-selector">
      <app-date-range-slider [minDate]="minDate" [maxDate]="maxDate" [range]="range"
                             (rangeChange)="onSliderChange($event)"/>
      <div class="custom-range-row">
        <app-section-toggle class="preset-toggle" fullWidth [tabs]="presetTabs()" [selectedTab]="selectedPresetTab()"
                            (selectedTabChange)="selectPresetTab($event)"/>
        <div class="custom-range-inputs">
          <label class="visually-hidden" for="date-range-custom-amount">Range amount</label>
          <input id="date-range-custom-amount" type="number" min="1" class="form-control custom-range-input"
                 [disabled]="!customActive()" [(ngModel)]="customAmount" [ngModelOptions]="{standalone: true}"
                 (ngModelChange)="onCustomChange()"/>
          <label class="visually-hidden" for="date-range-custom-unit">Range units</label>
          <select id="date-range-custom-unit" class="form-select custom-range-select" [disabled]="!customActive()"
                  [(ngModel)]="customUnit" [ngModelOptions]="{standalone: true}" (ngModelChange)="onCustomChange()">
            @for (unit of units; track unit.value) {
              <option [ngValue]="unit.value">{{ unit.label }}</option>
            }
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .date-range-selector
      display: flex
      flex-direction: column
      gap: 12px
    .custom-range-row
      display: flex
      align-items: center
      gap: 0.5rem
      flex-wrap: nowrap
      min-width: 0
      overflow-x: auto
    .custom-range-inputs
      display: flex
      gap: 0.5rem
      align-items: center
      flex-shrink: 0
      input,
      select
        min-width: 70px
      .custom-range-input
        width: 84px
      .custom-range-select
        width: 110px
  `]
})
export class DateRangeSelector {

  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  protected readonly units = RANGE_UNIT_OPTIONS;
  protected customAmount = 7;
  protected customUnit: DateRangeUnit = DateRangeUnit.DAYS;
  private selectedPresetLabel: string | null = null;

  @Input() set minDate(value: DateTime) {
    this.minDateValue = value;
    this.refreshPresets();
  }

  get minDate(): DateTime {
    return this.minDateValue;
  }

  @Input() set maxDate(value: DateTime) {
    this.maxDateValue = value;
    this.refreshPresets();
  }

  get maxDate(): DateTime {
    return this.maxDateValue;
  }

  private minDateValue: DateTime;
  private maxDateValue: DateTime;
  protected direction: DateRangeDirection = DateRangeDirection.FUTURE;
  protected presets: AdvancedSearchPreset[] = [];
  protected readonly StoredValue = StoredValue;
  @Input()
  set range(value: DateRange) {
    this.rangeValue = value;
    this.selectedPresetLabel = value ? this.matchingPresetLabel(value) : null;
    if (!this.selectedPresetLabel && value) {
      this.applyAmountAndUnitFromRange(value);
    }
  }

  get range(): DateRange {
    return this.rangeValue;
  }

  private rangeValue: DateRange;

  @Output() rangeChange = new EventEmitter<DateRange>();

  onSliderChange(range: DateRange) {
    this.selectedPresetLabel = this.matchingPresetLabel(range);
    if (!this.selectedPresetLabel) {
      this.applyAmountAndUnitFromRange(range);
    }
    this.emit(range);
  }

  applyPreset(preset: AdvancedSearchPreset) {
    this.selectedPresetLabel = preset.label;
    this.emit(preset.range());
  }

  activateCustom() {
    this.selectedPresetLabel = null;
    this.emitCustomRange();
  }

  onCustomChange() {
    this.selectedPresetLabel = null;
    this.emitCustomRange();
  }

  presetTabs(): SectionToggleTab[] {
    return [...this.presets.map(preset => ({value: preset.label, label: preset.label})),
      {value: CUSTOM_PRESET_LABEL, label: CUSTOM_PRESET_LABEL}];
  }

  selectedPresetTab(): string {
    return this.selectedPresetLabel || CUSTOM_PRESET_LABEL;
  }

  selectPresetTab(label: string) {
    const preset = this.presets.find(candidate => candidate.label === label);
    if (preset) {
      this.applyPreset(preset);
    } else {
      this.activateCustom();
    }
  }

  customActive(): boolean {
    return this.selectedPresetLabel === null;
  }

  private emitCustomRange() {
    const amount = Number.isFinite(Number(this.customAmount)) ? Math.max(1, Math.floor(Number(this.customAmount))) : 1;
    this.customAmount = amount;
    const start = this.dateUtils.dateTimeNowNoTime();
    this.emit({from: start.valueOf(), to: start.plus({[this.customUnit]: amount}).valueOf()});
  }

  private emit(range: DateRange) {
    this.rangeValue = range;
    this.rangeChange.emit(range);
  }


  private refreshPresets() {
    this.direction = directionApplicableFor(this.minDateValue, this.maxDateValue)
      ? this.directionFromUrl() : availableDirectionFor(this.maxDateValue);
    this.presets = this.minDateValue && this.maxDateValue
      ? presetRangesFor(this.direction, this.minDateValue, this.maxDateValue)
      : [];
    this.selectedPresetLabel = this.rangeValue ? this.matchingPresetLabel(this.rangeValue) : this.selectedPresetLabel;
  }

  private directionFromUrl(): DateRangeDirection {
    const fromUrl = this.uiActions.queryParameter(StoredValue.DATE_RANGE_DIRECTION);
    return DATE_RANGE_DIRECTION_TABS.find(tab => tab.value === fromUrl)?.value || DateRangeDirection.FUTURE;
  }

  private matchingPresetLabel(range: DateRange): string | null {
    const matched = this.presets.find(preset => this.rangesMatch(preset.range(), range));
    return matched ? matched.label : null;
  }

  private rangesMatch(left: DateRange, right: DateRange): boolean {
    return Math.abs(left.from - right.from) < DAY_MILLIS && Math.abs(left.to - right.to) < DAY_MILLIS;
  }

  private applyAmountAndUnitFromRange(range: DateRange) {
    const days = Math.max(1, Math.round((range.to - range.from) / DAY_MILLIS));
    if (days % 365 === 0) {
      this.customAmount = days / 365;
      this.customUnit = DateRangeUnit.YEARS;
    } else if (days % 30 === 0) {
      this.customAmount = days / 30;
      this.customUnit = DateRangeUnit.MONTHS;
    } else if (days % 7 === 0) {
      this.customAmount = days / 7;
      this.customUnit = DateRangeUnit.WEEKS;
    } else {
      this.customAmount = days;
      this.customUnit = DateRangeUnit.DAYS;
    }
  }
}
