import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import { IndexService } from "./index.service";
import {
  AlbumIndexSortField,
  ContentPathMatch,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType,
  StringMatch
} from "../models/content-text.model";
import { SortDirection } from "../models/sort.model";
import { AccessLevel } from "../models/member-resource.model";
import { PageContentService } from "./page-content.service";
import { ContentMetadataService } from "./content-metadata.service";
import { PageService } from "./page.service";
import { LocationExtractionService } from "./location-extraction.service";
import { WalksAndEventsService } from "./walks-and-events/walks-and-events.service";
import { ExtendedGroupEventQueryService } from "./walks-and-events/extended-group-event-query.service";
import { YouTubeService } from "./youtube.service";
import { FullNameWithAliasPipe } from "../pipes/full-name-with-alias.pipe";
import { FullNamePipe } from "../pipes/full-name.pipe";
import { MemberIdToFullNamePipe } from "../pipes/member-id-to-full-name.pipe";
import { SearchFilterPipe } from "../pipes/search-filter.pipe";

const mockPageContentService = {all: () => Promise.resolve([])};
const mockContentMetadataService = {all: () => Promise.resolve([])};
const mockPageService = {};
const mockLocationExtractionService = {extractLocationsFromPages: () => []};
const mockWalksAndEventsService = {all: () => Promise.resolve([])};
const mockExtendedGroupEventQueryService = {dataQueryOptions: () => ({})};
const mockYoutubeService = {thumbnailUrl: (id: string) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`};

function pageContent(path: string, rows: Partial<PageContentRow>[] = []): PageContent {
  return {path, rows: rows as PageContentRow[]} as PageContent;
}

function textRow(contentText: string): Partial<PageContentRow> {
  return {type: PageContentType.TEXT, columns: [{contentText}] as PageContentColumn[]};
}

function carouselRow(name: string, title?: string): Partial<PageContentRow> {
  return {
    type: PageContentType.CAROUSEL,
    carousel: {name, title} as any,
    columns: []
  };
}

function column(overrides: Partial<PageContentColumn> = {}): PageContentColumn {
  return {
    title: "Default Title",
    href: "/default",
    accessLevel: AccessLevel.public,
    ...overrides
  } as PageContentColumn;
}

describe("IndexService", () => {
  let service: IndexService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        MemberIdToFullNamePipe,
        FullNamePipe,
        FullNameWithAliasPipe,
        SearchFilterPipe,
        {provide: PageContentService, useValue: mockPageContentService},
        {provide: ContentMetadataService, useValue: mockContentMetadataService},
        {provide: PageService, useValue: mockPageService},
        {provide: LocationExtractionService, useValue: mockLocationExtractionService},
        {provide: WalksAndEventsService, useValue: mockWalksAndEventsService},
        {provide: ExtendedGroupEventQueryService, useValue: mockExtendedGroupEventQueryService},
        {provide: YouTubeService, useValue: mockYoutubeService},
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(IndexService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("depthLimitedRegex", () => {

    it("should return base regex when no maxPathSegments is set", () => {
      const contentPath: ContentPathMatch = {contentPath: "gallery/2025/", stringMatch: StringMatch.STARTS_WITH};
      const result = (service as any).depthLimitedRegex(contentPath);
      expect(result.$regex).toBe("^gallery/2025/");
      expect(result.$options).toBe("i");
    });

    it("should add depth suffix for STARTS_WITH with maxPathSegments=1", () => {
      const contentPath: ContentPathMatch = {contentPath: "walks/scrapbook/by-year/2015/", stringMatch: StringMatch.STARTS_WITH, maxPathSegments: 1};
      const result = (service as any).depthLimitedRegex(contentPath);
      expect(result.$regex).toBe("^walks/scrapbook/by-year/2015(/[^/]+){1,1}$");
      expect(result.$options).toBe("i");
    });

    it("should match only volume-level paths with maxPathSegments=1", () => {
      const contentPath: ContentPathMatch = {contentPath: "walks/scrapbook/by-year/2015/", stringMatch: StringMatch.STARTS_WITH, maxPathSegments: 1};
      const result = (service as any).depthLimitedRegex(contentPath);
      const regex = new RegExp(result.$regex, result.$options);

      expect(regex.test("walks/scrapbook/by-year/2015/volume-11")).toBeTrue();
      expect(regex.test("walks/scrapbook/by-year/2015/volume-12")).toBeTrue();
      expect(regex.test("walks/scrapbook/by-year/2015/volume-11/walk-139")).toBeFalse();
      expect(regex.test("walks/scrapbook/by-year/2015/volume-11/walk-139/detail")).toBeFalse();
      expect(regex.test("walks/scrapbook/by-year/2015")).toBeFalse();
    });

    it("should allow up to 2 levels deep with maxPathSegments=2", () => {
      const contentPath: ContentPathMatch = {contentPath: "gallery/", stringMatch: StringMatch.STARTS_WITH, maxPathSegments: 2};
      const result = (service as any).depthLimitedRegex(contentPath);
      const regex = new RegExp(result.$regex, result.$options);

      expect(regex.test("gallery/2025")).toBeTrue();
      expect(regex.test("gallery/2025/walk-album")).toBeTrue();
      expect(regex.test("gallery/2025/walk-album/detail")).toBeFalse();
    });

    it("should return base regex for CONTAINS even with maxPathSegments", () => {
      const contentPath: ContentPathMatch = {contentPath: "gallery", stringMatch: StringMatch.CONTAINS, maxPathSegments: 1};
      const result = (service as any).depthLimitedRegex(contentPath);
      expect(result.$regex).toBe("gallery");
    });

    it("should return base regex for EQUALS even with maxPathSegments", () => {
      const contentPath: ContentPathMatch = {contentPath: "gallery/2025", stringMatch: StringMatch.EQUALS, maxPathSegments: 1};
      const result = (service as any).depthLimitedRegex(contentPath);
      expect(result.$regex).toBe("^gallery/2025$");
    });

    it("should strip trailing slash before building depth regex", () => {
      const contentPath: ContentPathMatch = {contentPath: "gallery/", stringMatch: StringMatch.STARTS_WITH, maxPathSegments: 1};
      const result = (service as any).depthLimitedRegex(contentPath);
      expect(result.$regex).toContain("^gallery(/[^/]+)");
      expect(result.$regex).not.toContain("gallery//");
    });
  });

  describe("findFirstImageInPage", () => {

    it("should return image from a text row column", () => {
      const page = pageContent("test", [{
        type: PageContentType.TEXT,
        columns: [{imageSource: "photo.jpg"}] as PageContentColumn[]
      }]);
      const result = (service as any).findFirstImageInPage(page);
      expect(result).toBe("photo.jpg");
    });

    it("should skip album-index rows", () => {
      const page = pageContent("test", [
        {
          type: PageContentType.ALBUM_INDEX,
          columns: [{imageSource: "index-image.jpg"}] as PageContentColumn[]
        },
        {
          type: PageContentType.TEXT,
          columns: [{imageSource: "text-image.jpg"}] as PageContentColumn[]
        }
      ]);
      const result = (service as any).findFirstImageInPage(page);
      expect(result).toBe("text-image.jpg");
    });

    it("should return null when page has no images", () => {
      const page = pageContent("test", [textRow("just text")]);
      const result = (service as any).findFirstImageInPage(page);
      expect(result).toBeNull();
    });

    it("should return null when page has only album-index rows with images", () => {
      const page = pageContent("test", [{
        type: PageContentType.ALBUM_INDEX,
        columns: [{imageSource: "should-be-skipped.jpg"}] as PageContentColumn[]
      }]);
      const result = (service as any).findFirstImageInPage(page);
      expect(result).toBeNull();
    });

    it("should resolve nested row images", () => {
      const page = pageContent("test", [{
        type: PageContentType.TEXT,
        columns: [{
          rows: [{
            type: PageContentType.TEXT,
            columns: [{imageSource: "nested.jpg"}]
          }]
        }] as PageContentColumn[]
      }]);
      const result = (service as any).findFirstImageInPage(page);
      expect(result).toBe("nested.jpg");
    });

    it("should return YouTube thumbnail for youtubeId column", () => {
      const page = pageContent("test", [{
        type: PageContentType.TEXT,
        columns: [{youtubeId: "abc123"}] as PageContentColumn[]
      }]);
      const result = (service as any).findFirstImageInPage(page);
      expect(result).toContain("abc123");
    });
  });

  describe("findFirstTextInPage", () => {

    it("should return text from a text row", () => {
      const page = pageContent("test", [textRow("Hello world")]);
      const result = (service as any).findFirstTextInPage(page);
      expect(result).toBe("Hello world");
    });

    it("should return text from action-buttons row", () => {
      const page = pageContent("test", [{
        type: PageContentType.ACTION_BUTTONS,
        columns: [{contentText: "Click here"}] as PageContentColumn[]
      }]);
      const result = (service as any).findFirstTextInPage(page);
      expect(result).toBe("Click here");
    });

    it("should return indexMarkdown from album-index row", () => {
      const page = pageContent("test", [{
        type: PageContentType.ALBUM_INDEX,
        albumIndex: {indexMarkdown: "# Gallery\nPhotos from walks"} as any,
        columns: []
      }]);
      const result = (service as any).findFirstTextInPage(page);
      expect(result).toBe("# Gallery\nPhotos from walks");
    });

    it("should skip carousel rows", () => {
      const page = pageContent("test", [
        carouselRow("photos-1", "Walk Album"),
        textRow("Actual text")
      ]);
      const result = (service as any).findFirstTextInPage(page);
      expect(result).toBe("Actual text");
    });

    it("should return null when no text content exists", () => {
      const page = pageContent("test", [carouselRow("photos-1")]);
      const result = (service as any).findFirstTextInPage(page);
      expect(result).toBeNull();
    });

    it("should skip whitespace-only text", () => {
      const page = pageContent("test", [
        textRow("   "),
        textRow("Real content")
      ]);
      const result = (service as any).findFirstTextInPage(page);
      expect(result).toBe("Real content");
    });
  });

  describe("optimiseIndexImageSource", () => {

    it("should return undefined for undefined input", () => {
      expect((service as any).optimiseIndexImageSource(undefined)).toBeUndefined();
    });

    it("should return null for null input", () => {
      expect((service as any).optimiseIndexImageSource(null)).toBeNull();
    });

    it("should downsize Flickr original images to medium 640", () => {
      expect((service as any).optimiseIndexImageSource("https://live.staticflickr.com/123/photo_o.jpg"))
        .toBe("https://live.staticflickr.com/123/photo_z.jpg");
    });

    it("should downsize Flickr large images to medium 640", () => {
      expect((service as any).optimiseIndexImageSource("https://live.staticflickr.com/123/photo_b.jpg"))
        .toBe("https://live.staticflickr.com/123/photo_z.jpg");
    });

    it("should not modify non-Flickr URLs", () => {
      const url = "https://example.com/photo_o.jpg";
      expect((service as any).optimiseIndexImageSource(url)).toBe(url);
    });

    it("should not modify Flickr URLs that are already medium 640", () => {
      const url = "https://live.staticflickr.com/123/photo_z.jpg";
      expect((service as any).optimiseIndexImageSource(url)).toBe(url);
    });

    it("should handle PNG Flickr images", () => {
      expect((service as any).optimiseIndexImageSource("https://live.staticflickr.com/123/photo_o.png"))
        .toBe("https://live.staticflickr.com/123/photo_z.png");
    });
  });

  describe("summarizeTitles", () => {

    it("should return undefined for empty array", () => {
      expect((service as any).summarizeTitles([])).toBeUndefined();
    });

    it("should return single title as-is", () => {
      expect((service as any).summarizeTitles(["Annual Picnic 2025"])).toBe("Annual Picnic 2025");
    });

    it("should summarize two titles", () => {
      expect((service as any).summarizeTitles(["Walk A", "Walk B"])).toBe("Walk A and 1 other");
    });

    it("should pluralise for three or more titles", () => {
      const result = (service as any).summarizeTitles(["Walk A", "Walk B", "Walk C", "Walk D"]);
      expect(result).toBe("Walk A and 3 others");
    });
  });

  describe("deduplicateByHref", () => {

    it("should keep unique columns", () => {
      const columns = [
        column({href: "/a", title: "A"}),
        column({href: "/b", title: "B"})
      ];
      const result = (service as any).deduplicateByHref(columns);
      expect(result.length).toBe(2);
    });

    it("should remove duplicates keeping the more complete entry", () => {
      const columns = [
        column({href: "/a", title: "A", imageSource: null, contentText: null}),
        column({href: "/a", title: "A", imageSource: "photo.jpg", contentText: "Description"})
      ];
      const result = (service as any).deduplicateByHref(columns);
      expect(result.length).toBe(1);
      expect(result[0].imageSource).toBe("photo.jpg");
    });

    it("should keep first entry when both have equal completeness", () => {
      const columns = [
        column({href: "/a", title: "First"}),
        column({href: "/a", title: "Second"})
      ];
      const result = (service as any).deduplicateByHref(columns);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("First");
    });
  });

  describe("calculateDataCompletenessScore", () => {

    it("should score 0 for empty column", () => {
      const result = (service as any).calculateDataCompletenessScore(column({
        imageSource: null,
        contentText: null,
        title: null,
        location: null
      }));
      expect(result).toBe(0);
    });

    it("should score 3 for image", () => {
      const result = (service as any).calculateDataCompletenessScore(column({
        imageSource: "photo.jpg",
        contentText: null,
        title: null,
        location: null
      }));
      expect(result).toBe(3);
    });

    it("should not score image when value is 'null' string", () => {
      const result = (service as any).calculateDataCompletenessScore(column({
        imageSource: "null",
        contentText: null,
        title: null,
        location: null
      }));
      expect(result).toBe(0);
    });

    it("should score 2 for meaningful content text", () => {
      const result = (service as any).calculateDataCompletenessScore(column({
        imageSource: null,
        contentText: "A walk through the countryside",
        title: null,
        location: null
      }));
      expect(result).toBe(2);
    });

    it("should not score default description text", () => {
      const result = (service as any).calculateDataCompletenessScore(column({
        imageSource: null,
        contentText: "No description available",
        title: null,
        location: null
      }));
      expect(result).toBe(0);
    });

    it("should score 7 for fully complete column", () => {
      const result = (service as any).calculateDataCompletenessScore(column({
        imageSource: "photo.jpg",
        contentText: "Description",
        title: "Title",
        location: {latitude: 51.5, longitude: -0.1} as any
      }));
      expect(result).toBe(7);
    });
  });

  describe("sortColumns", () => {

    it("should sort by title ascending by default", () => {
      const columns = [
        column({title: "Charlie"}),
        column({title: "Alpha"}),
        column({title: "Bravo"})
      ];
      const result = (service as any).sortColumns(columns);
      expect(result.map((c: PageContentColumn) => c.title)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    it("should sort by title descending when configured", () => {
      const columns = [
        column({title: "Alpha"}),
        column({title: "Charlie"}),
        column({title: "Bravo"})
      ];
      const result = (service as any).sortColumns(columns, {field: AlbumIndexSortField.TITLE, direction: SortDirection.DESC});
      expect(result.map((c: PageContentColumn) => c.title)).toEqual(["Charlie", "Bravo", "Alpha"]);
    });

    it("should sort by href when configured", () => {
      const columns = [
        column({href: "/z-path", title: "First"}),
        column({href: "/a-path", title: "Second"})
      ];
      const result = (service as any).sortColumns(columns, {field: AlbumIndexSortField.HREF, direction: SortDirection.ASC});
      expect(result.map((c: PageContentColumn) => c.title)).toEqual(["Second", "First"]);
    });

    it("should not mutate the original array", () => {
      const columns = [column({title: "B"}), column({title: "A"})];
      const result = (service as any).sortColumns(columns);
      expect(columns[0].title).toBe("B");
      expect(result[0].title).toBe("A");
    });
  });

  describe("filterOutExcludedPaths", () => {

    it("should remove pages matching excluded CONTAINS paths", () => {
      const pages = [
        pageContent("gallery/2025/annual-picnic"),
        pageContent("gallery/2025/summer-walk"),
        pageContent("gallery/2025/xmas-lunch")
      ];
      const excludePaths: ContentPathMatch[] = [
        {contentPath: "annual-picnic", stringMatch: StringMatch.CONTAINS},
        {contentPath: "xmas-lunch", stringMatch: StringMatch.CONTAINS}
      ];
      const result = (service as any).filterOutExcludedPaths(pages, excludePaths);
      expect(result.length).toBe(1);
      expect(result[0].path).toBe("gallery/2025/summer-walk");
    });

    it("should remove pages matching excluded STARTS_WITH paths", () => {
      const pages = [
        pageContent("gallery/2025/walk-a"),
        pageContent("archive/old-walk"),
        pageContent("gallery/2024/walk-b")
      ];
      const excludePaths: ContentPathMatch[] = [
        {contentPath: "archive/", stringMatch: StringMatch.STARTS_WITH}
      ];
      const result = (service as any).filterOutExcludedPaths(pages, excludePaths);
      expect(result.length).toBe(2);
    });

    it("should return all pages when no exclusions match", () => {
      const pages = [
        pageContent("gallery/2025/walk-a"),
        pageContent("gallery/2025/walk-b")
      ];
      const excludePaths: ContentPathMatch[] = [
        {contentPath: "no-match", stringMatch: StringMatch.CONTAINS}
      ];
      const result = (service as any).filterOutExcludedPaths(pages, excludePaths);
      expect(result.length).toBe(2);
    });
  });

  describe("filterByMaxPathSegments", () => {

    it("should return all pages when no maxPathSegments is set", () => {
      const pages = [
        pageContent("gallery/2025/volume-1/walk-a"),
        pageContent("gallery/2025/volume-1")
      ];
      const contentPaths: ContentPathMatch[] = [
        {contentPath: "gallery/2025/", stringMatch: StringMatch.STARTS_WITH}
      ];
      const result = (service as any).filterByMaxPathSegments(pages, contentPaths);
      expect(result.length).toBe(2);
    });

    it("should filter to 1 level deep with maxPathSegments=1", () => {
      const pages = [
        pageContent("gallery/2025/volume-1"),
        pageContent("gallery/2025/volume-1/walk-a"),
        pageContent("gallery/2025/volume-2")
      ];
      const contentPaths: ContentPathMatch[] = [
        {contentPath: "gallery/2025/", stringMatch: StringMatch.STARTS_WITH, maxPathSegments: 1}
      ];
      const result = (service as any).filterByMaxPathSegments(pages, contentPaths);
      expect(result.length).toBe(2);
      expect(result.map((p: PageContent) => p.path)).toEqual(["gallery/2025/volume-1", "gallery/2025/volume-2"]);
    });

    it("should filter CONTAINS matches by depth", () => {
      const pages = [
        pageContent("walks/scrapbook/gallery/2025"),
        pageContent("walks/scrapbook/gallery/2025/walk-a"),
        pageContent("photos/gallery/2024")
      ];
      const contentPaths: ContentPathMatch[] = [
        {contentPath: "gallery", stringMatch: StringMatch.CONTAINS, maxPathSegments: 1}
      ];
      const result = (service as any).filterByMaxPathSegments(pages, contentPaths);
      expect(result.length).toBe(2);
      expect(result.map((p: PageContent) => p.path)).toEqual([
        "walks/scrapbook/gallery/2025",
        "photos/gallery/2024"
      ]);
    });
  });

  describe("pageContentFrom", () => {

    it("should generate page content with action-buttons type", () => {
      const row = {albumIndex: {minCols: 2, maxCols: 4}} as PageContentRow;
      const columns = [column({title: "Walk A"}), column({title: "Walk B"})];
      const result = service.pageContentFrom(row, columns, 0);
      expect(result.path).toBe("generated-album-index-row-0");
      expect(result.rows[0].type).toBe(PageContentType.ACTION_BUTTONS);
      expect(result.rows[0].columns.length).toBe(2);
    });

    it("should use albumIndex min/max cols when available", () => {
      const row = {albumIndex: {minCols: 3, maxCols: 6}, minColumns: 1, maxColumns: 2} as PageContentRow;
      const result = service.pageContentFrom(row, [], 0);
      expect(result.rows[0].minColumns).toBe(3);
      expect(result.rows[0].maxColumns).toBe(6);
    });

    it("should fall back to row-level min/max columns", () => {
      const row = {albumIndex: {}, minColumns: 1, maxColumns: 4} as PageContentRow;
      const result = service.pageContentFrom(row, [], 0);
      expect(result.rows[0].minColumns).toBe(1);
      expect(result.rows[0].maxColumns).toBe(4);
    });

    it("should include rowIndex in generated path", () => {
      const row = {albumIndex: {}} as PageContentRow;
      const result = service.pageContentFrom(row, [], 5);
      expect(result.path).toBe("generated-album-index-row-5");
    });
  });
});
