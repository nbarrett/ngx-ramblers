import { AfterViewInit, Directive, ElementRef, HostBinding, inject, OnDestroy } from "@angular/core";
import { isUndefined } from "es-toolkit/compat";

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
  }

  private publishOffset(): void {
    const height = Math.ceil(this.el.nativeElement.offsetHeight ?? 0);
    this.el.nativeElement.parentElement?.style.setProperty("--tiptap-toolbar-offset", `${height}px`);
  }
}
