import expect from "expect";
import { describe, it } from "mocha";
import fs from "fs";
import path from "path";
import { PageTransformationEngine } from "./page-transformation-engine";
import * as exclusions from "./text-exclusions";
import { PageContent, PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {
  ContentMatchType,
  PageTransformationConfig,
  SegmentType,
  TextMatchPattern,
  TransformationActionType
} from "../../../projects/ngx-ramblers/src/app/models/page-transformation.model";
import {
  ScrapedImage,
  ScrapedPage,
  ScrapedSegment
} from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("page-transformation-engine-spec"));
debugLog.enabled = false;

function toAbsolute(baseUrl: string, url: string): string {
  try {
    const hasScheme = /:\/\//.test(url);
    return hasScheme ? url : new URL(url, baseUrl).href;
  } catch (e) {
    debugLog(`Failed to convert URL "${url}" to absolute with base "${baseUrl}":`, e instanceof Error ? e.message : String(e));
    return url;
  }
}

function parseMarkdownToSegments(markdown: string, baseUrl?: string): ScrapedSegment[] {
  const segments: ScrapedSegment[] = [];
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  for (let match = imageRegex.exec(markdown); match; match = imageRegex.exec(markdown)) {
    const before = markdown.substring(lastIndex, match.index).trim();
    if (before) segments.push({ text: before });
    const alt = match[1] || "";
    const raw = match[2] || "";
    const src = baseUrl ? toAbsolute(baseUrl, raw) : raw;
    const image: ScrapedImage = { src, alt };
    segments.push({ text: alt || "Image", image });
    lastIndex = match.index + match[0].length;
  }
  const remaining = markdown.substring(lastIndex).trim();
  if (remaining) segments.push({text: remaining});
  return segments;
}

async function uploadMock(image: ScrapedImage): Promise<string> {
  const filename = image.src.split("/").pop() || image.src;
  return `uploaded:${filename}`;
}

describe("eden valley e2e nested rows", () => {
  it("processes eden valley markdown fixture into nested rows", async () => {
    const filePath = path.join(__dirname, "../../test-data/e2e-migration-input-eden-valley.md");
    const markdown = fs.readFileSync(filePath, "utf-8");
    const segments = parseMarkdownToSegments(markdown);
    const page: ScrapedPage = {path: "/eden-valley-walk", title: "Eden Valley Walk", segments};
    const engine = new PageTransformationEngine();
    const config: PageTransformationConfig = {
      name: "E2E Eden Valley",
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
              {columns: 8, content: {type: ContentMatchType.TEXT, textPattern: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE}},
              {
                columns: 4,
                nestedRows: {
                  contentMatcher: {
                    type: ContentMatchType.COLLECT_WITH_BREAKS,
                    breakOnImage: true,
                    groupTextWithImage: true,
                    stopCondition: {onDetect: [SegmentType.HEADING]}
                  },
                  rowTemplate: {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false},
                  imageRowTemplate: {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false}
                }
              }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const nested = result.rows?.[0].columns[1].rows || [];
    expect(nested.length).toBeGreaterThan(0);
    const hasImageRow = nested.some(r => r.columns[0].imageSource);
    expect(hasImageRow).toBeTruthy();
  });
});

describe("darent valley e2e images and captions", () => {
  it("processes darent valley markdown with expected images and captions", async () => {
    const filePath = path.join(__dirname, "../../test-data/e2e-migration-input-darent-valley.md");
    const markdown = fs.readFileSync(filePath, "utf-8");
    const baseUrl = "https://www.kentramblers.org.uk/KentWalks/DVP/";
    const segments = parseMarkdownToSegments(markdown, baseUrl);
    const page: ScrapedPage = {path: "/darent-valley-path", title: "Darent Valley Path", segments};
    const engine = new PageTransformationEngine();
    const config: PageTransformationConfig = {
      name: "E2E Darent Valley",
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
              {columns: 8, content: {type: ContentMatchType.TEXT, textPattern: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE}},
              {
                columns: 4,
                nestedRows: {
                  contentMatcher: {
                    type: ContentMatchType.COLLECT_WITH_BREAKS,
                    breakOnImage: true,
                    groupTextWithImage: true,
                    stopCondition: {onDetect: [SegmentType.HEADING]}
                  },
                  rowTemplate: {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false},
                  imageRowTemplate: {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false}
                }
              }
            ]
          }
        }
      ]
    };
    const result = await engine.transform(page, config, uploadMock);
    const nested = result.rows?.[0].columns[1].rows || [];
    if (!(nested.length > 0)) {
      throw new Error("No nested rows collected for Darent Valley");
    }
    const findRow = (file: string, caption: string) => nested.find(r => r.columns[0].imageSource === `uploaded:${file}` && r.columns[0].contentText === caption);
    const miss = (file: string, caption: string) => `Missing image row uploaded:${file} with caption \"${caption}\". Actual: ${JSON.stringify(nested.map(r => ({
      image: r.columns[0].imageSource,
      caption: r.columns[0].contentText
    })))}`;
    if (!findRow("chipstead.JPG", "Starting point at Chipstead")) {
      throw new Error(miss("chipstead.JPG", "Starting point at Chipstead"));
    }
    if (!findRow("otford.jpg", "Otford")) {
      throw new Error(miss("otford.jpg", "Otford"));
    }
  });

});

