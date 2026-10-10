import { AfterViewInit, booleanAttribute, Directive, ElementRef, EventEmitter, Input, inject, OnDestroy, Output } from "@angular/core";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { isBrowser, isString } from "es-toolkit";

@Directive({
  selector: "[app-visibility-observer]",
})
export class VisibilityObserverDirective implements AfterViewInit, OnDestroy {
  @Output() visible = new EventEmitter<void>();
  @Output() visibilityChange = new EventEmitter<boolean>();
  @Input({transform: booleanAttribute}) observeOnce = true;
  @Input() rootMargin = "0px";
  @Input("app-visibility-observer") label?: string;

  private observer: IntersectionObserver | null = null;
  private logger: Logger = inject(LoggerFactory).createLogger("VisibilityObserverDirective", NgxLoggerLevel.ERROR);
  private el: ElementRef = inject(ElementRef);

  ngAfterViewInit(): void {
    if (isBrowser() && "IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          this.visibilityChange.emit(entry.isIntersecting);
          if (entry.isIntersecting) {
            this.logger.info("visible:", this.label || this.describeElement());
            this.visible.emit();
            if (this.observeOnce) {
              this.observer?.unobserve(this.el.nativeElement);
            }
          }
        }
      }, {rootMargin: this.rootMargin});
      this.observer.observe(this.el.nativeElement);
    } else {
      this.logger.info("visible:", this.label || this.describeElement());
      this.visible.emit();
      this.visibilityChange.emit(true);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private describeElement(): string {
    const element = this.el.nativeElement as HTMLElement;
    const id = element.id ? `#${element.id}` : "";
    const className = isString(element.className) && element.className.trim().length > 0 ? "." + element.className.trim().split(/\s+/).join(".") : "";
    const tag = element.tagName ? element.tagName.toLowerCase() : "element";
    return `${tag}${id}${className}`;
  }
}
