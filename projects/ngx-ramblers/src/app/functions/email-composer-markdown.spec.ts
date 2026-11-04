import { renderEmailComposerMarkdown } from "./email-composer-markdown";
import {EmailImageLayout, EVENT_EMAIL_IMAGE_HEIGHT} from "../models/email-composer.model";

describe("renderEmailComposerMarkdown", () => {
  it("centres programme images in a fixed height area without cropping", () => {
    const html = renderEmailComposerMarkdown("![Walk](https://example.com/walk.jpg)", EmailImageLayout.EVENT);
    expect(html).toContain(`height:${EVENT_EMAIL_IMAGE_HEIGHT}px`);
    expect(html).toContain("object-fit:cover");
    expect(html).toContain("object-position:center");
    expect(html).toContain(`height="${EVENT_EMAIL_IMAGE_HEIGHT}" valign="middle"`);
    expect(html).not.toContain("height:auto");
  });

  it("uses the chosen programme image height", () => {
    const html = renderEmailComposerMarkdown("![Walk](https://example.com/walk.jpg)", EmailImageLayout.EVENT, 160);
    expect(html).toContain("height:160px");
    expect(html).toContain("height=\"160\"");
    expect(html).not.toContain(`height:${EVENT_EMAIL_IMAGE_HEIGHT}px`);
  });
  it("renders tables with self-contained email-safe styling", () => {
    const html = renderEmailComposerMarkdown("| Heading | Value |\n| --- | --- |\n| One | Two |");

    expect(html).toContain("<table width=\"100%\" style=\"border-collapse:collapse;");
    expect(html).toContain("table-layout:fixed;");
    expect(html).toContain("border:1px solid #ced4da;");
    expect(html).toContain("width:50%;");
  });

  it("keeps a three-column listing readable in the email width", () => {
    const html = renderEmailComposerMarkdown("| Date, start and distance | Walk and leader | Description |\n| --- | --- | --- |\n| Sunday | Hillside Park | A long walk description that would otherwise steal the width. |");
    expect(html).toContain("table-layout:fixed;");
    expect(html).toContain("width=\"30%\"");
    expect(html).toContain("width=\"28%\"");
    expect(html).toContain("width=\"42%\"");
    expect(html).toContain("word-break:normal;");
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

  it("puts body images on a white cell so transparent PNGs stay white in mail clients", () => {
    const html = renderEmailComposerMarkdown("![Phones](https://example.com/phones.png)");

    expect(html).toContain("bgcolor=\"#ffffff\"");
    expect(html).toContain("background-color:#ffffff");
    expect(html).toContain("<img");
  });
});
