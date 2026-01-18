import { Component, ElementRef, EventEmitter, inject, Input, NgZone, Output, ViewChild } from "@angular/core";
import { DecimalPipe, NgStyle } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { rangeSliderStyles } from "../../../components/range-slider.styles";

export interface FocalPoint {
  x: number;
  y: number;
  zoom?: number;
}

@Component({
  selector: "app-focal-point-picker",
  template: `
    <div class="focal-point-container" #container
         [ngStyle]="containerStyle()"
         (click)="onClick($event)"
         (mousedown)="onMouseDown($event)"
         (wheel)="onWheel($event)">
      <img [src]="imageSrc"
           class="focal-point-image"
           [ngStyle]="imageStyle()"
           (load)="onImageLoad()"
           draggable="false"/>
      @if (focalPoint) {
        <div class="focal-point-marker"
             [ngStyle]="markerStyle()">
          <div class="focal-point-crosshair"></div>
        </div>
      }
    </div>
    @if (showZoomSlider) {
      <div class="zoom-slider-container mt-2">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <label class="form-label mb-0">Zoom</label>
          <span class="zoom-value">{{ zoomValue | number:'1.1-1' }}x</span>
        </div>
        <div class="range-slider-row">
          <span class="range-edge text-start">1x</span>
          <div class="slider-wrapper">
            <input type="range"
                   class="range-slider range-high"
                   [min]="minZoom"
                   [max]="maxZoom"
                   [step]="0.1"
                   [ngModel]="zoomValue"
                   (ngModelChange)="onZoomChange($event)"/>
            <div class="slider-track">
              <div class="slider-fill" [style.left.%]="0" [style.width.%]="fillWidth"></div>
            </div>
          </div>
          <span class="range-edge text-end">{{ maxZoom }}x</span>
        </div>
        <div class="small text-muted mt-1">Use mouse wheel over image or drag slider</div>
      </div>
    }
  `,
  styles: [`
    .focal-point-container
      position: relative
      cursor: crosshair
      display: block
      width: 100%
      overflow: hidden

    .focal-point-image
      display: block
      width: 100%
      object-fit: cover
      user-select: none
      -webkit-user-drag: none

    .focal-point-marker
      position: absolute
      width: 40px
      height: 40px
      transform: translate(-50%, -50%)
      pointer-events: none

    .focal-point-crosshair
      width: 100%
      height: 100%
      border: 2px solid white
      border-radius: 50%
      box-shadow: 0 0 0 2px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(0,0,0,0.5)
      position: relative

      &::before,
      &::after
        content: ''
        position: absolute
        background: white
        box-shadow: 0 0 2px rgba(0,0,0,0.5)

      &::before
        width: 2px
        height: 100%
        left: 50%
        transform: translateX(-50%)

      &::after
        height: 2px
        width: 100%
        top: 50%
        transform: translateY(-50%)

    .zoom-slider-container
      .zoom-value
        font-size: 0.85rem
        color: #6c757d

    ${rangeSliderStyles}
  `],
  imports: [NgStyle, FormsModule, DecimalPipe]
})
export class FocalPointPickerComponent {
  @ViewChild("container") container: ElementRef<HTMLDivElement>;
  @Input() imageSrc: string;
  @Input() focalPoint: FocalPoint = { x: 50, y: 50, zoom: 1 };
  @Input() minZoom = 1;
  @Input() maxZoom = 10;
  @Input() height: number = null;
  @Input() borderRadius: number = null;
  @Input() showZoomSlider = true;
  @Output() focalPointChange = new EventEmitter<FocalPoint>();

  private ngZone = inject(NgZone);
  private isDragging = false;

  get zoomValue(): number {
    return this.focalPoint?.zoom ?? 1;
  }

  get fillWidth(): number {
    return ((this.zoomValue - this.minZoom) / (this.maxZoom - this.minZoom)) * 100;
  }

  containerStyle(): any {
    const styles: any = {};
    if (this.height) {
      styles["height.px"] = this.height;
    }
    if (this.borderRadius !== null) {
      styles["border-radius.px"] = this.borderRadius;
    }
    return styles;
  }

  imageStyle(): any {
    const styles: any = {};
    if (this.height) {
      styles["height.px"] = this.height;
    }
    if (this.borderRadius !== null) {
      styles["border-radius.px"] = this.borderRadius;
    }
    return styles;
  }

  markerStyle() {
    return {
      left: `${this.focalPoint.x}%`,
      top: `${this.focalPoint.y}%`
    };
  }

  onImageLoad() {
    if (!this.focalPoint) {
      this.focalPoint = { x: 50, y: 50, zoom: 1 };
    }
  }

  onClick(event: MouseEvent) {
    this.updateFocalPoint(event);
  }

  onMouseDown(event: MouseEvent) {
    this.isDragging = true;
    this.updateFocalPoint(event);

    const onMouseMove = (e: MouseEvent) => {
      if (this.isDragging) {
        this.ngZone.run(() => {
          this.updateFocalPoint(e);
        });
      }
    };

    const onMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.2 : 0.2;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, (this.focalPoint?.zoom ?? 1) + delta));
    this.onZoomChange(Math.round(newZoom * 10) / 10);
  }

  onZoomChange(zoom: number) {
    this.focalPoint = { ...this.focalPoint, zoom };
    this.focalPointChange.emit(this.focalPoint);
  }

  private updateFocalPoint(event: MouseEvent) {
    const container = this.container.nativeElement;
    const rect = container.getBoundingClientRect();

    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));

    this.focalPoint = {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      zoom: this.focalPoint?.zoom ?? 1
    };
    this.focalPointChange.emit(this.focalPoint);
  }
}
