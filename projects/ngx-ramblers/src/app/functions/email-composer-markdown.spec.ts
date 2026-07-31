import { renderEmailComposerMarkdown } from "./email-composer-markdown";

describe("renderEmailComposerMarkdown", () => {
  it("renders tables with self-contained email-safe styling", () => {
    const html = renderEmailComposerMarkdown("| Heading | Value |\n| --- | --- |\n| One | Two |");

    expect(html).toContain("<table style=\"border-collapse:collapse;");
    expect(html).toContain("<th style=\"border:1px solid #ced4da;");
    expect(html).toContain("<td style=\"border:1px solid #ced4da;");
  });

  it("renders quoted content with self-contained styling", () => {
    const html = renderEmailComposerMarkdown("> Quoted content");

    expect(html).toContain("<blockquote style=\"border-left:4px solid #9bc8ab;");
    expect(html).toContain("background-color:#f7fbf8;");
  });

  it("holds quoted images to a readable size", () => {
    const html = renderEmailComposerMarkdown("> ![Logo](https://example.com/logo.png)");

    expect(html).toContain("max-width:300px;height:auto;");
  });

  it("leaves images outside a quote at full width", () => {
    const html = renderEmailComposerMarkdown("![Logo](https://example.com/logo.png)");

    expect(html).toContain("max-width:100%;height:auto;");
    expect(html).not.toContain("max-width:300px");
  });
});
