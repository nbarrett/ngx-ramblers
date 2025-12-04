import expect from "expect";
import { describe, it, beforeEach, afterEach } from "mocha";
import { PageTransformationEngine } from "./page-transformation-engine";
import {
  ColumnContentType,
  ContentTemplateType,
  ImagePattern,
  MigrationTemplateSourceType,
  NestedRowContentSource,
  NestedRowPackingBehavior,
  PageContent,
  PageContentRow,
  PageContentType
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
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

describe("page-transformation-engine.text splitting", () => {
  it("TEXT_BEFORE_HEADING extracts text before the specified heading", async () => {
    const engine = new PageTransformationEngine();
    const page = complexWalkPage();
    const config: PageTransformationConfig = {
      name: "Text before heading",
      enabled: true,
      steps: [
        {type: TransformationActionType.CONVERT_TO_MARKDOWN},
        {type: TransformationActionType.CREATE_PAGE},
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              {
                columns: 12,
                content: {
                  type: ContentMatchType.TEXT,
                  textPattern: TextMatchPattern.TEXT_BEFORE_HEADING,
                  headingPattern: "Points of Interest"
                }
              }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const text = result.rows?.[0].columns[0].contentText || "";
    expect(text.includes("Overview paragraph one")).toBeTruthy();
    expect(text.includes("Public transport options described here.")).toBeTruthy();
    expect(text.includes("Points of Interest")).toBeFalsy();
    expect(text.includes("A notable view")).toBeFalsy();
  });

  it("TEXT_FROM_HEADING extracts text from the specified heading onwards", async () => {
    const engine = new PageTransformationEngine();
    const page = complexWalkPage();
    const config: PageTransformationConfig = {
      name: "Text from heading",
      enabled: true,
      steps: [
        {type: TransformationActionType.CONVERT_TO_MARKDOWN},
        {type: TransformationActionType.CREATE_PAGE},
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              {
                columns: 12,
                content: {
                  type: ContentMatchType.TEXT,
                  textPattern: TextMatchPattern.TEXT_FROM_HEADING,
                  headingPattern: "Points of Interest"
                }
              }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const text = result.rows?.[0].columns[0].contentText || "";
    expect(text.includes("Overview paragraph one")).toBeFalsy();
    expect(text.includes("Public transport options described here.")).toBeFalsy();
    expect(text.includes("## Points of Interest")).toBeTruthy();
    expect(text.includes("A notable view")).toBeTruthy();
  });

  it("splits content into two columns based on a heading", async () => {
    const engine = new PageTransformationEngine();
    const page = complexWalkPage();
    const config: PageTransformationConfig = {
      name: "Two column split",
      enabled: true,
      steps: [
        {type: TransformationActionType.CONVERT_TO_MARKDOWN},
        {type: TransformationActionType.CREATE_PAGE},
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 2,
            showSwiper: false,
            columns: [
              {
                columns: 8,
                content: {
                  type: ContentMatchType.TEXT,
                  textPattern: TextMatchPattern.TEXT_BEFORE_HEADING,
                  headingPattern: "Points of Interest"
                }
              },
              {
                columns: 4,
                content: {
                  type: ContentMatchType.TEXT,
                  textPattern: TextMatchPattern.TEXT_FROM_HEADING,
                  headingPattern: "Points of Interest"
                }
              }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const leftCol = result.rows?.[0].columns[0].contentText || "";
    const rightCol = result.rows?.[0].columns[1].contentText || "";

    expect(leftCol.includes("Overview paragraph one")).toBeTruthy();
    expect(leftCol.includes("Points of Interest")).toBeFalsy();

    expect(rightCol.includes("Overview paragraph one")).toBeFalsy();
    expect(rightCol.includes("## Points of Interest")).toBeTruthy();
  });
});

describe("page-transformation-engine.mapping transformations", () => {
  it("FILENAME_PATTERN groups short caption text when requested", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Image filename with caption",
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
              {
                columns: 12,
                content: {
                  type: ContentMatchType.IMAGE,
                  imagePattern: ImageMatchPattern.FILENAME_PATTERN,
                  filenamePattern: "*route-map*",
                  groupTextWithImage: true
                }
              }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const column = result.rows?.[0].columns[0];
    expect(column?.imageSource?.includes("uploaded:route-map-123.jpg")).toBeTruthy();
    expect(column?.contentText).toBe("Map caption short");
    expect(column?.showTextAfterImage).toBeTruthy();
  });

  it("REMAINING_TEXT collects leftover narrative after earlier matchers", async () => {
    const engine = new PageTransformationEngine();
    const page = samplePage();
    const config: PageTransformationConfig = {
      name: "Remaining text",
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
              {
                columns: 12,
                content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE }
              }
            ]
          }
        },
        {
          type: TransformationActionType.ADD_ROW,
          rowConfig: {
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [
              {
                columns: 12,
                content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.REMAINING_TEXT }
              }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const firstRowText = result.rows?.[0].columns[0].contentText || "";
    const remainingText = result.rows?.[1].columns[0].contentText || "";
    expect(firstRowText.includes("Intro text before images")).toBeTruthy();
    expect(remainingText.includes("After banner one")).toBeTruthy();
    expect(remainingText.includes("Intro text before images")).toBeFalsy();
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

describe("page-transformation-engine.template mappings", () => {
  const templateBase = (): PageContent => ({
    path: "fragments/templates/routes-template",
    rows: [{
      type: PageContentType.TEXT,
      maxColumns: 2,
      showSwiper: false,
      columns: [{
        columns: 9,
        showPlaceholderImage: true
      }, {
        columns: 3,
        contentText: ""
      }]
    }],
    migrationTemplate: {
      templateType: ContentTemplateType.MIGRATION_TEMPLATE,
      mappings: [{
        targetRowIndex: 0,
        columnMappings: []
      }]
    }
  });

  it("populates nested rows with remaining images and preserves static rows", async () => {
    const engine = new PageTransformationEngine();
    const template: PageContent = {
      path: "fragments/templates/routes-template",
      rows: [{
        type: PageContentType.TEXT,
        maxColumns: 1,
        showSwiper: false,
        columns: [{
          columns: 12,
          rows: [{
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [{columns: 12, showPlaceholderImage: true}]
          }, {
            type: PageContentType.SHARED_FRAGMENT,
            maxColumns: 1,
            showSwiper: false,
            columns: [],
            fragment: {pageContentId: "shared-fragment"}
          }]
        }]
      }],
      migrationTemplate: {
        templateType: ContentTemplateType.MIGRATION_TEMPLATE,
        mappings: [{
          targetRowIndex: 0,
          columnMappings: [{
            columnIndex: 0,
            sourceType: MigrationTemplateSourceType.EXTRACT,
            groupShortTextWithImage: true,
            nestedRowMapping: {
              contentSource: NestedRowContentSource.REMAINING_IMAGES,
              packingBehavior: NestedRowPackingBehavior.ONE_PER_ITEM
            }
          }]
        }]
      }
    };
    const result = await engine.transformWithTemplate(samplePage(), template, uploadMock);
    expect(result.rows.length).toBe(1);
    const column = result.rows[0].columns[0];
    expect(column.rows?.length).toBeGreaterThan(1);
    const dynamicRows = (column.rows || []).filter(row => row.type !== PageContentType.SHARED_FRAGMENT);
    expect(dynamicRows.length).toBe(4);
    expect(dynamicRows[0].columns[0].imageSource).toBe("uploaded:banner.jpg");
    expect(dynamicRows[0].columns[0].contentText).toBeUndefined();
    const trailingFragment = column.rows?.[column.rows.length - 1];
    expect(trailingFragment?.type).toBe(PageContentType.SHARED_FRAGMENT);
  });

  it("hides row when hideIfEmpty is true and no content matches", async () => {
    const engine = new PageTransformationEngine();
    const template: PageContent = {
      path: "fragments/templates/text-only",
      rows: [{
        type: PageContentType.TEXT,
        maxColumns: 1,
        showSwiper: false,
        columns: [{
          columns: 12,
          rows: [{
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [{columns: 12, showPlaceholderImage: true}]
          }]
        }]
      }],
      migrationTemplate: {
        templateType: ContentTemplateType.MIGRATION_TEMPLATE,
        mappings: [{
          targetRowIndex: 0,
          hideIfEmpty: true,
          columnMappings: [{
            columnIndex: 0,
            sourceType: MigrationTemplateSourceType.EXTRACT,
            nestedRowMapping: {
              contentSource: NestedRowContentSource.REMAINING_IMAGES,
              packingBehavior: NestedRowPackingBehavior.ONE_PER_ITEM
            }
          }]
        }]
      }
    };
    const textOnlyPage: ScrapedPage = {
      path: "/text-only",
      title: "Text Only",
      segments: [seg("Paragraph one"), seg("Paragraph two")]
    };
    const result = await engine.transformWithTemplate(textOnlyPage, template, uploadMock);
    expect(result.rows.length).toBe(0);
  });

  it("fills simple image and text columns based on column mappings", async () => {
    const engine = new PageTransformationEngine();
    const template = templateBase();
    template.migrationTemplate!.mappings![0].columnMappings = [{
      columnIndex: 0,
      sourceType: MigrationTemplateSourceType.EXTRACT,
      contentType: ColumnContentType.MIXED,
      imagePattern: ImagePattern.FIRST,
      groupShortTextWithImage: true
    }, {
      columnIndex: 1,
      sourceType: MigrationTemplateSourceType.EXTRACT,
      contentType: ColumnContentType.TEXT
    }];
    const result = await engine.transformWithTemplate(complexWalkPage(), template, uploadMock);
    expect(result.rows.length).toBe(1);
    const [imageCol, textCol] = result.rows[0].columns;
    expect(imageCol.imageSource).toBe("uploaded:hero.jpg");
    expect(imageCol.contentText).toBe("Short caption for hero");
    expect(textCol.contentText?.includes("Overview paragraph one")).toBeTruthy();
  });

  it("selects last image when Image Pattern is LAST", async () => {
    const engine = new PageTransformationEngine();
    const template = templateBase();
    template.migrationTemplate!.mappings![0].columnMappings = [{
      columnIndex: 0,
      sourceType: MigrationTemplateSourceType.EXTRACT,
      contentType: ColumnContentType.IMAGE,
      imagePattern: ImagePattern.LAST
    }];
    const result = await engine.transformWithTemplate(samplePage(), template, uploadMock);
    expect(result.rows.length).toBe(1);
    const [imageCol] = result.rows[0].columns;
    expect(imageCol.imageSource).toBe("uploaded:pic2.jpg");
  });

  it("aggregates remaining text into single nested row when packing behavior is ALL_IN_ONE", async () => {
    const engine = new PageTransformationEngine();
    const template: PageContent = {
      path: "fragments/templates/aggregate-text",
      rows: [{
        type: PageContentType.TEXT,
        maxColumns: 1,
        showSwiper: false,
        columns: [{
          columns: 12,
          rows: [{
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [{columns: 12, contentText: ""}]
          }]
        }]
      }],
      migrationTemplate: {
        templateType: ContentTemplateType.MIGRATION_TEMPLATE,
        mappings: [{
          targetRowIndex: 0,
          columnMappings: [{
            columnIndex: 0,
            sourceType: MigrationTemplateSourceType.EXTRACT,
            nestedRowMapping: {
              contentSource: NestedRowContentSource.REMAINING_TEXT,
              packingBehavior: NestedRowPackingBehavior.ALL_IN_ONE
            }
          }]
        }]
      }
    };
    const result = await engine.transformWithTemplate(complexWalkPage(), template, uploadMock);
    expect(result.rows.length).toBe(1);
    const nestedRows = result.rows[0].columns[0].rows || [];
    expect(nestedRows.length).toBe(1);
    const combined = nestedRows[0].columns[0].contentText || "";
    expect(combined.includes("Overview paragraph one")).toBeTruthy();
    expect(combined.includes("Overview paragraph two")).toBeTruthy();
  });

  it("splits nested rows using heading-aware text patterns", async () => {
    const buildTemplate = (textPattern: TextMatchPattern): PageContent => ({
      path: "fragments/templates/routes-template",
      rows: [{
        type: PageContentType.TEXT,
        maxColumns: 1,
        showSwiper: false,
        columns: [{
          columns: 12,
          rows: [{
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [{columns: 12, contentText: ""}]
          }]
        }]
      }],
      migrationTemplate: {
        templateType: ContentTemplateType.MIGRATION_TEMPLATE,
        mappings: [{
          targetRowIndex: 0,
          columnMappings: [{
            columnIndex: 0,
            sourceType: MigrationTemplateSourceType.EXTRACT,
            nestedRowMapping: {
              contentSource: NestedRowContentSource.PATTERN_MATCH,
              packingBehavior: NestedRowPackingBehavior.ALL_IN_ONE,
              textPattern,
              headingPattern: "Points of Interest"
            }
          }]
        }]
      }
    });
    const engine = new PageTransformationEngine();
    const beforeTemplate = buildTemplate(TextMatchPattern.TEXT_BEFORE_HEADING);
    const beforeResult = await engine.transformWithTemplate(complexWalkPage(), beforeTemplate, uploadMock);
    const beforeText = beforeResult.rows[0].columns[0].rows?.[0].columns[0].contentText || "";
    expect(beforeText.includes("Overview paragraph one")).toBeTruthy();
    expect(beforeText.includes("Points of Interest")).toBeFalsy();
    const poiTemplate = buildTemplate(TextMatchPattern.TEXT_FROM_HEADING);
    const poiResult = await engine.transformWithTemplate(complexWalkPage(), poiTemplate, uploadMock);
    const poiText = poiResult.rows[0].columns[0].rows?.[0].columns[0].contentText || "";
    expect(poiText.includes("Points of Interest")).toBeTruthy();
    expect(poiText.includes("Overview paragraph one")).toBeFalsy();
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

describe("page-transformation-engine.location extraction", () => {
  type MockFetchResponse = {ok: boolean; status: number; json: () => Promise<any>};
  const originalFetch = global.fetch;
  const createFetchResponse = (body: any, ok = true, status = 200): MockFetchResponse => ({
    ok,
    status,
    json: async () => body
  });

  const responseForQuery = (query: string): MockFetchResponse => {
    const upper = query.toUpperCase();
    if (upper === "TR0113440236") {
      return createFetchResponse({
        response: {
          lat: 51.123,
          lon: 1.234,
          grid_reference_6: "TR011402",
          grid_reference_8: "TR01134023",
          grid_reference_10: "TR0113440236",
          description: "TR0113440236"
        }
      });
    }
    if (upper === "CT46DE") {
      return createFetchResponse({
        response: {
          lat: 51.213,
          lon: 1.097,
          grid_reference_6: "TR132450",
          grid_reference_8: "TR13204500",
          grid_reference_10: "TR1320450000",
          postcode: "CT4 6DE",
          description: "CT4 6DE"
        }
      });
    }
    return createFetchResponse({response: null}, false, 404);
  };

  beforeEach(() => {
    (global as any).fetch = async (url: string): Promise<MockFetchResponse> => {
      try {
        const decoded = decodeURIComponent(url);
        const queryPart = decoded.split("query=")[1] || "";
        const query = queryPart.split("&")[0];
        return responseForQuery(query);
      } catch {
        return createFetchResponse({response: null}, false, 500);
      }
    };
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  const locationTemplate = (): PageContent => ({
    path: "fragments/templates/location-template",
    rows: [{
      type: PageContentType.LOCATION,
      maxColumns: 1,
      showSwiper: false,
      columns: []
    }],
    migrationTemplate: {
      templateType: ContentTemplateType.MIGRATION_TEMPLATE,
      mappings: [{
        targetRowIndex: 0,
        sourceType: MigrationTemplateSourceType.EXTRACT,
        location: {
          extractFromContent: true
        }
      }]
    }
  });

  it("extracts and validates a grid reference from text", async function() {
    this.timeout(10000);
    const engine = new PageTransformationEngine();
    const template = locationTemplate();
    const pageWithGridRef: ScrapedPage = {
      path: "/walks/with-grid-ref",
      title: "Walk with Grid Ref",
      segments: [
        seg("Some text here"),
        seg("The walk starts at TR 01134 40236."),
        seg("More text")
      ]
    };
    const result = await engine.transformWithTemplate(pageWithGridRef, template, uploadMock);
    expect(result.rows.length).toBe(1);
    const locationRow = result.rows[0];
    expect(locationRow.type).toBe(PageContentType.LOCATION);
    expect(locationRow.location?.start?.grid_reference_10).toBe("TR0113440236");
    expect(locationRow.location?.start?.grid_reference_6).toBe("TR011402");
  });

  it("ignores an invalid grid reference", async () => {
    const engine = new PageTransformationEngine();
    const template = locationTemplate();
    const pageWithInvalidGridRef: ScrapedPage = {
      path: "/walks/with-invalid-grid-ref",
      title: "Walk with Invalid Grid Ref",
      segments: [
        seg("Some text here"),
        seg("The walk starts at XX 123 456."),
        seg("More text")
      ]
    };
    const result = await engine.transformWithTemplate(pageWithInvalidGridRef, template, uploadMock);
    expect(result.rows.length).toBe(0);

  });

  it("extracts a postcode when no valid grid reference is found", async function() {
    this.timeout(10000);
    const engine = new PageTransformationEngine();
    const template = locationTemplate();
    const pageWithPostcode: ScrapedPage = {
      path: "/walks/with-postcode",
      title: "Walk with Postcode",
      segments: [
        seg("Some text here"),
        seg("The walk starts near CT4 6DE."),
        seg("More text")
      ]
    };
    const result = await engine.transformWithTemplate(pageWithPostcode, template, uploadMock);
    expect(result.rows.length).toBe(1);
    const locationRow = result.rows[0];
    expect(locationRow.type).toBe(PageContentType.LOCATION);
    expect(locationRow.location?.start?.postcode).toBe("CT4 6DE");
    expect(locationRow.location?.start?.grid_reference_6).toBe("TR132450");
  });
});
