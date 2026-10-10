import { ElementRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { VisibilityObserverDirective } from "./visibility-observer.directive";

describe("shared map visibility", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([true, false])("preserves one-time walk loading and supports continuous visibility with observeOnce=%s", observeOnce => {
    const observer = {observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn()};
    const state = {callback: null as IntersectionObserverCallback | null};
    const constructor = vi.fn(function(callback: IntersectionObserverCallback) {
      state.callback = callback;
      return observer;
    });
    vi.stubGlobal("IntersectionObserver", constructor);
    TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [
      {provide: ElementRef, useValue: new ElementRef(document.createElement("div"))}
    ]});
    const directive = TestBed.runInInjectionContext(() => new VisibilityObserverDirective());
    directive.observeOnce = observeOnce;
    directive.rootMargin = "240px 0px";
    const visible = vi.fn();
    const changes = vi.fn();
    directive.visible.subscribe(visible);
    directive.visibilityChange.subscribe(changes);
    directive.ngAfterViewInit();
    expect(constructor).toHaveBeenCalledWith(expect.any(Function), {rootMargin: "240px 0px"});
    state.callback?.([{isIntersecting: true} as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
    expect(visible).toHaveBeenCalledOnce();
    expect(changes).toHaveBeenCalledWith(true);
    expect(observer.unobserve).toHaveBeenCalledTimes(observeOnce ? 1 : 0);
    if (!observeOnce) {
      state.callback?.([{isIntersecting: false} as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
      expect(changes).toHaveBeenLastCalledWith(false);
    }
    directive.ngOnDestroy();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });
});
