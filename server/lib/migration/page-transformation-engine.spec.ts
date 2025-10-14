import expect from "expect";
import { describe, it } from "mocha";
import { PageTransformationEngine } from "./page-transformation-engine";
import { PageContent, PageContentRow, PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {
  ContentMatchType,
  ImageMatchPattern,
  PageTransformationConfig,
  SegmentType,
  TextMatchPattern,
  TransformationActionType
} from "../../../projects/ngx-ramblers/src/app/models/page-transformation.model";
import { ScrapedImage, ScrapedPage, ScrapedSegment } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";

function img(src: string, alt: string): ScrapedImage {
  return { src, alt };
}

function seg(text: string, image?: ScrapedImage): ScrapedSegment {
  return { text, image };
}

async function uploadMock(image: ScrapedImage): Promise<string> {
  const filename = image.src.split("/").pop() || image.src;
  return `uploaded:${filename}`;
}

function samplePage(): ScrapedPage {
  return {
    path: "/walks/elham-valley",
    title: "Elham Valley Way",
    segments: [
      seg("### Elham Valley Way"),
      seg("Intro text before images"),
      seg("", img("https://example.com/images/banner.jpg", "Banner")),
      seg("After banner one"),
      seg("", img("https://site/imgs/route-map-123.jpg", "Route map of the walk")),
      seg("Map caption short"),
      seg("## Section Heading"),
      seg("Section paragraph one"),
      seg("", img("https://site/imgs/pic1.jpg", "Pic one")),
      seg("After pic1 text"),
      seg("", img("https://site/imgs/pic2.jpg", "Pic two"))
    ]
  };
}

function complexWalkPage(): ScrapedPage {
  return {
    path: "/walks/route-x",
    title: "Route X",
    segments: [
      seg("# Route X"),
      seg("Overview paragraph one"),
      seg("Overview paragraph two"),
      seg("", img("https://site/imgs/hero.jpg", "Hero")),
      seg("Short caption for hero"),
      seg("## Getting There"),
      seg("Public transport options described here."),
      seg("", img("https://site/imgs/route-map.png", "Route Map")),
      seg("Caption under map"),
      seg("## Points of Interest"),
      seg("A notable view"),
      seg("", img("https://site/imgs/view1.jpg", "View one")),
      seg("After view1"),
      seg("", img("https://site/imgs/view2.jpg", "View two"))
    ]
  };
}

describe("page-transformation-engine.basic", () => {
  it("ALL_CONTENT produces combined markdown with images", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "All content",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.ALL_CONTENT } }
            ]
          }
        }
      ]
    };
    const result: PageContent = await engine.transform(page, config, uploadMock);
    expect(result.rows?.length).toBe(1);
    const col = result.rows?.[0].columns[0];
    expect(col.contentText?.includes("uploaded:banner.jpg")).toBeTruthy();
    expect(col.contentText?.includes("Intro text before images")).toBeTruthy();
  });
});

describe("page-transformation-engine.text patterns", () => {
  it("ALL_TEXT_UNTIL_IMAGE returns text before first image", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Until image",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const text = result.rows?.[0].columns[0].contentText || "";
    expect(text.includes("Elham Valley Way")).toBeTruthy();
    expect(text.includes("Intro text before images")).toBeTruthy();
    expect(text.includes("After banner one")).toBeFalsy();
  });

  it("ALL_TEXT_AFTER_HEADING includes first heading and text until next image", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "After heading",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.ALL_TEXT_AFTER_HEADING } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const text = result.rows?.[0].columns[0].contentText || "";
    expect(text.includes("### Elham Valley Way")).toBeTruthy();
    expect(text.includes("Intro text before images")).toBeTruthy();
    expect(text.includes("After banner one")).toBeFalsy();
  });

  it("PARAGRAPH picks the first unused paragraph", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Paragraph first",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.PARAGRAPH } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const text = result.rows?.[0].columns[0].contentText || "";
    expect(text).toEqual("### Elham Valley Way");
  });

  it("CUSTOM_REGEX extracts a heading section block", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Custom regex",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.CUSTOM_REGEX, customRegex: String.raw`^###\s+.+[\s\S]*?(?=###|$)` } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const text = result.rows?.[0].columns[0].contentText || "";
    expect(text.includes("### Elham Valley Way")).toBeTruthy();
    expect(text.includes("Intro text before images")).toBeTruthy();
  });
});

