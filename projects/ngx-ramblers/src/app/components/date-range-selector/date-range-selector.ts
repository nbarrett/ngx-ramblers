import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DateTime } from "luxon";
import { DateRange, DateRangeSlider } from "../date-range-slider/date-range-slider";
import {
  AdvancedSearchPreset,
  DateRangeDirection,
  DateRangeUnit,
  availableDirectionFor,
  directionApplicableFor,
  presetRangesFor,
  RANGE_UNIT_OPTIONS
} from "../../models/search.model";
import { SectionToggle } from "../../shared/components/section-toggle";
import { SectionToggleTab } from "../../models/section-toggle.model";
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
      <app-date-range-slider [minDate]="scaledMinDate" [maxDate]="scaledMaxDate" [range]="range"
                             (rangeChange)="onSliderChange($event)"/>
      <div class="custom-range-row">
        <app-section-toggle class="preset-toggle" fullWidth stackOnMobile [tabs]="presetTabs" [selectedTab]="selectedPresetTab()"
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
    @media (max-width: 768px)
      .custom-range-row
        flex-direction: column
        align-items: stretch
        overflow-x: visible
      .custom-range-inputs
        display: grid
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)
        width: 100%
        .custom-range-input,
        .custom-range-select
          width: 100%
  `]
})
export class DateRangeSelector {

  private dateUtils = inject(DateUtilsService);
  protected readonly units = RANGE_UNIT_OPTIONS;
  protected customAmount = 7;
  protected customUnit: DateRangeUnit = DateRangeUnit.DAYS;
  private selectedPresetLabel: string | null = null;
  protected presetTabs: SectionToggleTab[] = [{value: CUSTOM_PRESET_LABEL, label: CUSTOM_PRESET_LABEL}];
  private dataMinDate: DateTime;
  private dataMaxDate: DateTime;
  protected scaledMinDate: DateTime;
  protected scaledMaxDate: DateTime;
  private directionValue: DateRangeDirection = DateRangeDirection.FUTURE;
  private directionReady = false;
  private presets: AdvancedSearchPreset[] = [];
  private rangeValue: DateRange;
  private applyFullSpanWhenBoundsReady = false;

  @Input() set minDate(value: DateTime) {
    this.dataMinDate = value;
    this.refreshPresets(false);
  }

  get minDate(): DateTime {
    return this.dataMinDate;
  }

  @Input() set maxDate(value: DateTime) {
    this.dataMaxDate = value;
    this.refreshPresets(false);
  }

  get maxDate(): DateTime {
    return this.dataMaxDate;
  }

  @Input() set direction(value: DateRangeDirection) {
    const next = value || DateRangeDirection.FUTURE;
    if (next !== this.directionValue) {
      const userChangedDirection = this.directionReady;
      this.directionValue = next;
      this.refreshPresets(userChangedDirection);
    }
    this.directionReady = true;
  }

  get direction(): DateRangeDirection {
    return this.directionValue;
  }

  @Input()
  set range(value: DateRange) {
    this.rangeValue = value ? this.clampRange(value) : value;
    this.selectedPresetLabel = this.rangeValue ? this.matchingPresetLabel(this.rangeValue) : null;
    if (!this.selectedPresetLabel && this.rangeValue) {
      this.applyAmountAndUnitFromRange(this.rangeValue);
    }
  }

  get range(): DateRange {
    return this.rangeValue;
  }

  @Output() rangeChange = new EventEmitter<DateRange>();

  onSliderChange(range: DateRange) {
    const clamped = this.clampRange(range);
    this.selectedPresetLabel = this.matchingPresetLabel(clamped);
    if (!this.selectedPresetLabel) {
      this.applyAmountAndUnitFromRange(clamped);
    }
    this.emit(clamped);
  }

  applyPreset(preset: AdvancedSearchPreset) {
    this.selectedPresetLabel = preset.label;
    this.emit(this.clampRange(preset.range()));
  }

  activateCustom() {
    this.selectedPresetLabel = null;
    this.emitCustomRange();
  }

  onCustomChange() {
    this.selectedPresetLabel = null;
    this.emitCustomRange();
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
    if (this.directionValue === DateRangeDirection.PAST) {
      this.emit(this.clampRange({from: start.minus({[this.customUnit]: amount}).valueOf(), to: start.valueOf()}));
    } else {
      this.emit(this.clampRange({from: start.valueOf(), to: start.plus({[this.customUnit]: amount}).valueOf()}));
    }
  }

  private emit(range: DateRange) {
    this.rangeValue = range;
    this.rangeChange.emit(range);
  }

  private refreshPresets(directionChanged: boolean) {
    if (directionChanged) {
      this.applyFullSpanWhenBoundsReady = true;
    }
    this.updateScaledBounds();
    if (!this.scaledMinDate || !this.scaledMaxDate) {
      this.presets = [];
      this.rebuildPresetTabs();
    } else {
      const effectiveDirection = directionApplicableFor(this.dataMinDate, this.dataMaxDate)
        ? this.directionValue
        : availableDirectionFor(this.dataMaxDate);
      this.presets = presetRangesFor(effectiveDirection, this.scaledMinDate, this.scaledMaxDate);
      this.rebuildPresetTabs();
      if (this.applyFullSpanWhenBoundsReady) {
        this.applyFullSpanWhenBoundsReady = false;
        this.applyFullSpanPresetForDirection();
      } else if (this.rangeValue) {
        const clamped = this.clampRange(this.rangeValue);
        if (clamped.from !== this.rangeValue.from || clamped.to !== this.rangeValue.to) {
          this.emit(clamped);
        }
        this.selectedPresetLabel = this.matchingPresetLabel(clamped);
      }
    }
  }

  private updateScaledBounds() {
    if (!this.dataMinDate || !this.dataMaxDate) {
      this.scaledMinDate = this.dataMinDate;
      this.scaledMaxDate = this.dataMaxDate;
    } else {
      const today = this.dateUtils.dateTimeNowNoTime();
      const effectiveDirection = directionApplicableFor(this.dataMinDate, this.dataMaxDate)
        ? this.directionValue
        : availableDirectionFor(this.dataMaxDate);
      if (effectiveDirection === DateRangeDirection.FUTURE) {
        this.scaledMinDate = DateTime.max(this.dataMinDate, today);
        this.scaledMaxDate = this.dataMaxDate;
      } else if (effectiveDirection === DateRangeDirection.PAST) {
        this.scaledMinDate = this.dataMinDate;
        this.scaledMaxDate = DateTime.min(this.dataMaxDate, today);
      } else {
        this.scaledMinDate = this.dataMinDate;
        this.scaledMaxDate = this.dataMaxDate;
      }
      if (this.scaledMinDate > this.scaledMaxDate) {
        this.scaledMinDate = this.scaledMaxDate;
      }
    }
  }

  private clampRange(range: DateRange): DateRange {
    if (!range || !this.scaledMinDate || !this.scaledMaxDate) {
      return range;
    } else {
      const minMillis = this.scaledMinDate.toMillis();
      const maxMillis = this.scaledMaxDate.toMillis();
      const boundedFrom = Math.max(minMillis, Math.min(maxMillis, range.from));
      const boundedTo = Math.max(minMillis, Math.min(maxMillis, range.to));
      return {
        from: Math.min(boundedFrom, boundedTo),
        to: Math.max(boundedFrom, boundedTo)
      };
    }
  }

  private rebuildPresetTabs() {
    this.presetTabs = [
      ...this.presets.map(preset => ({value: preset.label, label: preset.label})),
      {value: CUSTOM_PRESET_LABEL, label: CUSTOM_PRESET_LABEL}
    ];
  }

  private applyFullSpanPresetForDirection() {
    const fullSpan = this.presets.find(preset => preset.allTime) || this.presets[this.presets.length - 1];
    if (fullSpan) {
      this.applyPreset(fullSpan);
    }
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
