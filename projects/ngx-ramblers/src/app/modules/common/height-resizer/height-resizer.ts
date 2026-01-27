import { Component, EventEmitter, inject, Input, NgZone, OnDestroy, Output } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { NgClass } from "@angular/common";

@Component({
  selector: "app-height-resizer",
  template: `
    <div class="resize-container"
         [ngClass]="{'resizing': isResizing, 'compact': compact}"
         (mousedown)="onResizeStart($event)"
         (touchstart)="onResizeTouchStart($event)">
      <div class="resize-handle">
        <span class="grip-dots">⋯⋯⋯</span>
        <span class="height-value">{{ height }}px</span>
      </div>
    </div>
  `,
  styles: [`
    :host
      display: block
    .resize-container
      cursor: ns-resize
      padding-top: 6px
      margin-bottom: 12px
    .resize-container.compact
      padding-top: 0
      margin-bottom: 0
    .resize-handle
      display: flex
      align-items: center
      justify-content: center
      gap: 6px
      height: 12px
      background: linear-gradient(to bottom, #e8e8e8, #f5f5f5)
      border: 1px solid #ccc
      border-top: none
      border-radius: 0 0 4px 4px
      color: #999
      user-select: none
      font-size: 9px
      box-shadow: 0 1px 2px rgba(0,0,0,0.08)
      transition: background 0.15s ease
    .resize-container:hover .resize-handle
      background: linear-gradient(to bottom, #ddd, #eee)
      color: #666
    .resize-container:active .resize-handle, .resize-container.resizing .resize-handle
      background: linear-gradient(to bottom, #d0d0d0, #e0e0e0)
    .height-value
      font-family: var(--bs-font-monospace, monospace)
      font-size: 10px
      font-weight: 500
      color: #666
      min-width: 40px
      text-align: center
    .grip-dots
      letter-spacing: 1px
  `],
  imports: [NgClass]
})
export class HeightResizerComponent implements OnDestroy {
  private zone = inject(NgZone);

  @Input() height = 300;
  @Input() minHeight = 100;
  @Input() maxHeight = 800;
  @Output() heightChange = new EventEmitter<number>();

  @Input("compact") set compactValue(value: boolean) {
    this.compact = coerceBooleanProperty(value);
  }

  compact = false;
  isResizing = false;
  private startY = 0;
  private startHeight = 0;

  ngOnDestroy() {
    this.cleanupListeners();
  }

  onResizeStart(event: MouseEvent) {
    event.preventDefault();
    this.isResizing = true;
    this.startY = event.clientY;
    this.startHeight = this.height;
    document.addEventListener("mousemove", this.onResizeMove);
    document.addEventListener("mouseup", this.onResizeEnd);
  }

  onResizeTouchStart(event: TouchEvent) {
    this.isResizing = true;
    this.startY = event.touches[0].clientY;
    this.startHeight = this.height;
    document.addEventListener("touchmove", this.onResizeTouchMove);
    document.addEventListener("touchend", this.onResizeTouchEnd);
  }

  private onResizeMove = (event: MouseEvent) => {
    if (!this.isResizing) return;
    const delta = event.clientY - this.startY;
    this.zone.run(() => {
      this.height = Math.min(this.maxHeight, Math.max(this.minHeight, this.startHeight + delta));
      this.heightChange.emit(this.height);
    });
  };

  private onResizeTouchMove = (event: TouchEvent) => {
    if (!this.isResizing) return;
    const delta = event.touches[0].clientY - this.startY;
    this.zone.run(() => {
      this.height = Math.min(this.maxHeight, Math.max(this.minHeight, this.startHeight + delta));
      this.heightChange.emit(this.height);
    });
  };

  private onResizeEnd = () => {
    this.isResizing = false;
    document.removeEventListener("mousemove", this.onResizeMove);
    document.removeEventListener("mouseup", this.onResizeEnd);
  };

  private onResizeTouchEnd = () => {
    this.isResizing = false;
    document.removeEventListener("touchmove", this.onResizeTouchMove);
    document.removeEventListener("touchend", this.onResizeTouchEnd);
  };

  private cleanupListeners() {
    document.removeEventListener("mousemove", this.onResizeMove);
    document.removeEventListener("mouseup", this.onResizeEnd);
    document.removeEventListener("touchmove", this.onResizeTouchMove);
    document.removeEventListener("touchend", this.onResizeTouchEnd);
  }
}