describe("darent valley e2e base origin and filters excluded images e2e", () => {
  it("converts relative image URLs to absolute with base origin and filters excluded images", async () => {
    const filePath = path.join(__dirname, "../../test-data/e2e-migration-input-darent-valley.md");
    const markdown = fs.readFileSync(filePath, "utf-8");
    const baseUrl = "https://www.kentramblers.org.uk";
    const segmentsAbs = parseMarkdownToSegments(markdown, baseUrl);
    const allImageSrcs = segmentsAbs.filter(s => s.image).map(s => s.image!.src);
    debugLog("All image srcs:", allImageSrcs);
    if (!(allImageSrcs.length > 0)) {
      throw new Error("No image sources parsed for Darent Valley");
    }
    if (!allImageSrcs.every(src => src.startsWith("https://www.kentramblers.org.uk"))) {
      throw new Error(`Found non-absolute URLs: ${JSON.stringify(allImageSrcs.filter(src => !src.startsWith("https://www.kentramblers.org.uk")))}`);
    }

    const expectContains = (url: string) => {
      if (!allImageSrcs.includes(url)) {
        throw new Error(`Expected absolute URL not found: ${url}. Actual: ${JSON.stringify(allImageSrcs)}`);
      }
    };
    expectContains("https://www.kentramblers.org.uk/banners/autumn_oasts.jpg");
    expectContains("https://www.kentramblers.org.uk/images/chipstead.JPG");
    expectContains("https://www.kentramblers.org.uk/images/otford.jpg");

    const filtered = exclusions.applyTextExclusions(markdown, {
      excludeTextPatterns: [],
      excludeMarkdownBlocks: [],
      excludeImageUrls: ["banners/autumn_oasts.jpg", "footer-bg.png"]
    } as any);
    const filteredSegments = parseMarkdownToSegments(filtered, baseUrl);
    debugLog("filteredSegments:", filteredSegments);

    const filteredImageSrcs = filteredSegments.filter(s => s.image).map(s => s.image!.src);
    const assertAbsent = (url: string) => {
      if (filteredImageSrcs.includes(url)) {
        throw new Error(`Excluded URL still present: ${url}. Actual: ${JSON.stringify(filteredImageSrcs)}`);
      }
    };
    const assertPresent = (url: string) => {
      if (!filteredImageSrcs.includes(url)) {
        throw new Error(`Expected URL not present after filtering: ${url}. Actual: ${JSON.stringify(filteredImageSrcs)}`);
      }
    };
    assertAbsent("https://www.kentramblers.org.uk/banners/autumn_oasts.jpg");
    assertAbsent("https://www.kentramblers.org.uk/footer-bg.png");
    assertPresent("https://www.kentramblers.org.uk/images/chipstead.JPG");
  });

});

describe("eden valley [absolute image, caption] pairs e2e", () => {
  it("collects nested rows as [absolute image, caption] pairs for eden valley", async () => {
    const filePath = path.join(__dirname, "../../test-data/e2e-migration-input-eden-valley.md");
    const markdown = fs.readFileSync(filePath, "utf-8");
    const baseUrl = "https://www.kentramblers.org.uk";
    const segments: ScrapedSegment[] = parseMarkdownToSegments(markdown, baseUrl);
    const page: ScrapedPage = {path: "/eden-valley-walk", title: "Eden Valley Walk", segments};
    const engine = new PageTransformationEngine();
    const config: PageTransformationConfig = {
      name: "E2E Eden Valley Collect",
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
              {columns: 8, content: {type: ContentMatchType.TEXT, textPattern: TextMatchPattern.ALL_TEXT_UNTIL_IMAGE}},
              {
                columns: 4,
                nestedRows: {
                  contentMatcher: {
                    type: ContentMatchType.COLLECT_WITH_BREAKS,
                    breakOnImage: true,
                    groupTextWithImage: true,
                    stopCondition: {onDetect: [SegmentType.HEADING]}
                  },
                  rowTemplate: {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false},
                  imageRowTemplate: {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false}
                }
              }
            ]
          }
        }
      ]
    };
    const uploadPreserveAbsolute = async (image: ScrapedImage): Promise<string> => image.src;
    const result: PageContent = await engine.transform(page, config, uploadPreserveAbsolute);
    debugLog("PageContent result:", JSON.stringify(result, null, 2));
    const nested = result.rows?.[0].columns[1].rows || [];
    const pairs = nested
      .filter(r => r.columns[0].imageSource)
      .map(r => [r.columns[0].imageSource as string, r.columns[0].contentText as string]);
    const expected = [
      ["https://www.kentramblers.org.uk/images/hever01.jpg", "Hever Castle"],
      ["https://www.kentramblers.org.uk/images/penshurst01.jpg", "Penshurst"],
      ["https://www.kentramblers.org.uk/images/penshurst02.jpg", "Penshurst"],
      ["https://www.kentramblers.org.uk/images/penshurst03.jpg", "Penshurst Place"]
    ];
    for (const [img, caption] of expected) {
      const found = pairs.some(([i, c]) => i === img && c === caption);
      if (!found) {
        const actual = pairs.map(([i, c]) => `${i} | ${c}`).join(", ");
        throw new Error(`Expected pair not found: ${img} | ${caption}. Actual: [${actual}]`);
      }
    }
  });
});
