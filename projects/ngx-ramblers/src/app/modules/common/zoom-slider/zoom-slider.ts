import { Component, EventEmitter, Input, Output } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { rangeSliderStyles } from "../../../components/range-slider.styles";

@Component({
  selector: "app-zoom-slider",
  template: `
    <div class="zoom-slider-container">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <label class="form-label mb-0">{{ label }}</label>
        <span class="zoom-value">{{ value | number:'1.1-2' }}x</span>
      </div>
      <div class="range-slider-row">
        <span class="range-edge zoom-edge text-start">{{ min }}x</span>
        <div class="slider-wrapper">
          <input type="range"
                 class="range-slider range-high"
                 [min]="0"
                 [max]="steps"
                 [step]="1"
                 [ngModel]="sliderPosition"
                 (ngModelChange)="onSliderPositionChange($event)"/>
          <div class="slider-track">
            <div class="slider-fill" [style.left.%]="0" [style.width.%]="fillWidth"></div>
          </div>
        </div>
        <span class="range-edge zoom-edge text-end">{{ max }}x</span>
      </div>
      <div class="small text-muted mt-1">{{ hint }}</div>
    </div>
  `,
  styles: [rangeSliderStyles + `
  .zoom-edge
    flex: 0 0 auto
    font-size: 0.8rem
    color: #6c757d

  .zoom-value
    font-size: 0.9rem
    color: #6c757d

  .slider-wrapper
    height: 36px
`],
  imports: [FormsModule, DecimalPipe]
})
export class ZoomSliderComponent {

  @Input() min = 0.2;
  @Input() max = 10;
  @Input() value = 1;
  @Input() label = "Zoom";
  @Input() hint = "Use mouse wheel over image or drag slider";
  @Output() valueChange = new EventEmitter<number>();

  protected readonly steps = 1000;

  get sliderPosition(): number {
    const clamped = Math.min(Math.max(this.value || this.min, this.min), this.max);
    return Math.round(this.steps * Math.log(clamped / this.min) / Math.log(this.max / this.min));
  }

  get fillWidth(): number {
    return (this.sliderPosition / this.steps) * 100;
  }

  onSliderPositionChange(position: number): void {
    const zoom = this.min * Math.pow(this.max / this.min, position / this.steps);
    this.valueChange.emit(roundZoom(zoom));
  }
}

export function roundZoom(zoom: number): number {
  return zoom < 1 ? Math.round(zoom * 100) / 100 : Math.round(zoom * 20) / 20;
}
