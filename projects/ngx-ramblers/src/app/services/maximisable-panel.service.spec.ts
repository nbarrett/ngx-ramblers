import { TestBed } from "@angular/core/testing";
import { MaximisablePanelService } from "./maximisable-panel.service";

describe("nested maximised panels", () => {
  it.each([false, true])("restores scrolling when panels close in either order, outer first: %s", outerFirst => {
    const service = TestBed.inject(MaximisablePanelService);
    const outer = {};
    const conversation = {};
    const originalDocumentOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    service.updateDocumentScrolling(outer, true);
    service.updateDocumentScrolling(conversation, true);
    service.updateDocumentScrolling(outerFirst ? outer : conversation, false);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    service.updateDocumentScrolling(outerFirst ? conversation : outer, false);
    expect(document.documentElement.style.overflow).toBe(originalDocumentOverflow);
    expect(document.body.style.overflow).toBe(originalBodyOverflow);
  });
});
