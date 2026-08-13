import expect from "expect";
import { describe, it } from "mocha";
import { OpenGraphType, PageSeoDescriptor } from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import {
  withAiDiscoveryLinks,
  withOpenGraphTags,
  withRepresentationAlternates,
  withRobotsMeta,
  withServerContent,
  withStructuredData
} from "./serve-index-html";

describe("serve-index-html", () => {
  const descriptor: PageSeoDescriptor = {
    title: "Release Notes",
    description: "Recent changes",
    contentHtml: "<p>Public CMS content</p>",
    exportablePath: "how-to/committee/release-notes"
  };

  it("advertises every CMS representation using the canonical page address", () => {
    const html = withRepresentationAlternates("<html><head></head></html>", "https://example.org", descriptor);
    expect(html).toContain("rel=\"alternate\" type=\"text/markdown\" href=\"https://example.org/how-to/committee/release-notes?format=markdown\"");
    expect(html).toContain("rel=\"alternate\" type=\"text/html\" href=\"https://example.org/how-to/committee/release-notes?format=html\"");
    expect(html).toContain("rel=\"alternate\" type=\"application/json\" href=\"https://example.org/how-to/committee/release-notes?format=json\"");
  });

  it("advertises site-wide AI discovery entry points on every page", () => {
    const html = withAiDiscoveryLinks("<html><head></head></html>", "https://example.org");
    expect(html).toContain("title=\"llms.txt\" href=\"https://example.org/llms.txt\"");
    expect(html).toContain("title=\"For AI assistants\" href=\"https://example.org/for-ai\"");
    expect(html).not.toContain("api/public/releases");
  });

  it("places public CMS content in ordinary semantic HTML", () => {
    const html = withServerContent("<html><head></head><body><app-root></app-root></body></html>", descriptor);
    expect(html).toContain("<main id=\"server-rendered-content\"><h1>Release Notes</h1><p>Public CMS content</p></main>");
    expect(html).toContain("#server-rendered-content{display:none}");
  });

  it("hides the server content from the first paint for JavaScript browsers", () => {
    const html = withServerContent("<html><head></head><body><app-root></app-root></body></html>", descriptor);
    expect(html).toContain("#server-rendered-content{display:none}");
    expect(html).toContain("<noscript><style>#server-rendered-content{display:revert}</style></noscript>");
    expect(html).not.toContain("app-root:not(:empty) + #server-rendered-content{display:none}");
  });

  it("does not duplicate a heading already supplied by the CMS", () => {
    const html = withServerContent("<html><head></head><body><app-root></app-root></body></html>", {
      ...descriptor,
      contentHtml: "<h1>CMS heading</h1><p>Content</p>"
    });
    expect(html).not.toContain("<h1>Release Notes</h1>");
    expect(html).toContain("<h1>CMS heading</h1>");
  });

  it("adds a robots meta tag when the SEO descriptor requests it", () => {
    const html = withRobotsMeta("<html><head></head></html>", "noindex, follow");
    expect(html).toContain("<meta name=\"robots\" content=\"noindex, follow\">");
  });

  it("leaves the head unchanged when no robots directive is supplied", () => {
    const html = withRobotsMeta("<html><head></head></html>", null);
    expect(html).toBe("<html><head></head></html>");
  });

  it("describes the page for Facebook and other link previews", () => {
    const html = withOpenGraphTags("<html><head></head></html>", "https://example.org", "Canterbury", descriptor, "/how-to/committee/release-notes");
    expect(html).toContain("<meta property=\"og:type\" content=\"website\">");
    expect(html).toContain("<meta property=\"og:title\" content=\"Canterbury — Release Notes\">");
    expect(html).toContain("<meta property=\"og:description\" content=\"Recent changes\">");
    expect(html).toContain("<meta property=\"og:url\" content=\"https://example.org/how-to/committee/release-notes\">");
    expect(html).toContain("<meta property=\"og:site_name\" content=\"Canterbury\">");
  });

  it("asks for a large preview card only when the page has an image", () => {
    const withImage = withOpenGraphTags("<html><head></head></html>", "https://example.org", "Canterbury", {...descriptor, imageUrl: "https://example.org/a.jpg"}, "/x");
    expect(withImage).toContain("<meta property=\"og:image\" content=\"https://example.org/a.jpg\">");
    expect(withImage).toContain("content=\"summary_large_image\"");
    const withoutImage = withOpenGraphTags("<html><head></head></html>", "https://example.org", "Canterbury", descriptor, "/x");
    expect(withoutImage).not.toContain("og:image");
    expect(withoutImage).toContain("content=\"summary\"");
  });

  it("marks an event page as an event rather than an ordinary page", () => {
    const html = withOpenGraphTags("<html><head></head></html>", "https://example.org", "Canterbury", {
      ...descriptor,
      openGraphType: OpenGraphType.EVENT
    }, "/walks/chilham-circular");
    expect(html).toContain("<meta property=\"og:type\" content=\"event\">");
  });

  it("escapes quotes so a title cannot break out of the tag", () => {
    const html = withOpenGraphTags("<html><head></head></html>", "https://example.org", "Canterbury", {
      ...descriptor,
      description: "A \"quoted\" description"
    }, "/x");
    expect(html).toContain("content=\"A &quot;quoted&quot; description\"");
  });

  it("adds schema.org JSON-LD when the descriptor carries structured data", () => {
    const html = withStructuredData("<html><head></head></html>", {
      ...descriptor,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Event",
        name: "Chilham circular",
        startDate: "2026-08-15T09:00:00Z"
      }
    });
    expect(html).toContain("<script type=\"application/ld+json\">");
    expect(html).toContain("\"@type\":\"Event\"");
    expect(html).toContain("\"name\":\"Chilham circular\"");
  });

  it("escapes any angle bracket that could close the JSON-LD script early", () => {
    const html = withStructuredData("<html><head></head></html>", {
      ...descriptor,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Event",
        name: "Walk </script><script>alert(1)</script>"
      }
    });
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script");
  });

  it("leaves the head unchanged when there is no structured data", () => {
    expect(withStructuredData("<html><head></head></html>", descriptor)).toBe("<html><head></head></html>");
  });
});

