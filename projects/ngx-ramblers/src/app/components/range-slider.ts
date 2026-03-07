import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { rangeSliderStyles } from "./range-slider.styles";

@Component({
  selector: "app-range-slider",
  imports: [FormsModule],
  template: `
    <div class="d-flex justify-content-between align-items-center mb-1">
      <label class="form-label mb-0">{{ label }}</label>
      <span class="zoom-value">{{ value || 0 }}{{ unit }}</span>
    </div>
    <div class="range-slider-row">
      <div class="slider-wrapper">
        <input type="range"
               class="range-slider range-high"
               [min]="min" [max]="max" [step]="step"
               [ngModel]="value || 0"
               (ngModelChange)="onValueChange($event)"/>
        <div class="slider-track">
          <div class="slider-fill" [style.left.%]="0" [style.width.%]="fillPercent()"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host
      display: block

    .zoom-value
      font-size: 0.85rem
      color: #6c757d

    ${rangeSliderStyles}
  `]
})
export class RangeSliderComponent {
  @Input() label = "";
  @Input() unit = "px";
  @Input() min = 0;
  @Input() max = 100;
  @Input() step = 1;
  @Input() value = 0;
  @Output() valueChange = new EventEmitter<number>();

  fillPercent(): number {
    return ((this.value || 0) - this.min) / (this.max - this.min) * 100;
  }

  onValueChange(newValue: number) {
    this.value = newValue;
    this.valueChange.emit(newValue);
  }
}
