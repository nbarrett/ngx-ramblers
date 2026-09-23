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
  private pull = {active: false, startX: 0, startY: 0, distance: 0, committed: false};
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
    if (!this.refreshing && event.touches.length === 1 && this.scrollerAtTop() && !this.controlTouch(event)) {
      this.pull.active = true;
      this.pull.committed = false;
      this.pull.startX = event.touches[0].clientX;
      this.pull.startY = event.touches[0].clientY;
      this.pull.distance = 0;
    } else {
      this.pull.active = false;
      this.pull.committed = false;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.pull.active && !this.refreshing && event.touches.length === 1) {
      const dx = event.touches[0].clientX - this.pull.startX;
      const dy = event.touches[0].clientY - this.pull.startY;
      if (!this.pull.committed) {
        if (Math.abs(dx) > 8 && Math.abs(dx) >= dy) {
          this.pull.active = false;
          this.pull.distance = 0;
          this.shiftPage(0, false);
          this.redraw();
        } else if (dy > 12 && dy > Math.abs(dx) * 1.4) {
          this.pull.committed = true;
        }
      }
      if (this.pull.committed && dy > 0) {
        event.preventDefault();
        this.pull.distance = Math.min(dy * 0.5, 140);
        this.shiftPage(this.pull.distance, false);
        this.redraw();
      } else if (this.pull.committed) {
        this.pull.distance = 0;
        this.shiftPage(0, false);
        this.redraw();
      }
    }
  }

  private onTouchEnd(): void {
    if (this.pull.active && this.pull.committed && !this.refreshing) {
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
    } else if (this.pull.distance > 0) {
      this.pull.distance = 0;
      this.shiftPage(0, true);
      this.redraw();
    }
    this.pull.active = false;
    this.pull.committed = false;
  }

  private controlTouch(event: TouchEvent): boolean {
    return this.touchAncestors(event.target as Element | null).some(node => this.blocksPull(node));
  }

  private touchAncestors(from: Element | null): Element[] {
    const limit = this.overflowScroller();
    if (!from || from === limit || from === this.document.documentElement) {
      return [];
    } else {
      return [from].concat(this.touchAncestors(from.parentElement));
    }
  }

  private blocksPull(node: Element): boolean {
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement
      || node instanceof HTMLButtonElement || node instanceof HTMLAnchorElement || node instanceof HTMLLabelElement) {
      return true;
    } else if (node instanceof HTMLElement && node.isContentEditable) {
      return true;
    } else {
      const role = node.getAttribute("role");
      const touchAction = node instanceof HTMLElement ? this.document.defaultView?.getComputedStyle(node).touchAction || "" : "";
      const captured = touchAction === "none" || touchAction === "pan-x";
      return role === "slider" || role === "button" || role === "switch" || role === "tab" || role === "listbox" || captured;
    }
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
