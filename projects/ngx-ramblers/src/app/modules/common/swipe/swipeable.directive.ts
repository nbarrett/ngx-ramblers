import { booleanAttribute, Directive, ElementRef, EventEmitter, HostListener, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";

import { SwipeAxis } from "../../../models/swipe.model";

@Directive({
  selector: "[appSwipeable]",
})
export class SwipeableDirective implements OnInit, OnDestroy {

  private elementRef = inject(ElementRef);
  @Output() swipeOffset = new EventEmitter<number>();
  @Output() swipeDelta = new EventEmitter<number>();
  @Output() draggingChange = new EventEmitter<boolean>();

  @Input() swipeAxis = SwipeAxis.HORIZONTAL;
  @Input({transform: booleanAttribute}) swipeEnabled = true;
  @Input({transform: booleanAttribute}) swipeDownAtTopOnly = false;
  private readonly swipeThreshold = 30;
  private dragStartX: number | null = null;
  private dragStartY: number | null = null;
  private dragging = false;
  private dragOccurred = false;

  private captureClickHandler = (event: Event) => {
    if (this.dragOccurred) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.dragOccurred = false;
    }
  };

  ngOnInit() {
    this.elementRef.nativeElement.addEventListener("click", this.captureClickHandler, true);
  }

  ngOnDestroy() {
    this.elementRef.nativeElement.removeEventListener("click", this.captureClickHandler, true);
  }

  @HostListener("dragstart", ["$event"]) onNativeDragStart(event: DragEvent): void {
    event.preventDefault();
  }

  @HostListener("touchstart", ["$event"])
  @HostListener("mousedown", ["$event"])
  onDragStart(event: TouchEvent | MouseEvent): void {
    this.dragOccurred = false;
    const vertical = this.swipeAxis === SwipeAxis.VERTICAL;
    const host = this.elementRef.nativeElement as HTMLElement;
    const target = event.target instanceof Element ? event.target : null;
    const blocked = vertical && (!!target?.closest("button, input, textarea, select, a, label, [contenteditable], [role=slider]")
      || (this.swipeDownAtTopOnly && host.scrollTop > 0)
      || !(event instanceof TouchEvent));
    if (this.swipeEnabled && !blocked) {
      this.dragging = true;
      this.dragStartX = event instanceof TouchEvent ? event.touches[0]?.clientX ?? null : event.clientX;
      this.dragStartY = event instanceof TouchEvent ? event.touches[0]?.clientY ?? null : event.clientY;
      this.draggingChange.emit(true);
      this.swipeOffset.emit(0);
    }
  }

  @HostListener("touchmove", ["$event"])
  @HostListener("mousemove", ["$event"])
  onDragMove(event: TouchEvent | MouseEvent): void {
    if (this.dragging && this.dragStartX !== null && this.dragStartY !== null) {
      const currentX = event instanceof TouchEvent ? event.touches[0]?.clientX ?? this.dragStartX : event.clientX;
      const currentY = event instanceof TouchEvent ? event.touches[0]?.clientY ?? this.dragStartY : event.clientY;
      const offsetX = currentX - this.dragStartX;
      const offsetY = currentY - this.dragStartY;
      const vertical = this.swipeAxis === SwipeAxis.VERTICAL;
      const offset = vertical ? offsetY : offsetX;
      if (vertical && !this.dragOccurred && (offsetY < -4 || (Math.abs(offsetX) > 8 && Math.abs(offsetX) >= offsetY))) {
        this.reset();
      } else {
        if (Math.abs(offset) > 5) {
          this.dragOccurred = true;
        }
        if (event instanceof TouchEvent && Math.abs(offset) > (vertical ? 5 : 10) && event.cancelable) {
          event.preventDefault();
        }
        this.swipeOffset.emit(vertical && this.swipeDownAtTopOnly ? Math.max(0, offset) : offset);
      }
    }
  }

  @HostListener("touchend", ["$event"])
  @HostListener("touchcancel", ["$event"])
  @HostListener("mouseup", ["$event"])
  @HostListener("mouseleave", ["$event"])
  onDragEnd(event?: TouchEvent | MouseEvent): void {
    if (this.dragging && this.dragStartX !== null && this.dragStartY !== null) {
      const vertical = this.swipeAxis === SwipeAxis.VERTICAL;
      const touch = event instanceof TouchEvent ? event.changedTouches?.[0] : null;
      const endX = touch?.clientX ?? (event instanceof MouseEvent ? event.clientX : this.dragStartX);
      const endY = touch?.clientY ?? (event instanceof MouseEvent ? event.clientY : this.dragStartY);
      const delta = vertical ? endY - this.dragStartY : endX - this.dragStartX;
      if (event?.type === "touchcancel") {
        this.swipeOffset.emit(0);
      } else if (Math.abs(delta) >= this.swipeThreshold) {
        this.swipeDelta.emit(delta);
      }
      this.reset();
    }
  }

  private reset(): void {
    this.dragging = false;
    this.dragStartX = null;
    this.dragStartY = null;
    this.draggingChange.emit(false);
    this.swipeOffset.emit(0);
  }
}
