import { Directive, ElementRef, EventEmitter, HostListener, inject, OnDestroy, OnInit, Output } from "@angular/core";

@Directive({
  selector: "[appSwipeable]",
  standalone: true
})
export class SwipeableDirective implements OnInit, OnDestroy {

  private elementRef = inject(ElementRef);
  @Output() swipeOffset = new EventEmitter<number>();
  @Output() swipeDelta = new EventEmitter<number>();
  @Output() draggingChange = new EventEmitter<boolean>();

  private readonly swipeThreshold = 30;
  private dragStartX: number = null;
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
    this.dragging = true;
    this.dragOccurred = false;
    this.dragStartX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    this.draggingChange.emit(true);
    this.swipeOffset.emit(0);
  }

  @HostListener("touchmove", ["$event"])
  @HostListener("mousemove", ["$event"])
  onDragMove(event: TouchEvent | MouseEvent): void {
    if (!this.dragging || this.dragStartX === null) {
      return;
    }
    const currentX = event instanceof TouchEvent ? event.touches[0].clientX : event.clientX;
    const offsetX = currentX - this.dragStartX;
    if (Math.abs(offsetX) > 5) {
      this.dragOccurred = true;
    }
    if (event instanceof TouchEvent && Math.abs(offsetX) > 10) {
      event.preventDefault();
    }
    this.swipeOffset.emit(offsetX);
  }

  @HostListener("touchend", ["$event"])
  @HostListener("mouseup", ["$event"])
  @HostListener("mouseleave", ["$event"])
  onDragEnd(event?: TouchEvent | MouseEvent): void {
    if (!this.dragging || this.dragStartX === null) {
      this.reset();
      return;
    }
    let endX = this.dragStartX;
    if (event instanceof TouchEvent) {
      endX = event.changedTouches?.[0]?.clientX ?? this.dragStartX;
    } else if (event instanceof MouseEvent) {
      endX = event.clientX;
    }
    const deltaX = endX - this.dragStartX;
    if (Math.abs(deltaX) >= this.swipeThreshold) {
      this.swipeDelta.emit(deltaX);
    }
    this.reset();
  }

  private reset(): void {
    this.dragging = false;
    this.dragStartX = null;
    this.draggingChange.emit(false);
    this.swipeOffset.emit(0);
  }
}
