import { AfterViewInit, Directive, ElementRef, HostBinding, inject, OnDestroy } from "@angular/core";
import { isUndefined } from "es-toolkit/compat";

export const STICKY_OFFSET_ROOT_ATTR = "data-sticky-offset-root";
export const TIPTAP_TOOLBAR_OFFSET_VAR = "--tiptap-toolbar-offset";

@Directive({
  selector: "[appStickyControls]",
})
export class StickyControlsDirective implements AfterViewInit, OnDestroy {

  private el = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = isUndefined(ResizeObserver) ? null : new ResizeObserver(() => this.schedulePublishOffset());
  private publishFrame: number | null = null;

  @HostBinding("style.position") position = "sticky";
  @HostBinding("style.top.px") top = 0;
  @HostBinding("style.zIndex") zIndex = 30;
  @HostBinding("style.backgroundColor") backgroundColor = "#ffffff";

  ngAfterViewInit(): void {
    this.resizeObserver?.observe(this.el.nativeElement);
    this.publishOffset();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.publishFrame !== null) {
      cancelAnimationFrame(this.publishFrame);
      this.publishFrame = null;
    }
    this.publishOffset(0);
  }

  private schedulePublishOffset(): void {
    if (this.publishFrame !== null) {
      cancelAnimationFrame(this.publishFrame);
    }
    this.publishFrame = requestAnimationFrame(() => {
      this.publishFrame = null;
      this.publishOffset();
    });
  }

  private publishOffset(heightOverride?: number): void {
    const height = heightOverride ?? Math.ceil(this.el.nativeElement.offsetHeight ?? 0);
    const nextValue = `${height}px`;
    const root = this.el.nativeElement.closest(`[${STICKY_OFFSET_ROOT_ATTR}]`)
      || this.el.nativeElement.parentElement;
    if (root?.style.getPropertyValue(TIPTAP_TOOLBAR_OFFSET_VAR) !== nextValue) {
      root?.style.setProperty(TIPTAP_TOOLBAR_OFFSET_VAR, nextValue);
    }
  }
}
