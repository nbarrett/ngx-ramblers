import { DOCUMENT, Location } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { AWSLinkConfig, LinkConfig } from "../models/link.model";
import { UrlService } from "./url.service";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { StringUtilsService } from "./string-utils.service";

describe("UrlService", () => {

  const INJECTED_URL = "https://ng-ekwg-staging.herokuapp.com/walks/walk-programme";

  const URL_PATH = "https://www.example.co.uk/admin/member-bulk-load/12398719823";
  const LOCATION_VALUE = {
    location: {
      href: URL_PATH
    },
    querySelectorAll: () => []
  };
  beforeEach(() => {
    const path = "/path-part-1/path-part-2/path-part-3";
    return TestBed.configureTestingModule({
      imports: [LoggerTestingModule, HttpClientTestingModule],
      providers: [
        {provide: Location, useValue: {path: () => path}},
        {
          provide: Router, useValue: {
            parseUrl: (url) => {
              return {root: {children: {primary: {segments: path.split("/").filter(item => item).map(item => ({path: item}))}}}};
            }, url: "/admin/member-bulk-load/12398719823"
          }
        },
        {provide: ActivatedRoute, useValue: {snapshot: {url: Array("admin", "member-bulk-load")}}},
        {provide: DOCUMENT, useValue: LOCATION_VALUE},
        StringUtilsService]
    }).compileComponents();
  });

  it("should return baseUrl as the path segment before /", () => {
    const service: UrlService = TestBed.inject(UrlService);
    expect(service.baseUrl()).toBe("https://www.example.co.uk");
  });

  describe("area", () => {

    it("should return first url segment minus the slash", () => {
      const service: UrlService = TestBed.inject(UrlService);
      expect(service.area()).toBe("path-part-1");
    });

  });

  describe("areaUrl", () => {

    it("should return the url segment after the area", () => {
      const service: UrlService = TestBed.inject(UrlService);
      expect(service.areaUrl()).toBe("member-bulk-load/12398719823");
    });

  });

  describe("urlWithId", () => {

    it("should return the url of a walk on the site", () => {
      const object: LinkConfig = {
        area: "walks",
        id: "1234-567"
      };

      const service: UrlService = TestBed.inject(UrlService);
      expect(service.linkUrl(object)).toBe("https://www.example.co.uk/walks/1234-567");
    });

    it("should return the url of an expense in the sub-area of admin", () => {
      const object: LinkConfig = {
        subArea: "expenses",
        area: "admin",
        id: "1234-567"
      };

      const service: UrlService = TestBed.inject(UrlService);
      expect(service.linkUrl(object)).toBe("https://www.example.co.uk/admin/expenses/1234-567");
    });

    it("should return the url without the baseUrl if relative supplied true", () => {
      const object: LinkConfig = {
        subArea: "expenses",
        area: "admin",
        id: "1234-567",
        relative: true
      };

      const service: UrlService = TestBed.inject(UrlService);
      expect(service.linkUrl(object)).toBe("admin/expenses/1234-567");
    });

    it("should return the aws url if name supplied", () => {

      const object: AWSLinkConfig = {
        name: "expenses/file.12346.pdf",
      };

      const service: UrlService = TestBed.inject(UrlService);
      expect(service.linkUrl(object)).toBe("https://www.example.co.uk/api/aws/s3/expenses/file.12346.pdf");
    });

  });

  describe("resourceUrlForAWSFileName", () => {

    it("should return a path to an aws file name", () => {
      const service: UrlService = TestBed.inject(UrlService);
      expect(service.absolutePathForAWSFileName("file.pdf")).toBe("https://www.example.co.uk/api/aws/s3/file.pdf");
    });

  });

  describe("hasRouteParameter", () => {

    it("should return false if not in the current url", () => {
      const service: UrlService = TestBed.inject(UrlService);
      expect(service.hasRouteParameter("blah-blah")).toBe(false);
    });

    it("should return true if in the current url", () => {
      const service: UrlService = TestBed.inject(UrlService);
      expect(service.hasRouteParameter("member-bulk-load")).toBe(true);
    });

  });

  describe("relativeUrlFirstSegment", () => {

    it("should return first path segment after base url not including slash", () => {
      const service: UrlService = TestBed.inject(UrlService);
      expect(service.firstPathSegment()).toBe("path-part-1");
    });

  });

  describe("relativeUrl", () => {

    it("should return the path segment after the host including slash", () => {
      const service: UrlService = TestBed.inject(UrlService);
      expect(service.relativeUrl()).toBe("/admin/member-bulk-load/12398719823");
    });

    it("should allow passed parameter to be processed", () => {
      const service: UrlService = TestBed.inject(UrlService);
      expect(service.relativeUrl(INJECTED_URL)).toBe("/walks/walk-programme");
    });

  });

  it("absoluteUrl should return full current url ", () => {
    const service: UrlService = TestBed.inject(UrlService);
    expect(service.absoluteUrl()).toBe(URL_PATH);
  });

  describe("reformatLocalHref", () => {
    let service: UrlService;
    let stringUtils: StringUtilsService;

    beforeEach(() => {
      service = TestBed.inject(UrlService);
      stringUtils = TestBed.inject(StringUtilsService);
    });

    it("should return the original URL if it starts with http", () => {
      const url = "http://example.com";
      expect(service.reformatLocalHref(url)).toBe(url);
    });

    it("should return the original URL if it starts with http(2)", () => {
      const url = "http://example.com/path/WithUpperCase";
      expect(service.reformatLocalHref(url)).toBe(url);
    });

    it("should return the original URL if it starts with http(3)", () => {
      const url = "http://example.com/path/with-upper-case";
      expect(service.reformatLocalHref(url)).toBe(url);
    });

    it("should return the original URL if it starts with www", () => {
      const url = "www.example.com";
      expect(service.reformatLocalHref(url)).toBe(url);
    });

    it("should return the original URL if it contains ://", () => {
      const url = "ftp://example.com";
      expect(service.reformatLocalHref(url)).toBe(url);
    });

    it("should apply kebabCase to path segments with spaces", () => {
      spyOn(stringUtils, "kebabCase").and.callThrough();
      const url = "path/with spaces";
      expect(service.reformatLocalHref(url)).toBe("path/with-spaces");
      expect(stringUtils.kebabCase).toHaveBeenCalledWith("with spaces");
    });

    it("should apply kebabCase to path segments with uppercase characters", () => {
      spyOn(stringUtils, "kebabCase").and.callThrough();
      expect(service.reformatLocalHref("path/WithUpperCase")).toBe("path/with-upper-case");
      expect(stringUtils.kebabCase).toHaveBeenCalledWith("WithUpperCase");
    });

    it("should not change path segments without spaces or uppercase characters", () => {
      expect(service.reformatLocalHref("path/without-changes")).toBe("path/without-changes");
    });

    it("should handle mixed cases and spaces correctly", () => {
      spyOn(stringUtils, "kebabCase").and.callThrough();
      expect(service.reformatLocalHref("path/With Mixed CASES")).toBe("path/with-mixed-cases");
      expect(stringUtils.kebabCase).toHaveBeenCalledWith("With Mixed CASES");
    });
  });

});
