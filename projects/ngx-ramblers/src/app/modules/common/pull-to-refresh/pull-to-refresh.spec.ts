import { DOCUMENT } from "@angular/common";
import { ChangeDetectorRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { PullToRefreshComponent } from "./pull-to-refresh";

describe("walking list pull to refresh", () => {
  const home = document.createElement("div");
  const root = document.createElement("div");
  const reload = vi.fn();
  const page = {
    defaultView: {location: {reload}, getComputedStyle: (element: Element) => window.getComputedStyle(element)},
    documentElement: root,
    scrollingElement: root,
    querySelector: (selector: string) => selector === ".app-home" ? home : null
  };

  beforeEach(() => {
    home.scrollTop = 0;
    reload.mockClear();
    root.style.transform = "";
    TestBed.configureTestingModule({imports: [LoggerTestingModule], providers: [
      {provide: DOCUMENT, useValue: page},
      {provide: ChangeDetectorRef, useValue: {detectChanges: vi.fn()}}
    ]});
  });

  function touch(target: Element, x: number, y: number): TouchEvent {
    return {target, touches: [{clientX: x, clientY: y}], preventDefault: vi.fn()} as unknown as TouchEvent;
  }

  it("refreshes list data after a downward pull on a route link without reloading the app", async () => {
    const component = TestBed.runInInjectionContext(() => new PullToRefreshComponent());
    const state = {resolve: null as (() => void) | null};
    component.refreshAction = vi.fn(() => new Promise<void>(resolve => state.resolve = resolve));
    component.allowLinkPull = true;
    const link = document.createElement("a");
    home.appendChild(link);
    component["onTouchStart"](touch(link, 10, 10));
    component["onTouchMove"](touch(link, 10, 170));
    component["onTouchEnd"]();
    expect(component.refreshAction).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    expect(component["refreshing"]).toBe(true);
    expect(root.style.transform).toBe("");
    state.resolve?.();
    await Promise.resolve();
    expect(component["refreshing"]).toBe(false);
    expect(component.visible()).toBe(false);
    component.ngOnDestroy();
  });

  it("uses the shared animation for button refresh and prevents overlapping requests", async () => {
    const component = TestBed.runInInjectionContext(() => new PullToRefreshComponent());
    const state = {resolve: null as (() => void) | null};
    component.refreshAction = vi.fn(() => new Promise<void>(resolve => state.resolve = resolve));
    const pending = component.refresh();
    expect(component.refreshing).toBe(true);
    expect(component.visible()).toBe(true);
    await component.refresh();
    expect(component.refreshAction).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    state.resolve?.();
    await pending;
    expect(component.refreshing).toBe(false);
    expect(component.visible()).toBe(false);
    component.ngOnDestroy();
  });

  it("does not refresh part-way down the list or when touching a button", () => {
    const component = TestBed.runInInjectionContext(() => new PullToRefreshComponent());
    component.refreshAction = vi.fn().mockResolvedValue(null);
    const target = document.createElement("span");
    home.appendChild(target);
    home.scrollTop = 100;
    component["onTouchStart"](touch(target, 0, 0));
    component["onTouchMove"](touch(target, 0, 200));
    component["onTouchEnd"]();
    home.scrollTop = 0;
    component["onTouchStart"](touch(document.createElement("button"), 0, 0));
    component["onTouchMove"](touch(target, 0, 200));
    component["onTouchEnd"]();
    expect(component.refreshAction).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it("clears the indicator after a failed data refresh", async () => {
    const component = TestBed.runInInjectionContext(() => new PullToRefreshComponent());
    component.refreshAction = vi.fn().mockRejectedValue(new Error("Fictional refresh failure"));
    component["refreshing"] = true;
    await component["refreshContent"]();
    expect(component["refreshing"]).toBe(false);
    expect(component.visible()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });
});
