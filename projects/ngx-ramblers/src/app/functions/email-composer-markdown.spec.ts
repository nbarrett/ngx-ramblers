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

  it("puts body images on a white cell so transparent PNGs stay white in mail clients", () => {
    const html = renderEmailComposerMarkdown("![Phones](https://example.com/phones.png)");

    expect(html).toContain("bgcolor=\"#ffffff\"");
    expect(html).toContain("background-color:#ffffff");
    expect(html).toContain("<img");
  });
});
