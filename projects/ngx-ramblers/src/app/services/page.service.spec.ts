import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";
import { PageService } from "./page.service";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

describe("PageService", () => {
  let service: PageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule, RouterTestingModule],
      providers: [
        MemberIdToFullNamePipe,
        FullNamePipe,
        FullNameWithAliasPipe,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(PageService);
  });

  describe("titleFromPath", () => {
    it("should convert a simple path to a title", () => {
      expect(service.titleFromPath("council")).toBe("Council");
    });

    it("should convert a multi-segment path to a slash-separated title", () => {
      expect(service.titleFromPath("council/meetings")).toBe("Council / Meetings");
    });

    it("should convert a date-based path to a readable title", () => {
      expect(service.titleFromPath("council/meetings/2023-03-09")).toBe("Council / Meetings / 2023 03 09");
    });

    it("should handle a deeply nested path", () => {
      expect(service.titleFromPath("admin/system-settings")).toBe("Admin / System Settings");
    });

    it("should handle an empty string", () => {
      expect(service.titleFromPath("")).toBe("");
    });

    it("should handle null", () => {
      expect(service.titleFromPath(null)).toBe("");
    });

    it("should handle undefined", () => {
      expect(service.titleFromPath(undefined)).toBe("");
    });

    it("should handle a path with leading slash", () => {
      expect(service.titleFromPath("/council/meetings")).toBe("Council / Meetings");
    });

    it("should handle kebab-case segments", () => {
      expect(service.titleFromPath("social-events/upcoming")).toBe("Social Events / Upcoming");
    });
  });

  describe("subtitleFrom", () => {
    it("should convert a kebab-case segment to a title", () => {
      expect(service.subtitleFrom("social-events")).toBe("Social Events");
    });

    it("should convert a simple segment to a title", () => {
      expect(service.subtitleFrom("walks")).toBe("Walks");
    });
  });
});
