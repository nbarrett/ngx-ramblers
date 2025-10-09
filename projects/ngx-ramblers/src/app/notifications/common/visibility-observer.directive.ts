import { AfterViewInit, Directive, ElementRef, EventEmitter, Input, inject, Output } from "@angular/core";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Directive({
  selector: "[app-visibility-observer]",
  standalone: true
})
export class VisibilityObserverDirective implements AfterViewInit {
  @Output() visible = new EventEmitter<void>();
  @Input("app-visibility-observer") label?: string;

  private observer?: IntersectionObserver;
  private logger: Logger = inject(LoggerFactory).createLogger("VisibilityObserverDirective", NgxLoggerLevel.INFO);
  private el: ElementRef = inject(ElementRef);

  ngAfterViewInit(): void {
    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.logger.info("visible:", this.label || this.describeElement());
            this.visible.emit();
            this.observer?.unobserve(this.el.nativeElement);
          }
        }
      });
      this.observer.observe(this.el.nativeElement);
    } else {
      this.logger.info("visible:", this.label || this.describeElement());
      this.visible.emit();
    }
  }

  private describeElement(): string {
    const element = this.el.nativeElement as HTMLElement;
    const id = element.id ? `#${element.id}` : "";
    const className = typeof element.className === "string" && element.className.trim().length > 0 ? "." + element.className.trim().split(/\s+/).join(".") : "";
    const tag = element.tagName ? element.tagName.toLowerCase() : "element";
    return `${tag}${id}${className}`;
  }
}
