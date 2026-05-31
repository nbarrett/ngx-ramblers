import { Component, ElementRef, EventEmitter, HostBinding, inject, Input, NgZone, OnDestroy, Output } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { isUndefined } from "es-toolkit/compat";
import { PageContentColumn } from "../../../models/content-text.model";

export enum ResizerOrientation {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical"
}

export enum ResizerVariant {
  BAR = "bar",
  TAB = "tab",
  HANDLE = "handle"
}

export enum ResizerMode {
  SIZE = "size",
  GRID = "grid"
}

@Component({
  selector: "app-resizer",
  standalone: true,
  imports: [],
  template: `
    <div class="resizer-surface"
         (mousedown)="onMouseDown($event)"
         (touchstart)="onTouchStart($event)">
      @if (variant === ResizerVariant.TAB) {
        <div class="resizer-grip">
          <span class="grip-dots">⋯⋯⋯</span>
          <span class="resizer-value">{{ displayLabel() }}</span>
        </div>
      } @else if (variant === ResizerVariant.BAR) {
        <span class="resizer-glyph">{{ orientation === ResizerOrientation.VERTICAL ? "⋯" : "⋮" }}</span>
      } @else {
        <div class="resize-handle"></div>
        @if (isResizing) {
          <div class="resizer-label">{{ displayLabel() }}</div>
        }
      }
    </div>
  `,
  styles: [`
    :host
      display: block
    :host(.resizer--bar)
      width: 100%
      height: 100%
    :host(.resizer--handle)
      position: absolute
      top: 0
      right: -5px
      width: 10px
      height: 100%
      z-index: 10
    .resizer-surface
      width: 100%
      height: 100%
      display: flex
      align-items: center
      justify-content: center
    :host(.resizer--horizontal) .resizer-surface
      cursor: col-resize
    :host(.resizer--vertical) .resizer-surface
      cursor: ns-resize
    :host(.resizer--bar) .resizer-surface
      background: #e9ecef
      border-radius: 4px
      color: #adb5bd
      font-size: 9px
      user-select: none
      transition: background 0.15s ease
    :host(.resizer--bar):hover .resizer-surface,
    :host(.resizer--bar.resizing) .resizer-surface
      background: rgba(155, 200, 171, 0.6)
      color: #2f5e43
    .resizer-grip
      display: flex
      align-items: center
      justify-content: center
      gap: 6px
      height: 12px
      width: 100%
      background: linear-gradient(to bottom, #e8e8e8, #f5f5f5)
      border: 1px solid #ccc
      border-top: none
      border-radius: 0 0 4px 4px
      color: #999
      user-select: none
      font-size: 9px
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08)
      transition: background 0.15s ease
    :host(.resizer--tab) .resizer-surface
      margin-bottom: 12px
    :host(.resizer--tab.compact) .resizer-surface
      margin-bottom: 0
    :host(.resizer--tab):hover .resizer-grip
      background: linear-gradient(to bottom, #ddd, #eee)
      color: #666
    :host(.resizer--tab.resizing) .resizer-grip
      background: linear-gradient(to bottom, #d0d0d0, #e0e0e0)
    .resizer-value
      font-family: var(--bs-font-monospace, monospace)
      font-size: 10px
      font-weight: 500
      color: #666
      min-width: 40px
      text-align: center
    .grip-dots
      letter-spacing: 1px
    .resize-handle
      width: 3px
      height: 100%
      border-radius: 2px
      background: transparent
      transition: background 0.15s ease
    :host(.resizer--handle):hover .resize-handle
      background: rgba(155, 200, 171, 0.6)
    :host(.resizer--handle.resizing) .resize-handle
      background: rgba(155, 200, 171, 0.9)
      width: 4px
    .resizer-label
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
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2)
  `]
})
export class ResizerComponent implements OnDestroy {
  private zone = inject(NgZone);
  private elementRef = inject(ElementRef);

  @Input() orientation: ResizerOrientation = ResizerOrientation.VERTICAL;
  @Input() variant: ResizerVariant = ResizerVariant.TAB;
  @Input() mode: ResizerMode = ResizerMode.SIZE;
  protected readonly ResizerOrientation = ResizerOrientation;
  protected readonly ResizerVariant = ResizerVariant;
  protected readonly ResizerMode = ResizerMode;
  @Input() label: string | null = null;

  @Input() size = 300;
  @Input() minSize = 0;
  @Input() maxSize = Number.POSITIVE_INFINITY;

  @Input() leftColumn: PageContentColumn;
  @Input() rightColumn: PageContentColumn;

