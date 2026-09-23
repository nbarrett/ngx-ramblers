import { DOCUMENT } from "@angular/common";
import { ChangeDetectorRef, Component, inject, NgZone, OnDestroy, OnInit } from "@angular/core";

@Component({
  selector: "app-pull-to-refresh",
  template: `
    <div class="pull-to-refresh" [class.pull-to-refresh-ready]="ready()" [class.pull-to-refresh-busy]="refreshing"
         [class.pull-to-refresh-visible]="visible()" [style.height.px]="indicatorHeight()" aria-hidden="true">
      <div class="pull-sunburst" [class.pull-sunburst-busy]="visible()">
        @for (tick of ticks; track tick) {
          <span class="pull-sunburst-tick" [style.transform]="'rotate(' + (tick * 30) + 'deg)'"></span>
        }
      </div>
    </div>
  `,
  styleUrls: ["./pull-to-refresh.sass"]
})
export class PullToRefreshComponent implements OnInit, OnDestroy {
  private document = inject(DOCUMENT);
  private changeDetector = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  protected readonly ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  protected refreshing = false;
  private pull = {active: false, startY: 0, distance: 0};
  private listeners: {target: EventTarget; type: string; listener: EventListener; options: AddEventListenerOptions}[] = [];
  private readonly threshold = 72;

  ngOnInit(): void {
    const root = this.document;
    this.bind(root, "touchstart", event => this.onTouchStart(event as TouchEvent), {passive: true, capture: true});
    this.bind(root, "touchmove", event => this.onTouchMove(event as TouchEvent), {passive: false, capture: true});
    this.bind(root, "touchend", () => this.onTouchEnd(), {passive: true, capture: true});
    this.bind(root, "touchcancel", () => this.onTouchEnd(), {passive: true, capture: true});
  }

  ngOnDestroy(): void {
    this.listeners.forEach(entry => entry.target.removeEventListener(entry.type, entry.listener, entry.options));
    this.shiftPage(0, true);
  }

  visible(): boolean {
    return this.refreshing || this.pull.distance > 4;
  }

  ready(): boolean {
    return this.pull.distance >= this.threshold;
  }

  indicatorHeight(): number {
    return Math.min(this.pull.distance, 120);
  }

  private bind(target: EventTarget, type: string, listener: EventListener, options: AddEventListenerOptions): void {
    target.addEventListener(type, listener, options);
    this.listeners.push({target, type, listener, options});
  }

  private onTouchStart(event: TouchEvent): void {
    if (!this.refreshing && event.touches.length === 1 && this.scrollerAtTop()) {
      this.pull.active = true;
      this.pull.startY = event.touches[0].clientY;
      this.pull.distance = 0;
    } else {
      this.pull.active = false;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.pull.active && !this.refreshing && event.touches.length === 1) {
      const raw = event.touches[0].clientY - this.pull.startY;
      if (raw > 0) {
        event.preventDefault();
        this.pull.distance = Math.min(raw * 0.5, 140);
        this.shiftPage(this.pull.distance, false);
        this.redraw();
      } else {
        this.pull.distance = 0;
        this.shiftPage(0, false);
        this.redraw();
      }
    }
  }

  private onTouchEnd(): void {
    if (this.pull.active && !this.refreshing) {
      if (this.pull.distance >= this.threshold) {
        this.refreshing = true;
        this.pull.distance = this.threshold;
        this.shiftPage(this.threshold, true);
        this.redraw();
        this.document.defaultView?.location.reload();
      } else {
        this.pull.distance = 0;
        this.shiftPage(0, true);
        this.redraw();
      }
    }
    this.pull.active = false;
  }

  private redraw(): void {
    this.zone.run(() => this.changeDetector.detectChanges());
  }

  private shiftPage(distance: number, animate: boolean): void {
    const page = this.scroller();
    page.style.transition = animate ? "transform 0.22s ease" : "none";
    page.style.transform = distance > 0 ? `translateY(${distance}px)` : "";
  }

  private scrollerAtTop(): boolean {
    const overflow = this.overflowScroller();
    const root = this.document.scrollingElement;
    return (overflow.scrollTop || 0) <= 0 && (root?.scrollTop || 0) <= 0;
  }

  private scroller(): HTMLElement {
    return (this.document.querySelector(".app-page-shift") as HTMLElement) || this.document.documentElement;
  }

  private overflowScroller(): HTMLElement {
    const home = this.document.querySelector(".app-home") as HTMLElement;
    const follow = this.document.querySelector(".follow-app") as HTMLElement;
    return home || follow || this.document.scrollingElement as HTMLElement || this.document.documentElement;
  }
}
