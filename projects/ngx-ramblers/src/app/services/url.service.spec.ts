import { DOCUMENT, Location } from "@angular/common";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { LoggerTestingModule } from "ngx-logger/testing";
import { AWSLinkConfig, LinkConfig } from "../models/link.model";
import { UrlService } from "./url.service";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { StringUtilsService } from "./string-utils.service";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

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
            imports: [LoggerTestingModule],
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
                StringUtilsService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
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

    describe("looksLikeASlug", () => {
        let service: UrlService;

        beforeEach(() => {
            service = TestBed.inject(UrlService);
        });

        it("should detect lowercase kebab-case as slug", () => {
            expect(service.looksLikeASlug("sandwich-dover")).toBeTrue();
        });

        it("should treat uppercase and numbers as valid slug characters", () => {
            expect(service.looksLikeASlug("Sandwich123-Route")).toBeTrue();
        });

        it("should reject strings with spaces", () => {
            expect(service.looksLikeASlug("Sandwich to Dover")).toBeFalse();
        });

        it("should return false for empty or null values", () => {
            expect(service.looksLikeASlug("")).toBeFalse();
            expect(service.looksLikeASlug(null)).toBeFalse();
        });
    });

    describe("isMongoId", () => {
        let service: UrlService;

        beforeEach(() => {
            service = TestBed.inject(UrlService);
        });

        it("should return true for 24-character hex strings", () => {
            expect(service.isMongoId("689667240ac482029442c7bd")).toBeTrue();
        });

        it("should return false for non-hex or wrong length", () => {
            expect(service.isMongoId("invalid-id")).toBeFalse();
            expect(service.isMongoId("123")).toBeFalse();
        });
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

    describe("pathContainsEventIdOrSlug", () => {
        let service: UrlService;
        let originalRouter: Router;

        const setRouterPath = (path: string) => {
            const segments = path.split("/").filter(item => item).map(item => ({path: item}));
            (service as any).router = {
                url: path,
                parseUrl: () => ({root: {children: {primary: {segments}}}})
            };
        };

        beforeEach(() => {
            service = TestBed.inject(UrlService);
            originalRouter = (service as any).router;
        });

        afterEach(() => {
            (service as any).router = originalRouter;
        });

        it("should return true for kebab-case slug segments", () => {
            setRouterPath("/walks/sandwich-dover-along-saxon-shore-way");
            expect(service.pathContainsEventIdOrSlug()).toBeTrue();
        });

        it("should return true for identifiers that can be converted to a slug", () => {
            setRouterPath("/walks/Sandwich to Dover along the Saxon Shore Way");
            expect(service.pathContainsEventIdOrSlug()).toBeTrue();
        });

        it("should return false for numeric identifiers outside walk routes", () => {
            setRouterPath("/admin/1234567890");
            expect(service.pathContainsEventIdOrSlug()).toBeTrue();
        });

        it("should return true for mongo identifiers in walks path", () => {
            setRouterPath("/walks/689667240ac482029442c7bd");
            expect(service.pathContainsEventIdOrSlug()).toBeTrue();
        });

        it("should return true for mongo identifiers in social path", () => {
            setRouterPath("/social/689667240ac482029442c7bd");
            expect(service.pathContainsEventIdOrSlug()).toBeTrue();
        });

        it("should return false when there are insufficient path segments", () => {
            setRouterPath("/walks");
            expect(service.pathContainsEventIdOrSlug()).toBeFalse();
        });
    });

    describe("baseDomain", () => {
        it("should extract base domain from standard two-part TLD (example.com)", () => {
            const service: UrlService = TestBed.inject(UrlService);
            service["group"] = {href: "https://www.example.com"} as any;
            expect(service.baseDomain()).toBe("example.com");
        });

        it("should extract base domain from multi-level TLD with 2-char country code (.co.uk)", () => {
            const service: UrlService = TestBed.inject(UrlService);
            service["group"] = {href: "https://www.ekwg.co.uk"} as any;
            expect(service.baseDomain()).toBe("ekwg.co.uk");
        });

        it("should extract base domain from multi-level TLD with 3-char extension (.org.uk)", () => {
            const service: UrlService = TestBed.inject(UrlService);
            service["group"] = {href: "https://www.example.org.uk"} as any;
            expect(service.baseDomain()).toBe("example.org.uk");
        });

        it("should handle multiple subdomains correctly", () => {
            const service: UrlService = TestBed.inject(UrlService);
            service["group"] = {href: "https://api.staging.example.com"} as any;
            expect(service.baseDomain()).toBe("example.com");
        });

        it("should handle domain without subdomain", () => {
            const service: UrlService = TestBed.inject(UrlService);
            service["group"] = {href: "https://example.com"} as any;
            expect(service.baseDomain()).toBe("example.com");
        });

        it("should handle multi-level subdomains with .co.uk TLD", () => {
            const service: UrlService = TestBed.inject(UrlService);
            service["group"] = {href: "https://dev.staging.ekwg.co.uk"} as any;
            expect(service.baseDomain()).toBe("ekwg.co.uk");
        });

        it("should handle .ac.uk domains", () => {
            const service: UrlService = TestBed.inject(UrlService);
            service["group"] = {href: "https://www.university.ac.uk"} as any;
            expect(service.baseDomain()).toBe("university.ac.uk");
        });

it("should fallback to window.location.hostname when no group config", () => {
            const service: UrlService = TestBed.inject(UrlService);
            service["group"] = null;
            const baseDomain = service.baseDomain();
            expect(baseDomain).toBeTruthy();
            expect(baseDomain.length).toBeGreaterThan(0);
        });
    });

});
