import { AfterViewInit, Directive, ElementRef, Input } from "@angular/core";

@Directive({
  selector: "[lazyLoad]"
})
export class LazyLoadDirective implements AfterViewInit {
  @Input() lazyLoad!: string;

  private observer!: IntersectionObserver;

  constructor(private el: ElementRef) {
  }

  ngAfterViewInit() {
    if ("IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage();
            this.observer.unobserve(this.el.nativeElement);
          }
        });
      });
      this.observer.observe(this.el.nativeElement);
    } else {
      this.fallbackForBrowsersThatDontSupportIntersectionObserver();
    }
  }

  private loadImage() {
    const imgElement: HTMLImageElement = this.el.nativeElement;
    imgElement.src = this.lazyLoad;
  }

  private fallbackForBrowsersThatDontSupportIntersectionObserver() {
    this.loadImage();
  }
}