  @Input("compact") set compactValue(value: boolean) {
    this.compact = coerceBooleanProperty(value);
  }

  @Output() sizeChange = new EventEmitter<number>();
  @Output() resizeEnd = new EventEmitter<number>();

  compact = false;
  isResizing = false;

  private start = 0;
  private startSize = 0;
  private startLeftCols = 0;
  private startRightCols = 0;
  private combinedCols = 0;
  private gridUnitPx = 0;
  private overlay: HTMLDivElement | null = null;

  @HostBinding("class.resizer--bar") get isBar(): boolean {
    return this.variant === ResizerVariant.BAR;
  }

  @HostBinding("class.resizer--tab") get isTab(): boolean {
    return this.variant === ResizerVariant.TAB;
  }

  @HostBinding("class.resizer--handle") get isHandle(): boolean {
    return this.variant === ResizerVariant.HANDLE;
  }

  @HostBinding("class.resizer--horizontal") get isHorizontal(): boolean {
    return this.orientation === ResizerOrientation.HORIZONTAL;
  }

  @HostBinding("class.resizer--vertical") get isVertical(): boolean {
    return this.orientation === ResizerOrientation.VERTICAL;
  }

  @HostBinding("class.resizing") get resizing(): boolean {
    return this.isResizing;
  }

  @HostBinding("class.compact") get isCompact(): boolean {
    return this.compact;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  displayLabel(): string {
    if (this.label !== null) {
      return this.label;
    }
    if (this.mode === ResizerMode.GRID && this.leftColumn && this.rightColumn) {
      return `${this.leftColumn.columns} | ${this.rightColumn.columns}`;
    }
    return `${Math.round(this.size)}px`;
  }

  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.begin(this.coordinate(event.clientX, event.clientY));
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);
  }

  onTouchStart(event: TouchEvent): void {
    this.begin(this.coordinate(event.touches[0].clientX, event.touches[0].clientY));
    document.addEventListener("touchmove", this.onTouchMove);
    document.addEventListener("touchend", this.onTouchEnd);
  }

  private coordinate(clientX: number, clientY: number): number {
    return this.orientation === ResizerOrientation.HORIZONTAL ? clientX : clientY;
  }

  private begin(position: number): void {
    this.isResizing = true;
    this.start = position;
    if (this.mode === ResizerMode.GRID) {
      this.startLeftCols = this.leftColumn?.columns || 6;
      this.startRightCols = this.rightColumn?.columns || 6;
      this.combinedCols = this.startLeftCols + this.startRightCols;
      const rowElement = this.elementRef.nativeElement.closest(".row");
      this.gridUnitPx = rowElement ? rowElement.getBoundingClientRect().width / 12 : 80;
    } else {
      this.startSize = this.size;
    }
    this.showOverlay();
  }

  private onMouseMove = (event: MouseEvent) => this.move(this.coordinate(event.clientX, event.clientY));
  private onTouchMove = (event: TouchEvent) => this.move(this.coordinate(event.touches[0].clientX, event.touches[0].clientY));

  private move(position: number): void {
    if (!this.isResizing) {
      return;
    }
    const delta = position - this.start;
    this.zone.run(() => {
      if (this.mode === ResizerMode.GRID) {
        const gridDelta = Math.round(delta / this.gridUnitPx);
        const newLeft = Math.max(1, Math.min(this.combinedCols - 1, this.startLeftCols + gridDelta));
        this.leftColumn.columns = newLeft;
        this.rightColumn.columns = this.combinedCols - newLeft;
      } else {
        this.size = Math.min(this.maxSize, Math.max(this.minSize, this.startSize + delta));
        this.sizeChange.emit(this.size);
      }
    });
  }

  private onMouseUp = () => this.end();
  private onTouchEnd = () => this.end();

  private end(): void {
    this.isResizing = false;
    this.removeOverlay();
    this.cleanup();
    if (this.mode !== ResizerMode.GRID) {
      this.resizeEnd.emit(this.size);
    }
  }

  private showOverlay(): void {
    if (isUndefined(document)) {
      return;
    }
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `position:fixed;inset:0;z-index:100000;cursor:${this.orientation === ResizerOrientation.HORIZONTAL ? "col-resize" : "ns-resize"};`;
    document.body.appendChild(this.overlay);
    document.body.style.userSelect = "none";
  }

  private removeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    if (!isUndefined(document)) {
      document.body.style.userSelect = "";
    }
  }

  private cleanup(): void {
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("touchmove", this.onTouchMove);
    document.removeEventListener("touchend", this.onTouchEnd);
    this.removeOverlay();
  }
}
