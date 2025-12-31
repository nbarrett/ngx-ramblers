import { Component, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DistanceRange, DistanceUnit } from "../../models/search.model";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";

@Component({
  selector: "app-distance-range-slider",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="distance-range-slider">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <label class="form-label mb-0">{{ label }}</label>
        <div class="distance-values">
          @if (singleThumb) {
            <span class="selected-range">{{ highDisplay }} {{ unitDisplay }}</span>
          } @else {
            <span class="selected-range">{{ lowDisplay }} - {{ highDisplay }} {{ unitDisplay }}</span>
          }
        </div>
      </div>
      <div class="range-slider-container pb-0">
        <div class="range-slider-row">
            <span class="range-edge text-start">{{ minValue }} {{ unitDisplay }}</span>
            <div class="slider-wrapper">
              @if (!singleThumb) {
                <input
                  type="range"
                  class="range-slider range-low"
                  [min]="minValue"
                  [max]="maxValue"
                  step="0.5"
                  [(ngModel)]="lowValue"
                  (ngModelChange)="onLowChange()"/>
              }
              <input
                type="range"
                class="range-slider range-high"
                [min]="minValue"
                [max]="maxValue"
                step="0.5"
                [(ngModel)]="highValue"
                (ngModelChange)="onHighChange()"/>
              <div class="slider-track">
                <div class="slider-fill" [style.left.%]="fillLeft" [style.width.%]="fillWidth"></div>
              </div>
            </div>
            <span class="range-edge text-end">{{ maxValue }} {{ unitDisplay }}</span>
            <div class="btn-group btn-group-sm ms-2" role="group">
              <button
                type="button"
                class="btn btn-unit"
                [class.active]="distanceUnit === DistanceUnit.MILES"
                (click)="setDistanceUnit(DistanceUnit.MILES)">
                Miles
              </button>
              <button
                type="button"
                class="btn btn-unit"
                [class.active]="distanceUnit === DistanceUnit.KILOMETERS"
                (click)="setDistanceUnit(DistanceUnit.KILOMETERS)">
                km
              </button>
            </div>
          </div>
        </div>
      </div>
  `,
  styles: [`
    .distance-range-slider
      .distance-values
        font-size: 0.85rem

      .selected-range
        font-size: 0.8rem
        color: #6c757d

      .btn-unit
        padding: 0.25rem 0.75rem
        font-size: 0.875rem
        border: 1px solid #dee2e6
        background-color: #fff
        color: #495057

      .btn-unit.active
        background-color: var(--ramblers-colour-sunrise)
        border-color: var(--ramblers-colour-sunrise)
        color: var(--ramblers-colour-black)

      .range-labels
        display: flex
        justify-content: space-between
        font-size: 0.75rem
        color: #6c757d
        strong
          font-size: 0.9rem
          color: var(--ramblers-colour-black)

      .range-slider-container
        padding: 0

      .range-slider-row
        display: flex
        align-items: center
        gap: 0.5rem

      .range-edge
        flex: 0 0 70px
        font-size: 0.75rem

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

      .range-slider::-webkit-slider-thumb:hover,
      .range-slider::-moz-range-thumb:hover
        background: var(--ramblers-colour-sunrise-hover-background)

      .range-slider.range-low
        z-index: 3

      .range-slider.range-high
        z-index: 4
  `]
})
export class DistanceRangeSlider implements OnInit, OnChanges, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("DistanceRangeSlider", NgxLoggerLevel.OFF);
  private rangeChangeSubject = new Subject<DistanceRange>();
  private rangeChangeSubscription = this.rangeChangeSubject
    .pipe(debounceTime(300))
    .subscribe(range => this.rangeChange.emit(range));
  protected readonly DistanceUnit = DistanceUnit;

  @Input()
  set minValue(value: number) {
    this._minValue = value;
    this.configureBounds();
  }
  get minValue() {
    return this._minValue;
  }

  @Input()
  set maxValue(value: number) {
    this._maxValue = value;
    this.configureBounds();
  }
  get maxValue() {
    return this._maxValue;
  }

  @Input()
  set range(value: DistanceRange | null | undefined) {
    this.pendingRange = value ?? null;
    if (this.initialized) {
      this.applyExternalRange();
    }
  }
  @Input() singleThumb = false;
  @Input() label = "Distance";
  @Output() rangeChange = new EventEmitter<DistanceRange>();

  private pendingRange: DistanceRange | null = null;
  private initialized = false;
  private _minValue = 0;
  private _maxValue = 50;
  private _maxValueKm = 80;
  lowValue = 0;
  highValue = 50;
  distanceUnit = DistanceUnit.MILES;

  ngOnInit() {
    this.configureBounds();
    this.initialized = true;
    this.applyExternalRange();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.initialized) {
      return;
    }
    if (changes["minValue"] || changes["maxValue"]) {
      this.configureBounds();
      this.applyExternalRange();
    }
  }

  get lowDisplay(): string {
    return this.lowValue.toFixed(1);
  }

  get highDisplay(): string {
    return this.highValue.toFixed(1);
  }

  get unitDisplay(): string {
    return this.distanceUnit === DistanceUnit.MILES ? "mi" : "km";
  }

  get fillLeft(): number {
    if (this.singleThumb) {
      return 0;
    } else {
      return ((this.lowValue - this.minValue) / (this.maxValue - this.minValue)) * 100;
    }
  }

  get fillWidth(): number {
    if (this.singleThumb) {
      return ((this.highValue - this.minValue) / (this.maxValue - this.minValue)) * 100;
    } else {
      return ((this.highValue - this.lowValue) / (this.maxValue - this.minValue)) * 100;
    }
  }

  onLowChange() {
    this.lowValue = Math.min(this.lowValue, this.highValue);
    this.emitChange();
  }

  onHighChange() {
    this.highValue = Math.max(this.highValue, this.lowValue);
    this.emitChange();
  }

  private configureBounds() {
    if (this.maxValue < this.minValue) {
      this._maxValue = this.minValue + 1;
    }
    this.lowValue = Math.min(Math.max(this.lowValue, this.minValue), this.maxValue);
    this.highValue = Math.max(Math.min(this.highValue, this.maxValue), this.lowValue);
  }

  private applyExternalRange() {
    if (this.pendingRange) {
      const min = Math.max(this.minValue, Math.min(this.maxValue, this.pendingRange.min));
      const max = Math.max(this.minValue, Math.min(this.maxValue, this.pendingRange.max));
      this.lowValue = Math.min(min, max);
      this.highValue = Math.max(min, max);
    } else {
      this.lowValue = this.minValue;
      this.highValue = this.maxValue;
    }
  }

  setDistanceUnit(unit: DistanceUnit) {
    if (this.distanceUnit === unit) {
    } else {
      const prevUnit = this.distanceUnit;
      this.distanceUnit = unit;

      if (prevUnit === DistanceUnit.MILES && unit === DistanceUnit.KILOMETERS) {
        this._maxValue = this._maxValueKm;
        this.lowValue = this.lowValue * 1.60934;
        this.highValue = this.highValue * 1.60934;
      } else if (prevUnit === DistanceUnit.KILOMETERS && unit === DistanceUnit.MILES) {
        this._maxValue = 50;
        this.lowValue = this.lowValue / 1.60934;
        this.highValue = this.highValue / 1.60934;
      }

      this.configureBounds();
      this.emitChange();
    }
  }

  private emitChange() {
    this.rangeChangeSubject.next({
      min: Number(this.lowValue.toFixed(1)),
      max: Number(this.highValue.toFixed(1)),
      unit: this.distanceUnit
    });
  }

  ngOnDestroy() {
    this.rangeChangeSubscription.unsubscribe();
  }
}