describe("page-transformation-engine.image patterns", () => {
  it("FIRST_IMAGE returns the first unused image", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "First image",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.FIRST_IMAGE } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const col = result.rows?.[0].columns[0];
    expect(col.imageSource).toEqual("uploaded:banner.jpg");
    expect(col.alt).toEqual("Banner");
  });

  it("FILENAME_PATTERN matches named image and groups caption", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Filename pattern",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.FILENAME_PATTERN, filenamePattern: "*route-map*", groupTextWithImage: true } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const col = result.rows?.[0].columns[0];
    expect(col.imageSource).toEqual("uploaded:route-map-123.jpg");
    expect(col.contentText).toEqual("Map caption short");
    expect(col.showTextAfterImage).toBeTruthy();
  });

  it("ALT_TEXT_PATTERN matches by alt text", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Alt pattern",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.ALT_TEXT_PATTERN, altTextPattern: "Pic two" } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const col = result.rows?.[0].columns[0];
    expect(col.imageSource).toEqual("uploaded:pic2.jpg");
    expect(col.alt).toEqual("Pic two");
  });

  it("FILENAME_PATTERN supports multi-pattern list (glob)", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Filename multi-pattern",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.FILENAME_PATTERN, filenamePattern: "*bogus*|*map*" } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const col = result.rows?.[0].columns[0];
    expect(col.imageSource).toEqual("uploaded:route-map-123.jpg");
  });

  it("ALT_TEXT_PATTERN supports multi-pattern list (no wildcards)", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Alt multi-pattern",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              { columns: 12, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.ALT_TEXT_PATTERN, altTextPattern: "two|map" } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const col = result.rows?.[0].columns[0];
    expect(["uploaded:route-map-123.jpg", "uploaded:pic2.jpg"].includes(col.imageSource)).toBeTruthy();
  });

  it("ALL_IMAGES returns all images as markdown without consuming", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "All images",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 2,
            showSwiper: true,
            columns: [
              { columns: 6, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.ALL_IMAGES } },
              { columns: 6, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.ALL_IMAGES } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const left = result.rows?.[0].columns[0].contentText || "";
    const right = result.rows?.[0].columns[1].contentText || "";
    expect(left.includes("uploaded:banner.jpg")).toBeTruthy();
    expect(left.includes("uploaded:pic2.jpg")).toBeTruthy();
    expect(right.includes("uploaded:banner.jpg")).toBeTruthy();
  });

  it("REMAINING_IMAGES yields next unused image across columns", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Remaining images gallery",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 3,
            showSwiper: false,
            columns: [
              { columns: 4, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.REMAINING_IMAGES } },
              { columns: 4, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.REMAINING_IMAGES } },
              { columns: 4, content: { type: ContentMatchType.IMAGE, imagePattern: ImageMatchPattern.REMAINING_IMAGES } }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const cols = result.rows?.[0].columns || [];
    const sources = cols.map(c => c.imageSource);
    expect(sources).toEqual(["uploaded:banner.jpg", "uploaded:route-map-123.jpg", "uploaded:pic1.jpg"]);
  });
});

describe("page-transformation-engine.nested rows collect-with-breaks", () => {
  it("collects text until image, groups caption, stops at heading", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Collect with breaks",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 2,
            showSwiper: false,
            columns: [
              { columns: 8, content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE } },
              {
                columns: 4,
                nestedRows: {
                  contentMatcher: {
                    type: ContentMatchType.COLLECT_WITH_BREAKS,
                    breakOnImage: true,
                    groupTextWithImage: true,
                    stopCondition: { onDetect: [SegmentType.HEADING] }
                  },
                  rowTemplate: { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false },
                  imageRowTemplate: { type: PageContentType.TEXT, maxColumns: 1, showSwiper: false }
                }
              }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const right = result.rows?.[0].columns[1].rows as PageContentRow[];
    expect(right.length).toBe(2);
    expect(right[0].columns[0].contentText).toEqual("After banner one");
    expect(right[1].columns[0].imageSource).toEqual("uploaded:route-map-123.jpg");
    expect(right[1].columns[0].contentText).toEqual("Map caption short");
  });
});

describe("page-transformation-engine.ADD_NESTED_ROWS action", () => {
  it("adds nested rows into target column using collect-with-breaks", async () => {
    const engine = new PageTransformationEngine();
    const page = complexWalkPage();
    const config: PageTransformationConfig = {
      name: "Add nested rows action",
      enabled: true,
      steps: [
        { type: TransformationActionType.CONVERT_TO_MARKDOWN },
        { type: TransformationActionType.CREATE_PAGE },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 2,
            showSwiper: false,
            columns: [
              { columns: 8, content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE } },
              { columns: 4 }
            ]
          }
        },
        {
          type: TransformationActionType.ADD_NESTED_ROWS,
          targetRow: 1,
          targetColumn: 2,
          contentMatcher: {
            type: ContentMatchType.COLLECT_WITH_BREAKS,
            breakOnImage: true,
            groupTextWithImage: true,
            stopCondition: { onDetect: [SegmentType.HEADING] }
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const nested = result.rows?.[0].columns[1].rows || [];
    expect(nested.length).toBe(1);
    expect(nested[0].columns[0].imageSource).toEqual("uploaded:hero.jpg");
    expect(nested[0].columns[0].contentText).toEqual("Short caption for hero");
  });
});
