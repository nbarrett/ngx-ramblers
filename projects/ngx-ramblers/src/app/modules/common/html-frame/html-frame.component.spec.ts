import { TestBed } from "@angular/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HtmlFrameComponent } from "./html-frame.component";

function htmlFrame(): any {
  TestBed.configureTestingModule({});
  return TestBed.runInInjectionContext(() => new HtmlFrameComponent());
}

describe("email frame keyboard shortcuts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("forwards navigation keys and detaches the listener when destroyed", () => {
    const component = htmlFrame();
    const doc = document.implementation.createHTMLDocument();
    const dispatch = vi.spyOn(window, "dispatchEvent");
    component.bindFrameKeys(doc);
    doc.body.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", shiftKey: true, bubbles: true, cancelable: true}));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({key: "ArrowDown", shiftKey: true});
    component.ngOnDestroy();
    doc.body.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true}));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("preserves editing and modified keyboard shortcuts inside message content", () => {
    const component = htmlFrame();
    const doc = document.implementation.createHTMLDocument();
    const input = doc.createElement("input");
    doc.body.append(input);
    const dispatch = vi.spyOn(window, "dispatchEvent");
    component.bindFrameKeys(doc);
    const editing = new KeyboardEvent("keydown", {key: "Backspace", bubbles: true, cancelable: true});
    input.dispatchEvent(editing);
    const modified = new KeyboardEvent("keydown", {key: "ArrowDown", ctrlKey: true, bubbles: true, cancelable: true});
    doc.body.dispatchEvent(modified);
    expect(dispatch).not.toHaveBeenCalled();
    expect(editing.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
    component.ngOnDestroy();
  });
});
