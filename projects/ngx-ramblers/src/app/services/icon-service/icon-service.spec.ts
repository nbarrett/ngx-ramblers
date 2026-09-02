import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { IconService } from "./icon-service";

describe("IconService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule]
  }));

  it("resolves a Font Awesome icon by key", () => {
    const service: IconService = TestBed.inject(IconService);
    expect(service.iconForName("faPencil")?.iconName).toEqual("pencil");
  });

  it("ignores Font Awesome module exports that are not icons", () => {
    const service: IconService = TestBed.inject(IconService);
    expect(service.iconKeys.includes("fas")).toBe(false);
    expect(service.iconKeys.includes("prefix")).toBe(false);
    expect(service.iconKeys.includes("faPencil")).toBe(true);
  });

  it("returns matching icons for a search term", () => {
    const service: IconService = TestBed.inject(IconService);
    const matches = service.matchingIcons("certificate");
    expect(matches.some(item => item.key === "faCertificate")).toBe(true);
  });

  it("returns every icon when the search is blank", () => {
    const service: IconService = TestBed.inject(IconService);
    expect(service.matchingIcons("").length).toEqual(service.iconArray.length);
    expect(service.matchingIcons("   ").length).toEqual(service.iconArray.length);
  });

  it("does not match every icon for the fa prefix", () => {
    const service: IconService = TestBed.inject(IconService);
    expect(service.matchingIcons("f").length).toEqual(0);
    expect(service.matchingIcons("fa").length).toEqual(0);
    expect(service.matchingIcons("faFil").some(item => item.key === "faFile")).toBe(true);
    expect(service.matchingIcons("faFil").length).toBeLessThan(service.iconArray.length);
  });
});
