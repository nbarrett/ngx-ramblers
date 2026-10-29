import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { SpacedImage } from "./spaced-image.extension";

describe("managed image editor storage", () => {
  const editors: Editor[] = [];
  afterEach(() => editors.splice(0).forEach(editor => editor.destroy()));

  ["site-content/app.png", "api/aws/s3/site-content/app.png"].forEach(src => {
    it(`displays ${src} through the API and serialises only its storage key`, () => {
      const editor = new Editor({
        extensions: [StarterKit, SpacedImage, Markdown],
        content: `![App](${src})`,
        contentType: "markdown"
      });
      editors.push(editor);
      expect(editor.view.dom.querySelector("img")?.getAttribute("src")).toBe("/api/aws/s3/site-content/app.png");
      expect(editor.getMarkdown()).toBe("![App](site-content/app.png)");
    });
  });

  it("normalises the source attribute used by the base image view", () => {
    const editor = new Editor({extensions: [StarterKit, SpacedImage.configure({resize: {enabled: true}}), Markdown], content: "![App](site-content/app.png)", contentType: "markdown"});
    editors.push(editor);
    expect(editor.view.dom.querySelector("img")?.getAttribute("src")).toBe("/api/aws/s3/site-content/app.png");
  });

  it("keeps image sizing while saving a storage key in HTML image markup", () => {
    const editor = new Editor({
      extensions: [StarterKit, SpacedImage, Markdown],
      content: `<img src="/api/aws/s3/site-content/app.png" style="width:240px">`,
      contentType: "markdown"
    });
    editors.push(editor);
    const stored = editor.getMarkdown();
    expect(stored).toContain(`src="site-content/app.png"`);
    expect(stored).toContain("width:240px");
    expect(stored).not.toContain("api/aws/s3/");
    expect(editor.view.dom.querySelector("img")?.getAttribute("src")).toBe("/api/aws/s3/site-content/app.png");
  });
});
