import { AfterViewInit, Directive, ElementRef, HostBinding, inject, OnDestroy } from "@angular/core";
import { isUndefined } from "es-toolkit/compat";

export const STICKY_OFFSET_ROOT_ATTR = "data-sticky-offset-root";
export const TIPTAP_TOOLBAR_OFFSET_VAR = "--tiptap-toolbar-offset";

@Directive({
  selector: "[appStickyControls]",
  standalone: true
})
export class StickyControlsDirective implements AfterViewInit, OnDestroy {

  private el = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = isUndefined(ResizeObserver) ? null : new ResizeObserver(() => this.publishOffset());

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
    this.publishOffset(0);
  }

  private publishOffset(heightOverride?: number): void {
    const height = heightOverride ?? Math.ceil(this.el.nativeElement.offsetHeight ?? 0);
    const root = this.el.nativeElement.closest(`[${STICKY_OFFSET_ROOT_ATTR}]`)
      || this.el.nativeElement.parentElement;
    root?.style.setProperty(TIPTAP_TOOLBAR_OFFSET_VAR, `${height}px`);
  }
}
