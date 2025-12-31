import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";
import { DateUtilsService } from "../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DateTime } from "luxon";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";

export interface DateRange {
  from: number;
  to: number;
}

@Component({
  selector: "app-date-range-slider",
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  template: `
    <div class="date-range-slider">
      <div class="mb-1">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="range-label">
            <fa-icon [icon]="faCalendar" class="me-2"/>
            <span class="date-label">Date Range</span>
            <span class="ms-2">From <strong>{{ fromDateDisplay }}</strong></span>
          </div>
          <div class="range-label text-end">
            To <strong>{{ toDateDisplay }}</strong>
          </div>
        </div>

        <div class="range-slider-container pb-0">
          <div class="range-slider-row">
            <span class="range-edge text-start">{{ minDateLabel }}</span>
            <div class="slider-wrapper">
              <input
                type="range"
                class="range-slider range-from"
                [min]="minValue"
                [max]="maxValue"
                [(ngModel)]="fromValue"
                (ngModelChange)="onFromChange()"
                step="1"/>
              <input
                type="range"
                class="range-slider range-to"
                [min]="minValue"
                [max]="maxValue"
                [(ngModel)]="toValue"
                (ngModelChange)="onToChange()"
                step="1"/>
              <div class="slider-track">
                <div class="slider-fill" [style.left.%]="fillLeft" [style.width.%]="fillWidth"></div>
              </div>
            </div>
            <span class="range-edge text-end">{{ maxDateLabel }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .date-range-slider
      .date-label
        font-weight: 600
        font-size: 0.9rem
        color: var(--ramblers-colour-black)

      .range-labels
        display: flex
        justify-content: space-between
        align-items: center
        gap: 0.5rem

      .range-label
        font-weight: 600
        letter-spacing: 0.02em
        font-size: 0.8rem
        color: #6c757d
        strong
          font-size: 0.95rem
          color: var(--ramblers-colour-black)

      .range-slider-container
        position: relative
        padding: 0

      .range-slider-row
        display: flex
        align-items: center
        gap: 1rem

      .range-edge
        flex: 0 0 120px
        font-size: 0.875rem
        color: #6c757d
        line-height: 1
        align-self: center

      .slider-wrapper
        position: relative
        flex: 1
        height: 6px

      .slider-track
        position: absolute
        top: 50%
        left: 0
        right: 0
        height: 6px
        background-color: #dee2e6
        border-radius: 3px
        transform: translateY(-50%)
        pointer-events: none

      .slider-fill
        position: absolute
        height: 100%
        background-color: var(--ramblers-colour-sunrise)
        border-radius: 3px
        transition: all 0.1s ease

      .range-slider
        position: absolute
        width: 100%
        height: 6px
        top: 50%
        transform: translateY(-50%)
        -webkit-appearance: none
        appearance: none
        background: transparent
        outline: none
        pointer-events: none

      .range-slider::-webkit-slider-thumb
        -webkit-appearance: none
        appearance: none
        width: 20px
        height: 20px
        background: var(--ramblers-colour-sunrise)
        border: 2px solid #fff
        border-radius: 50%
        cursor: pointer
        pointer-events: auto
        box-shadow: 0 2px 4px rgba(0,0,0,0.2)
        position: relative
        z-index: 3

      .range-slider::-moz-range-thumb
        width: 20px
        height: 20px
        background: var(--ramblers-colour-sunrise)
        border: 2px solid #fff
        border-radius: 50%
        cursor: pointer
        pointer-events: auto
        box-shadow: 0 2px 4px rgba(0,0,0,0.2)

      .range-slider.range-from
        z-index: 3

      .range-slider.range-to
        z-index: 4

      .range-slider::-webkit-slider-thumb:hover,
      .range-slider::-moz-range-thumb:hover
        background: var(--ramblers-colour-sunrise-hover-background)

  `]
})
export class DateRangeSlider implements OnInit, OnChanges, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("DateRangeSlider", NgxLoggerLevel.OFF);
  private dateUtils = inject(DateUtilsService);
  private initialized = false;
  private rangeInputSet = false;
  private pendingExternalRange: DateRange | null = null;
  private rangeChangeSubject = new Subject<DateRange>();
  private rangeChangeSubscription = this.rangeChangeSubject
    .pipe(debounceTime(300))
    .subscribe(range => this.rangeChange.emit(range));

  @Input() minDate?: DateTime;
  @Input() maxDate?: DateTime;
  @Input()
  set range(value: DateRange | null | undefined) {
    this.rangeInputSet = true;
    this.pendingExternalRange = value ?? null;
    if (this.initialized) {
      this.applyExternalRange();
    }
  }
  @Output() rangeChange = new EventEmitter<DateRange>();

  faCalendar = faCalendar;

  minValue = 0;
  maxValue = 365;
  fromValue = 0;
  toValue = 30;
  private baseDate: DateTime;

  ngOnInit() {
    this.configureBounds();
    this.initialized = true;
    if (this.rangeInputSet) {
      this.applyExternalRange();
    } else {
      this.clearRange(false);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.initialized) {
      return;
    }
    if (changes["minDate"] || changes["maxDate"]) {
      this.configureBounds();
      if (this.rangeInputSet) {
        this.applyExternalRange();
      } else {
        this.clearRange(false);
      }
    }
  }

  get minDateLabel(): string {
    return this.minDate?.toFormat("dd MMM yyyy") || "";
  }

  get maxDateLabel(): string {
    return this.maxDate?.toFormat("dd MMM yyyy") || "";
  }

  get fromDateDisplay(): string {
    const date = this.minDate?.plus({ days: this.fromValue });
    return date?.toFormat("dd MMM yyyy") || "";
  }

  get toDateDisplay(): string {
    const date = this.minDate?.plus({ days: this.toValue });
    return date?.toFormat("dd MMM yyyy") || "";
  }

  get fillLeft(): number {
    return (this.fromValue / this.maxValue) * 100;
  }

  get fillWidth(): number {
    return ((this.toValue - this.fromValue) / this.maxValue) * 100;
  }

  onFromChange() {
    if (this.fromValue > this.toValue) {
      this.fromValue = this.toValue;
    }
    this.emitChange();
  }

  onToChange() {
    if (this.toValue < this.fromValue) {
      this.toValue = this.fromValue;
    }
    this.emitChange();
  }

  setRange(range: DateRange, emit = true) {
    const fromDate = DateTime.fromMillis(range.from);
    const toDate = DateTime.fromMillis(range.to);
    const boundedFrom = fromDate < this.minDate ? this.minDate : fromDate;
    const boundedTo = toDate > this.maxDate ? this.maxDate : toDate;

    this.fromValue = Math.max(0, Math.floor(boundedFrom.diff(this.minDate!, "days").days));
    this.toValue = Math.max(this.fromValue, Math.floor(boundedTo.diff(this.minDate!, "days").days));
    if (emit) {
      this.emitChange();
    }
  }

  clearRange(emit = true) {
    this.fromValue = this.minValue;
    this.toValue = this.maxValue;
    if (emit) {
      this.emitChange();
    }
  }

  private applyExternalRange() {
    if (this.pendingExternalRange) {
      this.setRange(this.pendingExternalRange, false);
    } else {
      this.clearRange(false);
    }
  }

  private emitChange() {
    const fromDate = this.minDate?.plus({ days: this.fromValue });
    const toDate = this.minDate?.plus({ days: this.toValue });

    if (fromDate && toDate) {
      this.rangeChangeSubject.next({
        from: fromDate.toMillis(),
        to: toDate.toMillis()
      });
    }
  }

  ngOnDestroy() {
    this.rangeChangeSubscription.unsubscribe();
  }

  private configureBounds() {
    const fallback = DateTime.now().startOf("day");
    if (!this.minDate) {
      this.minDate = fallback;
    }
    this.baseDate = this.minDate;
    if (!this.maxDate) {
      this.maxDate = this.minDate.plus({ years: 2 });
    }
    if (this.maxDate < this.minDate) {
      this.maxDate = this.minDate.plus({ days: 1 });
    }
    const totalDays = Math.max(0, Math.ceil(this.maxDate.diff(this.minDate, "days").days));
    this.maxValue = totalDays;
    this.fromValue = Math.min(this.fromValue, this.maxValue);
    this.toValue = Math.max(this.fromValue, Math.min(this.toValue, this.maxValue));
  }
}
