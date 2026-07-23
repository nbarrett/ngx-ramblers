import expect from "expect";
import { describe, it } from "mocha";
import { PageSeoDescriptor } from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import { withRepresentationAlternates, withServerContent } from "./serve-index-html";

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

  it("places public CMS content in ordinary semantic HTML", () => {
    const html = withServerContent("<html><head></head><body><app-root></app-root></body></html>", descriptor);
    expect(html).toContain("<main id=\"server-rendered-content\"><h1>Release Notes</h1><p>Public CMS content</p></main>");
    expect(html).not.toContain("<noscript>");
  });

  it("hides the server content after Angular populates the app root", () => {
    const html = withServerContent("<html><head></head><body><app-root></app-root></body></html>", descriptor);
    expect(html).toContain("app-root:not(:empty) + #server-rendered-content{display:none}");
  });

  it("does not duplicate a heading already supplied by the CMS", () => {
    const html = withServerContent("<html><head></head><body><app-root></app-root></body></html>", {
      ...descriptor,
      contentHtml: "<h1>CMS heading</h1><p>Content</p>"
    });
    expect(html).not.toContain("<h1>Release Notes</h1>");
    expect(html).toContain("<h1>CMS heading</h1>");
  });
});
