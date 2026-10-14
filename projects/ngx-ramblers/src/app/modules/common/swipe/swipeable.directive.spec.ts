import { ElementRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { SwipeAxis } from "../../../models/swipe.model";
import { SwipeableDirective } from "./swipeable.directive";

describe("swiping drawer content", () => {
  const host = document.createElement("div");
  const directiveState = {directive: null as SwipeableDirective | null};

  beforeEach(() => {
    host.scrollTop = 0;
    TestBed.configureTestingModule({providers: [{provide: ElementRef, useValue: new ElementRef(host)}]});
    directiveState.directive = TestBed.runInInjectionContext(() => new SwipeableDirective());
    directiveState.directive.ngOnInit();
  });

  afterEach(() => directiveState.directive.ngOnDestroy());

  function touchEvent(type: string, x: number, y: number, target: HTMLElement = host): TouchEvent {
    const touch = {clientX: x, clientY: y} as Touch;
    const event = new TouchEvent(type, {touches: [touch], changedTouches: [touch], cancelable: true});
    Object.defineProperty(event, "target", {value: target});
    return event;
  }

  function verticalDirective(): SwipeableDirective {
    const directive = directiveState.directive;
    directive.swipeAxis = SwipeAxis.VERTICAL;
    directive.swipeDownAtTopOnly = true;
    return directive;
  }

  it("pulls down at the top and suppresses the browser pan", () => {
    const directive = verticalDirective();
    const offset = vi.spyOn(directive.swipeOffset, "emit");
    const delta = vi.spyOn(directive.swipeDelta, "emit");
    directive.onDragStart(touchEvent("touchstart", 100, 100));
    const move = touchEvent("touchmove", 100, 180);
    directive.onDragMove(move);
    expect(move.defaultPrevented).toBe(true);
    expect(offset).toHaveBeenLastCalledWith(80);
    directive.onDragEnd(touchEvent("touchend", 100, 180));
    expect(delta).toHaveBeenCalledWith(80);
  });

  it("leaves scrolling alone when the content is partway down", () => {
    const directive = verticalDirective();
    host.scrollTop = 100;
    const dragging = vi.spyOn(directive.draggingChange, "emit");
    directive.onDragStart(touchEvent("touchstart", 100, 100));
    const move = touchEvent("touchmove", 100, 180);
    directive.onDragMove(move);
    expect(move.defaultPrevented).toBe(false);
    expect(dragging).not.toHaveBeenCalled();
  });

  it("leaves upward scrolling and button taps alone", () => {
    const directive = verticalDirective();
    directive.onDragStart(touchEvent("touchstart", 100, 100));
    const move = touchEvent("touchmove", 100, 60);
    directive.onDragMove(move);
    expect(move.defaultPrevented).toBe(false);
    const dragging = vi.spyOn(directive.draggingChange, "emit");
    directive.onDragStart(touchEvent("touchstart", 100, 100, document.createElement("button")));
    expect(dragging).not.toHaveBeenCalled();
  });

  it("preserves horizontal gallery swipes", () => {
    const directive = directiveState.directive;
    const delta = vi.spyOn(directive.swipeDelta, "emit");
    directive.onDragStart(touchEvent("touchstart", 100, 100));
    directive.onDragMove(touchEvent("touchmove", 20, 100));
    directive.onDragEnd(touchEvent("touchend", 20, 100));
    expect(delta).toHaveBeenCalledWith(-80);
  });
});
