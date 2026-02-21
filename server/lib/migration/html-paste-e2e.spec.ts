import expect from "expect";
import { describe, it } from "mocha";
import * as fs from "fs";
import * as path from "path";
import { htmlToMarkdown } from "./turndown-service-factory";
import { PageTransformationEngine } from "./page-transformation-engine";
import { PageContent, PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { ScrapedImage, ScrapedPage, ScrapedSegment } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { ContentMatchType, ImageMatchPattern, PageTransformationConfig, SegmentType, TextMatchPattern, TransformationActionType } from "../../../projects/ngx-ramblers/src/app/models/page-transformation.model";
import { buildMarkdownPastePreview, buildHtmlPastePreview } from "./html-paste-preview";

function parseMarkdownToSegments(markdown: string): ScrapedSegment[] {
  const segments: ScrapedSegment[] = [];
  const imageRegex = /!\[([^\]]*)]\(([^)]+)\)/g;
  let lastIndex = 0;

  Array.from(markdown.matchAll(imageRegex)).forEach(match => {
    const before = markdown.substring(lastIndex, match.index).trim();
    if (before) segments.push({ text: before });
    const alt = match[1] || "";
    const src = match[2] || "";
    const image: ScrapedImage = { src, alt };
    segments.push({ text: alt || "Image", image });
    lastIndex = match.index + match[0].length;
  });

  const remaining = markdown.substring(lastIndex).trim();
  if (remaining) segments.push({ text: remaining });

  return segments;
}

async function uploadMock(image: ScrapedImage): Promise<string> {
  const filename = image.src.split("/").pop() || image.src;
  return `uploaded:${filename}`;
}

