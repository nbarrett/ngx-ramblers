import { Component, ElementRef, EventEmitter, HostBinding, inject, Input, NgZone, OnDestroy, Output } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { isUndefined } from "es-toolkit/compat";
import { PageContentColumn } from "../../../models/content-text.model";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

export enum ResizerOrientation {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
  CORNER = "corner"
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
  imports: [TooltipDirective],
  template: `
    <div class="resizer-surface"
         [tooltip]="resizeHint"
         [isDisabled]="!resizeHint"
         container="body"
         (mousedown)="onMouseDown($event)"
         (touchstart)="onTouchStart($event)">
      @if (variant === ResizerVariant.TAB) {
        <div class="resizer-grip">
          <span class="grip-dots">⋯⋯⋯</span>
          <span class="resizer-value">{{ displayLabel() }}</span>
          @if (canClear) {
            <button type="button" class="resizer-clear"
                    (mousedown)="onClearMouseDown($event)"
                    (click)="onClear($event)">
              Reset
            </button>
          }
        </div>
      } @else if (variant === ResizerVariant.BAR) {
        <span class="resizer-glyph">{{ barGlyph() }}</span>
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
    :host(.resizer--corner) .resizer-surface
      cursor: nwse-resize
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
    :host(.resizer--bar.resizer--subtle) .resizer-surface
      background: transparent
      border-radius: 0
    :host(.resizer--bar.resizer--subtle) .resizer-glyph
      display: none
    :host(.resizer--bar.resizer--subtle.resizer--horizontal)
      position: relative
      z-index: 2
    :host(.resizer--bar.resizer--subtle.resizer--horizontal) .resizer-surface
      position: absolute
      top: 0
      bottom: 0
      left: 50%
      width: 40px
      transform: translateX(-50%)
    :host(.resizer--bar.resizer--subtle) .resizer-surface::before
      content: ""
      background: rgba(31, 31, 31, 0.12)
      border-radius: 0
      transition: background 0.15s ease, width 0.15s ease, height 0.15s ease
    :host(.resizer--bar.resizer--subtle.resizer--horizontal) .resizer-surface::before
      width: 1px
      height: 100%
    :host(.resizer--bar.resizer--subtle.resizer--vertical) .resizer-surface
      align-items: var(--resizer-vertical-alignment, center)
    :host(.resizer--bar.resizer--subtle.resizer--vertical) .resizer-surface::before
      width: 100%
      height: 1px
    :host(.resizer--bar.resizer--subtle.resizer--horizontal):hover .resizer-surface::before,
    :host(.resizer--bar.resizer--subtle.resizer--horizontal.resizing) .resizer-surface::before
      width: 3px
      border-radius: 2px
      background: rgba(155, 200, 171, 0.9)
    :host(.resizer--bar.resizer--subtle.resizer--vertical):hover .resizer-surface::before,
    :host(.resizer--bar.resizer--subtle.resizer--vertical.resizing) .resizer-surface::before
      height: 3px
      border-radius: 2px
      background: rgba(155, 200, 171, 0.9)
    :host(.resizer--bar.resizer--subtle.resizer--corner)
      position: relative
      z-index: 3
    :host(.resizer--bar.resizer--subtle.resizer--corner) .resizer-surface
      position: absolute
      right: 0
      bottom: 0
      width: 40px
      height: 40px
    :host(.resizer--bar.resizer--subtle.resizer--corner) .resizer-surface::before
      position: absolute
      right: 6px
      bottom: var(--resizer-corner-bottom-inset, 6px)
      width: 12px
      height: 12px
      border-right: 2px solid rgba(31, 31, 31, 0.28)
      border-bottom: 2px solid rgba(31, 31, 31, 0.28)
      background: transparent
      box-sizing: border-box
    :host(.resizer--bar.resizer--subtle.resizer--corner):hover .resizer-surface::before,
    :host(.resizer--bar.resizer--subtle.resizer--corner.resizing) .resizer-surface::before
      border-right-color: rgba(155, 200, 171, 0.95)
      border-bottom-color: rgba(155, 200, 171, 0.95)
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
    .resizer-clear
      appearance: none
      background: none
      border: 0
      padding: 0
      margin: 0 0 0 4px
      font-size: 10px
      font-weight: 600
      line-height: 1
      color: #2f5e43
      cursor: pointer
    .resizer-clear:hover
      color: #1b3a28
      text-decoration: underline
    .grip-dots
      letter-spacing: 1px
    .resize-handle
      width: 3px
      height: 100%
      border-radius: 2px
      background: transparent
      transition: background 0.15s ease, box-shadow 0.15s ease
      box-sizing: border-box
    :host(.resizer--handle):hover .resize-handle
      background: rgba(155, 200, 171, 0.6)
      box-shadow: 0 0 0 1px rgba(155, 200, 171, 0.35)
    :host(.resizer--handle.resizing) .resize-handle
      background: rgba(155, 200, 171, 0.9)
      box-shadow: 0 0 0 1px rgba(155, 200, 171, 0.55)
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
      z-index: 11
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
  @Input() secondarySize = 300;
  @Input() minSecondarySize = 0;
  @Input() maxSecondarySize = Number.POSITIVE_INFINITY;

  @Input() leftColumn: PageContentColumn;
  @Input() rightColumn: PageContentColumn;

  @Input("compact") set compactValue(value: boolean) {
    this.compact = coerceBooleanProperty(value);
  }

  @Output() sizeChange = new EventEmitter<number>();
  @Output() secondarySizeChange = new EventEmitter<number>();
  @Output() resizeEnd = new EventEmitter<number>();
  @Output() secondaryResizeEnd = new EventEmitter<number>();
  @Output() sizeClear = new EventEmitter<void>();
  @Input() resizeHint: string = null;
  @Input() set subtle(value: boolean) {
    this.subtleAppearance = coerceBooleanProperty(value);
  }
  @Input() growsTowardsStart = false;

  @Input("canClear") set canClearValue(value: boolean) {
    this.canClear = coerceBooleanProperty(value);
  }

  compact = false;
  canClear = false;
  isResizing = false;

  private startX = 0;
  private startY = 0;
  private startSize = 0;
  private startSecondarySize = 0;
  private startLeftCols = 0;
  private startRightCols = 0;
  private combinedCols = 0;
  private gridUnitPx = 0;
  private overlay: HTMLDivElement | null = null;

  subtleAppearance = false;

  @HostBinding("class.resizer--subtle") get isSubtle(): boolean {
    return this.subtleAppearance;
  }

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

  @HostBinding("class.resizer--corner") get isCorner(): boolean {
    return this.orientation === ResizerOrientation.CORNER;
  }

  @HostBinding("class.resizing") get resizing(): boolean {
    return this.isResizing;
  }

  @HostBinding("class.compact") get isCompact(): boolean {
    return this.compact;
  }

  @HostBinding("class.can-clear") get showsClear(): boolean {
    return this.canClear;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  displayLabel(): string {
    if (this.label !== null) {
      return this.label;
    } else if (this.mode === ResizerMode.GRID && this.leftColumn && this.rightColumn) {
      return `${this.leftColumn.columns} | ${this.rightColumn.columns}`;
    } else if (this.orientation === ResizerOrientation.CORNER) {
      return `${Math.round(this.size)} × ${Math.round(this.secondarySize)}px`;
    } else {
      return `${Math.round(this.size)}px`;
    }
  }

  barGlyph(): string {
    if (this.orientation === ResizerOrientation.VERTICAL) {
      return "⋯";
    } else if (this.orientation === ResizerOrientation.CORNER) {
      return "◢";
    } else {
      return "⋮";
    }
  }

  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.begin(event.clientX, event.clientY);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);
  }

  onClearMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onClear(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.clearSize();
  }

  onTouchStart(event: TouchEvent): void {
    this.begin(event.touches[0].clientX, event.touches[0].clientY);
    document.addEventListener("touchmove", this.onTouchMove);
    document.addEventListener("touchend", this.onTouchEnd);
  }

  private clearSize(): void {
    if (this.mode === ResizerMode.GRID) {
      this.cleanup();
    } else {
      this.isResizing = false;
      this.cleanup();
      this.sizeClear.emit();
    }
  }

  private begin(clientX: number, clientY: number): void {
    this.isResizing = true;
    this.startX = clientX;
    this.startY = clientY;
    if (this.mode === ResizerMode.GRID) {
      this.startLeftCols = this.leftColumn?.columns || 6;
      this.startRightCols = this.rightColumn?.columns || 6;
      this.combinedCols = this.startLeftCols + this.startRightCols;
      const rowElement = this.elementRef.nativeElement.closest(".row");
      this.gridUnitPx = rowElement ? rowElement.getBoundingClientRect().width / 12 : 80;
    } else {
      this.startSize = this.size;
      this.startSecondarySize = this.secondarySize;
    }
    this.showOverlay();
  }

  private onMouseMove = (event: MouseEvent) => this.move(event.clientX, event.clientY);
  private onTouchMove = (event: TouchEvent) => this.move(event.touches[0].clientX, event.touches[0].clientY);

  private move(clientX: number, clientY: number): void {
    if (this.isResizing) {
      const deltaX = clientX - this.startX;
      const deltaY = clientY - this.startY;
      this.zone.run(() => {
        if (this.mode === ResizerMode.GRID) {
          const gridDelta = Math.round(deltaX / this.gridUnitPx);
          const newLeft = Math.max(1, Math.min(this.combinedCols - 1, this.startLeftCols + gridDelta));
          this.leftColumn.columns = newLeft;
          this.rightColumn.columns = this.combinedCols - newLeft;
        } else if (this.orientation === ResizerOrientation.CORNER) {
          const widthDelta = this.growsTowardsStart ? -deltaX : deltaX;
          const heightDelta = this.growsTowardsStart ? -deltaY : deltaY;
          this.size = Math.min(this.maxSize, Math.max(this.minSize, this.startSize + widthDelta));
          this.secondarySize = Math.min(this.maxSecondarySize, Math.max(this.minSecondarySize, this.startSecondarySize + heightDelta));
          this.sizeChange.emit(this.size);
          this.secondarySizeChange.emit(this.secondarySize);
        } else {
          const delta = this.orientation === ResizerOrientation.HORIZONTAL ? deltaX : deltaY;
          this.size = Math.min(this.maxSize, Math.max(this.minSize, this.startSize + (this.growsTowardsStart ? -delta : delta)));
          this.sizeChange.emit(this.size);
        }
      });
    }
  }

  private onMouseUp = () => this.end();
  private onTouchEnd = () => this.end();

  private end(): void {
    this.isResizing = false;
    this.removeOverlay();
    this.cleanup();
    if (this.mode !== ResizerMode.GRID) {
      this.resizeEnd.emit(this.size);
      if (this.orientation === ResizerOrientation.CORNER) {
        this.secondaryResizeEnd.emit(this.secondarySize);
      }
    }
  }

  private overlayCursor(): string {
    if (this.orientation === ResizerOrientation.HORIZONTAL) {
      return "col-resize";
    } else if (this.orientation === ResizerOrientation.CORNER) {
      return "nwse-resize";
    } else {
      return "ns-resize";
    }
  }

  private showOverlay(): void {
    if (!isUndefined(document)) {
      this.overlay = document.createElement("div");
      this.overlay.style.cssText = `position:fixed;inset:0;z-index:100000;cursor:${this.overlayCursor()};`;
      document.body.appendChild(this.overlay);
      document.body.style.userSelect = "none";
    }
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
