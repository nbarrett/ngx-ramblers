import { Component, ElementRef, EventEmitter, inject, Input, NgZone, Output, ViewChild } from "@angular/core";
import { NgStyle } from "@angular/common";
import { rangeSliderStyles } from "../../../components/range-slider.styles";
import { ResizerComponent } from "../resizer/resizer";
import { roundZoom, ZoomSliderComponent } from "../zoom-slider/zoom-slider";
import { FocalPoint } from "../../../models/image-cropper.model";

export type { FocalPoint } from "../../../models/image-cropper.model";

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
    @if (resizable) {
      <app-resizer orientation="vertical" variant="tab"
        [size]="effectiveHeight"
        [minSize]="minHeight"
        [maxSize]="maxHeight"
        [compact]="true"
        (sizeChange)="onHeightChange($event)"/>
    }
    @if (showZoomSlider) {
      <app-zoom-slider class="d-block mt-2" [min]="minZoom" [max]="maxZoom" [value]="zoomValue"
                       (valueChange)="onZoomChange($event)"/>
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
  imports: [NgStyle, ResizerComponent, ZoomSliderComponent]
})
export class FocalPointPickerComponent {
  @ViewChild("container") container: ElementRef<HTMLDivElement>;
  @Input() imageSrc: string;
  @Input() focalPoint: FocalPoint = { x: 50, y: 50, zoom: 1 };
  @Input() minZoom = 1;
  @Input() maxZoom = 10;
  @Input() height: number = null;
  @Input() maxPreviewHeight: number = null;
  @Input() borderRadius: number = null;
  @Input() showZoomSlider = true;
  @Input() resizable = false;
  @Input() minHeight = 150;
  @Input() maxHeight = 800;
  @Output() focalPointChange = new EventEmitter<FocalPoint>();

  private ngZone = inject(NgZone);
  private isDragging = false;
  private resizedHeight: number = null;

  get effectiveHeight(): number {
    return this.resizedHeight ?? this.height ?? this.minHeight;
  }

  get zoomValue(): number {
    return this.focalPoint?.zoom ?? 1;
  }

  onHeightChange(newHeight: number) {
    this.resizedHeight = newHeight;
  }

  containerStyle(): any {
    const styles: any = {};
    const h = this.resizable ? this.effectiveHeight : this.height;
    if (h) {
      styles["height.px"] = h;
    } else if (this.maxPreviewHeight) {
      styles["max-height.px"] = this.maxPreviewHeight;
    }
    if (this.borderRadius !== null) {
      styles["border-radius.px"] = this.borderRadius;
    }
    return styles;
  }

  imageStyle(): any {
    const styles: any = {};
    const h = this.resizable ? this.effectiveHeight : this.height;
    if (h) {
      styles["height.px"] = h;
    } else if (this.maxPreviewHeight) {
      styles["max-height.px"] = this.maxPreviewHeight;
      styles["object-fit"] = "contain";
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
    const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, (this.focalPoint?.zoom ?? 1) * factor));
    this.onZoomChange(roundZoom(newZoom));
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
