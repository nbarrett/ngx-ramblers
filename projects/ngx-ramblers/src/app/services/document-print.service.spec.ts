import {DOCUMENT} from "@angular/common";
import {TestBed} from "@angular/core/testing";
import {describe, expect, it, vi} from "vitest";
import {DocumentPrintService} from "./document-print.service";

describe("document printing", () => {
  it("prints only the document with its styles and waits for the print dialog to close before removing the frame", async () => {
    const target = document.implementation.createHTMLDocument();
    Object.defineProperty(target, "fonts", {value: {ready: Promise.resolve()}});
    const events = new EventTarget();
    const frame = document.createElement("iframe");
    const remove = vi.spyOn(frame, "remove");
    const print = vi.fn(() => {
      expect(remove).not.toHaveBeenCalled();
      events.dispatchEvent(new Event("afterprint"));
    });
    Object.defineProperty(frame, "contentDocument", {value: target});
    Object.defineProperty(frame, "contentWindow", {value: {
      focus: vi.fn(), print, addEventListener: events.addEventListener.bind(events)
    }});
    const style = document.createElement("style");
    style.textContent = ".committee-document-body { color: black; }";
    const source = {
      baseURI: "https://group.example.org.uk/",
      createElement: () => frame,
      querySelectorAll: () => [style],
      body: {appendChild: () => frame.dispatchEvent(new Event("load"))}
    };
    TestBed.configureTestingModule({providers: [DocumentPrintService, {provide: DOCUMENT, useValue: source}]});
    const content = document.createElement("section");
    content.textContent = "Hillside Park programme";
    await TestBed.inject(DocumentPrintService).print(content, "Winter programme");
    expect(print).toHaveBeenCalledOnce();
    expect(target.title).toBe("Winter programme");
    expect(target.body.textContent).toBe("Hillside Park programme");
    expect(target.head.querySelector("style")?.textContent).toBe(style.textContent);
    expect(target.head.querySelector("base")?.href).toBe("https://group.example.org.uk/");
    expect(remove).toHaveBeenCalledOnce();
  });
});