describe("HTML Paste E2E", () => {
  describe("relative URLs resolution with base URL", () => {
    it("converts relative image URLs to absolute using base URL", () => {
      const html = `
        <h1>Test Page</h1>
        <p>Some content</p>
        <img src="images/photo.jpg" alt="Photo">
        <a href="about.html">About</a>
      `;
      const baseUrl = "https://example.com/pages/";
      const markdown = htmlToMarkdown(html, baseUrl);

      expect(markdown).toMatch(/!\[Photo\]\(https:\/\/example\.com\/pages\/images\/photo\.jpg\)/);
      expect(markdown).toMatch(/\[About\]\(https:\/\/example\.com\/pages\/about\.html\)/);
    });

    it("handles absolute URLs correctly", () => {
      const html = `
        <img src="https://cdn.example.com/image.png" alt="CDN Image">
        <a href="https://other.com/page">External</a>
      `;
      const baseUrl = "https://example.com/";
      const markdown = htmlToMarkdown(html, baseUrl);

      expect(markdown).toMatch(/!\[CDN Image\]\(https:\/\/cdn\.example\.com\/image\.png\)/);
      expect(markdown).toMatch(/\[External\]\(https:\/\/other\.com\/page\)/);
    });

    it("works without base URL for already absolute URLs", () => {
      const html = `<img src="https://example.com/image.jpg" alt="Image">`;
      const markdown = htmlToMarkdown(html);

      expect(markdown).toMatch(/!\[Image\]\(https:\/\/example\.com\/image\.jpg\)/);
    });
  });

  describe("HTML paste to PageContent rows", () => {
    it("converts Kent Ramblers HTML to PageContent with images", async () => {
      const html = `
        <html>
          <head><title>Walk 81</title></head>
          <body>
            <h1>Kent Ramblers: Walk 81</h1>
            <h2>Benenden Short Circular</h2>
            <p>Distance: 2.7 miles (1h 15m)</p>
            <p>OS Map: Explorer 125 (Start at TQ807329)</p>
            <img src="images/banner_081.jpg" alt="Banner">
            <p>Park in the street or around village green.</p>
            <img src="images/benenden.jpg" alt="Benenden Village">
            <p>This secluded, very pretty, village.</p>
            <h2>Points of Interest</h2>
          </body>
        </html>
      `;

      const baseUrl = "https://www.kentramblers.org.uk/walks/walk-81/";
      const markdown = htmlToMarkdown(html, baseUrl);
      const segments = parseMarkdownToSegments(markdown);
      const page: ScrapedPage = { path: "/walk-81", title: "Walk 81", segments };

      const engine = new PageTransformationEngine();
      const config: PageTransformationConfig = {
        name: "HTML Paste Test",
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

      const result: PageContent = await engine.transform(page, config, uploadMock);

      expect(result.rows).toBeTruthy();
      expect(result.rows.length).toBeGreaterThan(0);

      const mainColumn = result.rows[0].columns[0];
      expect(mainColumn.contentText).toMatch(/Kent Ramblers: Walk 81/);
      expect(mainColumn.contentText).toMatch(/Benenden Short Circular/);

      const sideColumn = result.rows[0].columns[1];
      expect(sideColumn.rows).toBeTruthy();
      expect(sideColumn.rows.length).toBeGreaterThan(0);

      const imageRows = sideColumn.rows.filter(r => r.columns[0].imageSource);
      expect(imageRows.length).toBe(2);

      const bannerRow = imageRows.find(r => r.columns[0].imageSource === "uploaded:banner_081.jpg");
      expect(bannerRow).toBeTruthy();

      const benRow = imageRows.find(r => r.columns[0].imageSource === "uploaded:benenden.jpg");
      expect(benRow).toBeTruthy();
    });

    it("preserves absolute image URLs throughout transformation", async () => {
      const html = `
        <h1>Test</h1>
        <p>Content here</p>
        <img src="photo.jpg" alt="Photo">
      `;

      const baseUrl = "https://example.com/pages/";
      const markdown = htmlToMarkdown(html, baseUrl);
      const segments = parseMarkdownToSegments(markdown);
      const page: ScrapedPage = { path: "/test", title: "Test", segments };

      const engine = new PageTransformationEngine();
      const config: PageTransformationConfig = {
        name: "Absolute URL Test",
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

      const uploadPreserveAbsolute = async (image: ScrapedImage): Promise<string> => image.src;
      const result: PageContent = await engine.transform(page, config, uploadPreserveAbsolute);

      const imageSource = result.rows[0].columns[0].imageSource;
      expect(imageSource).toBe("https://example.com/pages/photo.jpg");
    });
  });

  describe("multi-paragraph HTML paste", () => {
    it("splits paragraphs into separate rows when requested", async () => {
      const html = `
        <h1>Walking Guide</h1>
        <p>First paragraph about the walk.</p>
        <p>Second paragraph with more details.</p>
        <p>Third paragraph with directions.</p>
      `;

      const markdown = htmlToMarkdown(html);
      const paragraphs = markdown.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p.length > 0);

      expect(paragraphs.length).toBeGreaterThan(2);
      expect(paragraphs[0]).toMatch(/Walking Guide/);
      expect(paragraphs[1]).toMatch(/First paragraph/);
      expect(paragraphs[2]).toMatch(/Second paragraph/);
      expect(paragraphs[3]).toMatch(/Third paragraph/);
    });
  });

  describe("Kent Ramblers Walk 81 real-world HTML", () => {
    let html: string;

    before(() => {
      const testDataPath = path.join(__dirname, "../../test-data/kent-ramblers-walk-81.html");
      html = fs.readFileSync(testDataPath, "utf-8");
    });

    it("converts real walk HTML to markdown with absolute URLs", () => {
      const baseUrl = "https://www.kentramblers.org.uk/walks/walk-81/";
      const markdown = htmlToMarkdown(html, baseUrl);

      expect(markdown).toMatch(/Kent Ramblers: Walk 81/);
      expect(markdown).toMatch(/Benenden Short Circular/);
      expect(markdown).toMatch(/Distance.*2\.7 miles/);
      expect(markdown).toMatch(/OS Map.*Explorer 125/);

      // Check that relative image URLs were converted to absolute
      expect(markdown).toMatch(/!\[\]\(https:\/\/www\.kentramblers\.org\.uk\/walks\/walk-81\/images\/banner_081\.jpg\)/);
      expect(markdown).toMatch(/!\[\]\(https:\/\/www\.kentramblers\.org\.uk\/walks\/walk-81\/map_081\.jpg\)/);
      expect(markdown).toMatch(/!\[\]\(https:\/\/www\.kentramblers\.org\.uk\/walks\/walk-81\/images\/P081a\.jpg\)/);

      // Check Points of Interest content
      expect(markdown).toMatch(/Points of Interest/);
      expect(markdown).toMatch(/Benenden School/);
      expect(markdown).toMatch(/The Grange/);
      expect(markdown).toMatch(/Public Transport/);
    });

    it("extracts all images from the walk HTML", () => {
      const baseUrl = "https://www.kentramblers.org.uk/walks/walk-81/";
      const markdown = htmlToMarkdown(html, baseUrl);
      const segments = parseMarkdownToSegments(markdown);

      const imageSegments = segments.filter(s => s.image);

      // Should have logo, banner, map, and school image at minimum
      expect(imageSegments.length).toBeGreaterThanOrEqual(4);

      const logoImage = imageSegments.find(s => s.image?.src.includes("ramblers-logo.gif"));
      expect(logoImage).toBeTruthy();
      expect(logoImage?.image?.src).toBe("https://www.kentramblers.org.uk/ramblers-logo.gif");

      const bannerImage = imageSegments.find(s => s.image?.src.includes("banner_081.jpg"));
      expect(bannerImage).toBeTruthy();
      expect(bannerImage?.image?.src).toBe("https://www.kentramblers.org.uk/walks/walk-81/images/banner_081.jpg");

      const mapImage = imageSegments.find(s => s.image?.src.includes("map_081.jpg"));
      expect(mapImage).toBeTruthy();
      expect(mapImage?.image?.src).toBe("https://www.kentramblers.org.uk/walks/walk-81/map_081.jpg");

      const schoolImage = imageSegments.find(s => s.image?.src.includes("P081a.jpg"));
      expect(schoolImage).toBeTruthy();
      expect(schoolImage?.image?.src).toBe("https://www.kentramblers.org.uk/walks/walk-81/images/P081a.jpg");
    });

    it("transforms walk HTML to PageContent with main content column", async () => {
      const baseUrl = "https://www.kentramblers.org.uk/walks/walk-81/";
      const markdown = htmlToMarkdown(html, baseUrl);
      const segments = parseMarkdownToSegments(markdown);
      const page: ScrapedPage = { path: "/walk-81", title: "Walk 81", segments };

      const engine = new PageTransformationEngine();
      const config: PageTransformationConfig = {
        name: "Kent Ramblers Walk 81 Test",
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
                { columns: 12, content: { type: ContentMatchType.TEXT, textPattern: TextMatchPattern.REMAINING_TEXT } }
              ]
            }
          }
        ]
      };

      const result: PageContent = await engine.transform(page, config, uploadMock);

      expect(result.rows).toBeTruthy();
      expect(result.rows.length).toBeGreaterThan(0);

      const mainColumn = result.rows[0].columns[0];
      expect(mainColumn.contentText).toMatch(/Kent Ramblers: Walk 81/);
      expect(mainColumn.contentText).toMatch(/Benenden Short Circular/);
      expect(mainColumn.contentText).toMatch(/Distance.*2\.7 miles/);
    });

    it("transforms walk HTML extracting first image", async () => {
      const baseUrl = "https://www.kentramblers.org.uk/walks/walk-81/";
      const markdown = htmlToMarkdown(html, baseUrl);
      const segments = parseMarkdownToSegments(markdown);
      const page: ScrapedPage = { path: "/walk-81", title: "Walk 81", segments };

      const engine = new PageTransformationEngine();
      const config: PageTransformationConfig = {
        name: "Extract First Image",
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

      const result: PageContent = await engine.transform(page, config, uploadMock);

      expect(result.rows).toBeTruthy();
      expect(result.rows.length).toBe(1);

      const imageColumn = result.rows[0].columns[0];
      // First image is the ramblers logo
      expect(imageColumn.imageSource).toBe("uploaded:ramblers-logo.gif");
    });

    it("transforms walk HTML to two-column layout with text and images", async () => {
      const baseUrl = "https://www.kentramblers.org.uk/walks/walk-81/";
      const markdown = htmlToMarkdown(html, baseUrl);
      const segments = parseMarkdownToSegments(markdown);
      const page: ScrapedPage = { path: "/walk-81", title: "Walk 81", segments };

      const engine = new PageTransformationEngine();
      const config: PageTransformationConfig = {
        name: "Two Column Layout",
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
                      groupTextWithImage: true
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

      const result: PageContent = await engine.transform(page, config, uploadMock);

      expect(result.rows).toBeTruthy();
      expect(result.rows.length).toBe(1);

      const mainColumn = result.rows[0].columns[0];
      // The HTML has both "Walk 87" in the title and "Walk 81" in the h1
      // ALL_TEXT_UNTIL_IMAGE stops at the first image (ramblers logo)
      expect(mainColumn.contentText).toMatch(/Kent Ramblers.*Walk (81|87)/);
      expect(mainColumn.contentText.length).toBeGreaterThan(0);

      const sideColumn = result.rows[0].columns[1];
      expect(sideColumn.rows).toBeTruthy();
      expect(sideColumn.rows.length).toBeGreaterThan(0);

      // Find image rows in the sidebar - should have at least one image
      const imageRows = sideColumn.rows.filter(r => r.columns[0].imageSource);
      expect(imageRows.length).toBeGreaterThan(0);

      // Verify at least one image is from the walk content
      const walkImages = imageRows.filter(r =>
        r.columns[0].imageSource.includes("banner") ||
        r.columns[0].imageSource.includes("map") ||
        r.columns[0].imageSource.includes("P081a")
      );
      expect(walkImages.length).toBeGreaterThan(0);
    });

    it("preserves walking directions paragraphs in main content", async () => {
      const baseUrl = "https://www.kentramblers.org.uk/walks/walk-81/";
      const markdown = htmlToMarkdown(html, baseUrl);

      // Check that key walking directions are preserved
      expect(markdown).toMatch(/Park in the street or around village green/);
      expect(markdown).toMatch(/walk westwards to cross-roads/);
      expect(markdown).toMatch(/Turn right in direction of Benenden Golf Course/);
      expect(markdown).toMatch(/Go downhill, passing pond on left/);
      expect(markdown).toMatch(/Cross road and turn right/);
      expect(markdown).toMatch(/Climb steadily then emerge over stile to road/);
      expect(markdown).toMatch(/Cross very carefully/);
      expect(markdown).toMatch(/turn left back to Post Office/);
    });
  });

  describe("Interactive paste preview scenarios", () => {
    it("should split markdown with images and captions for paste preview", () => {
      const markdown = `# Walk Title

![Banner](banner.jpg)

![Map](map.jpg)

Route description here.`;

      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBeGreaterThan(0);
      const imageRows = preview.rows.filter((r: any) => r.imageSource);
      expect(imageRows.length).toBe(2);
    });

    it("should handle short captions with images for paste", () => {
      const html = `
        <h2>Section Title</h2>
        <img src="photo.jpg" alt="Photo">
        <p>Short caption</p>
      `;
      const baseUrl = "https://example.com/";

      const preview = buildHtmlPastePreview(html, baseUrl);

      expect(preview.rows).toBeDefined();
      expect(preview.rows.length).toBeGreaterThan(0);

      const imageRow = preview.rows.find((r: any) => r.imageSource === "https://example.com/photo.jpg");
      expect(imageRow).toBeDefined();
    });

    it("should preserve image alt text in paste preview", () => {
      const markdown = `![Detailed description of photo](photo.jpg)

Caption text`;
      const preview = buildMarkdownPastePreview(markdown);

      const imageRow = preview.rows.find((r: any) => r.imageSource);
      expect(imageRow).toBeDefined();
      expect(imageRow.alt).toBe("Detailed description of photo");
    });
  });
});
