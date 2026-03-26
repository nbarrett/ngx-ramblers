import { Component, ElementRef, inject, Input, NgZone, OnDestroy } from "@angular/core";
import { NgClass } from "@angular/common";
import { PageContentColumn } from "../../../models/content-text.model";

@Component({
  selector: "app-column-resizer",
  template: `
    <div class="column-resizer"
         [ngClass]="{'resizing': isResizing}"
         (mousedown)="onResizeStart($event)"
         (touchstart)="onResizeTouchStart($event)">
      <div class="resize-handle"></div>
      @if (isResizing) {
        <div class="resize-label">{{ leftColumn.columns }} | {{ rightColumn.columns }}</div>
      }
    </div>
  `,
  styles: [`
    :host
      position: absolute
      top: 0
      right: -5px
      width: 10px
      height: 100%
      z-index: 10
      cursor: col-resize
    .column-resizer
      width: 100%
      height: 100%
      display: flex
      align-items: center
      justify-content: center
    .resize-handle
      width: 3px
      height: 100%
      border-radius: 2px
      background: transparent
      transition: background 0.15s ease
    .column-resizer:hover .resize-handle
      background: rgba(155, 200, 171, 0.6)
    .column-resizer.resizing .resize-handle
      background: rgba(155, 200, 171, 0.9)
      width: 4px
    .resize-label
      position: absolute
      top: 50%
      left: 50%
      transform: translate(-50%, -50%)
      background: rgba(155, 200, 171, 0.95)
      color: white
      font-size: 11px
      font-weight: 600
      font-family: var(--bs-font-monospace, monospace)
      padding: 4px 10px
      border-radius: 4px
      white-space: nowrap
      pointer-events: none
      box-shadow: 0 2px 8px rgba(0,0,0,0.2)
  `],
  imports: [NgClass]
})
export class ColumnResizerComponent implements OnDestroy {
  private zone = inject(NgZone);
  private elementRef = inject(ElementRef);

  @Input() leftColumn: PageContentColumn;
  @Input() rightColumn: PageContentColumn;

  isResizing = false;
  private startX = 0;
  private startLeftCols = 0;
  private startRightCols = 0;
  private combinedCols = 0;
  private gridUnitPx = 0;

  ngOnDestroy() {
    this.cleanupListeners();
  }

  onResizeStart(event: MouseEvent) {
    event.preventDefault();
    this.beginResize(event.clientX);
    document.addEventListener("mousemove", this.onResizeMove);
    document.addEventListener("mouseup", this.onResizeEnd);
  }

  onResizeTouchStart(event: TouchEvent) {
    this.beginResize(event.touches[0].clientX);
    document.addEventListener("touchmove", this.onResizeTouchMove);
    document.addEventListener("touchend", this.onResizeTouchEnd);
  }

  private beginResize(clientX: number) {
    this.isResizing = true;
    this.startX = clientX;
    this.startLeftCols = this.leftColumn.columns || 6;
    this.startRightCols = this.rightColumn.columns || 6;
    this.combinedCols = this.startLeftCols + this.startRightCols;
    const rowElement = this.elementRef.nativeElement.closest(".row");
    this.gridUnitPx = rowElement ? rowElement.getBoundingClientRect().width / 12 : 80;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

  private onResizeMove = (event: MouseEvent) => {
    this.applyDelta(event.clientX);
  };

  private onResizeTouchMove = (event: TouchEvent) => {
    this.applyDelta(event.touches[0].clientX);
  };

  private applyDelta(clientX: number) {
    if (!this.isResizing) return;
    const deltaX = clientX - this.startX;
    const gridDelta = Math.round(deltaX / this.gridUnitPx);
    const newLeft = Math.max(1, Math.min(this.combinedCols - 1, this.startLeftCols + gridDelta));
    const newRight = this.combinedCols - newLeft;
    this.zone.run(() => {
      this.leftColumn.columns = newLeft;
      this.rightColumn.columns = newRight;
    });
  }

  private onResizeEnd = () => {
    this.finishResize();
    document.removeEventListener("mousemove", this.onResizeMove);
    document.removeEventListener("mouseup", this.onResizeEnd);
  };

  private onResizeTouchEnd = () => {
    this.finishResize();
    document.removeEventListener("touchmove", this.onResizeTouchMove);
    document.removeEventListener("touchend", this.onResizeTouchEnd);
  };

  private finishResize() {
    this.isResizing = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  private cleanupListeners() {
    document.removeEventListener("mousemove", this.onResizeMove);
    document.removeEventListener("mouseup", this.onResizeEnd);
    document.removeEventListener("touchmove", this.onResizeTouchMove);
    document.removeEventListener("touchend", this.onResizeTouchEnd);
  }
}
