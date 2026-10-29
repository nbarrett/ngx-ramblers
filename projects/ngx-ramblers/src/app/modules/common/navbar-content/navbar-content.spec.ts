import { NavbarContentComponent } from "./navbar-content";

describe("overflowing navbar scrolling", () => {
  function navigation(scrollLeft = 0, scrollWidth = 900): {component: NavbarContentComponent; shell: HTMLElement} {
    const shell = document.createElement("div");
    Object.defineProperties(shell, {
      clientWidth: {value: 600},
      scrollWidth: {value: scrollWidth},
      scrollLeft: {value: scrollLeft, writable: true}
    });
    const component = Object.create(NavbarContentComponent.prototype) as NavbarContentComponent;
    Object.assign(component, {shell: {nativeElement: shell}});
    return {component, shell};
  }

  it("uses a vertical wheel to reveal clipped links and allows page scrolling at the end", () => {
    const {component, shell} = navigation();
    const wheel = new WheelEvent("wheel", {deltaY: 120, cancelable: true});
    component.onNavWheel(wheel);
    expect(shell.scrollLeft).toBe(120);
    expect(wheel.defaultPrevented).toBe(true);
    component.onNavWheel(new WheelEvent("wheel", {deltaY: 500, cancelable: true}));
    expect(shell.scrollLeft).toBe(300);
    const atEnd = new WheelEvent("wheel", {deltaY: 120, cancelable: true});
    component.onNavWheel(atEnd);
    expect(atEnd.defaultPrevented).toBe(false);
  });

  it("handles line and page wheels in either direction", () => {
    const {component, shell} = navigation(100);
    component.onNavWheel(new WheelEvent("wheel", {deltaY: -2, deltaMode: WheelEvent.DOM_DELTA_LINE}));
    expect(shell.scrollLeft).toBe(68);
    component.onNavWheel(new WheelEvent("wheel", {deltaY: 1, deltaMode: WheelEvent.DOM_DELTA_PAGE}));
    expect(shell.scrollLeft).toBe(300);
  });

  it("preserves browser zoom, horizontal trackpad scrolling and non-overflowing menus", () => {
    const {component, shell} = navigation();
    const zoom = new WheelEvent("wheel", {deltaY: 120, ctrlKey: true, cancelable: true});
    const horizontal = new WheelEvent("wheel", {deltaX: 120, deltaY: 1, cancelable: true});
    component.onNavWheel(zoom);
    component.onNavWheel(horizontal);
    expect(shell.scrollLeft).toBe(0);
    expect(zoom.defaultPrevented).toBe(false);
    expect(horizontal.defaultPrevented).toBe(false);
    const fitting = navigation(0, 600);
    const wheel = new WheelEvent("wheel", {deltaY: 120, cancelable: true});
    fitting.component.onNavWheel(wheel);
    expect(fitting.shell.scrollLeft).toBe(0);
    expect(wheel.defaultPrevented).toBe(false);
  });
});
