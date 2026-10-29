import {afterEach, describe, expect, it, vi} from "vitest";
import {Editor} from "@tiptap/core";
import {Markdown} from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import {SpacedImage} from "./spaced-image.extension";
import {TiptapMarkdownEditor} from "./tiptap-markdown-editor";
import {storedAwsImageUrls} from "../../../functions/aws-image-paths";

describe("image settings trigger", () => {
  const editors: Editor[] = [];
  afterEach(() => editors.splice(0).forEach(editor => editor.destroy()));

  function imageEditor() {
    const editor = new Editor({extensions: [StarterKit, SpacedImage], content: '<img src="/image.png"><p>Message</p>'});
    editors.push(editor);
    const instance = Object.create(TiptapMarkdownEditor.prototype);
    Object.assign(instance, {
      editor,
      editable: true,
      imageSelected: false,
      imageSettingsOpen: false,
      imageSettingsSelectionPosition: null,
      zone: {run: action => action()},
      changeDetector: {markForCheck: vi.fn(), detectChanges: vi.fn()},
      flushMarkdownEmit: vi.fn(),
      positionTokenEditor: vi.fn(),
      positionImageHandle: vi.fn()
    });
    editor.on("selectionUpdate", () => instance.updateSelectionChrome());
    return instance;
  }

  it("preserves images between text blocks in rich HTML", async () => {
    const instance = imageEditor();
    instance.editor.commands.setContent("<p></p>");
    instance.logger = {error: vi.fn()};
    await instance.pasteRichHtmlWithImages('<p>Book one</p><img src="https://group.example.org.uk/first.png"><p>Book two</p><img src="https://group.example.org.uk/second.png">');
    const content = instance.editor.getJSON().content;
    expect(content.filter(node => node.type === "image").map(node => node.attrs.src)).toEqual([
      "https://group.example.org.uk/first.png", "https://group.example.org.uk/second.png"
    ]);
    expect(instance.editor.getText()).toContain("Book one");
    expect(instance.editor.getText()).toContain("Book two");
    expect(instance.pasteError).toBe("");
  });

  it("uploads every pasted image in clipboard order", async () => {
    const instance = imageEditor();
    const files = [new File(["first"], "first.png", {type: "image/png"}), new File(["second"], "second.png", {type: "image/png"})];
    instance.uploadedPastedImageUrl = vi.fn().mockResolvedValueOnce("/first.png").mockResolvedValueOnce("/second.png");
    instance.logger = {error: vi.fn()};
    await instance.uploadAndInsertPastedImage(files);
    expect(instance.uploadedPastedImageUrl.mock.calls.map(call => call[0])).toEqual(files);
    const images = instance.editor.getJSON().content.filter(node => node.type === "image");
    expect(images.map(node => node.attrs.src)).toEqual(expect.arrayContaining(["/first.png", "/second.png"]));
    expect(instance.pasteError).toBe("");
    expect(instance.pastedImageUploading).toBe(false);
  });

  it("selects an image without opening its settings", () => {
    const instance = imageEditor();
    instance.editor.commands.setNodeSelection(0);
    instance.updateSelectionChrome();
    expect(instance.imageSelected).toBe(true);
    expect(instance.changeDetector.markForCheck).toHaveBeenCalled();
    expect(instance.imageSettingsOpen).toBe(false);
  });

  it("opens and closes settings explicitly without changing the image", () => {
    const instance = imageEditor();
    const before = instance.editor.getJSON();
    instance.imageSettingsTarget = instance.editor.view.dom.querySelector("img");
    instance.toggleImageSettings();
    expect(instance.imageSettingsOpen).toBe(true);
    expect(instance.editor.isActive("image")).toBe(true);
    instance.toggleImageSettings();
    expect(instance.imageSettingsOpen).toBe(false);
    expect(instance.editor.getJSON()).toEqual(before);
  });

  it("closes settings when the selection moves away from the image", () => {
    const instance = imageEditor();
    instance.imageSettingsTarget = instance.editor.view.dom.querySelector("img");
    instance.toggleImageSettings();
    instance.editor.commands.setTextSelection(2);
    expect(instance.imageSettingsOpen).toBe(false);
    expect(instance.imageSettingsTarget).toBe(null);
  });

  it("does not emit a save merely because an existing image URL is normalised for editing", () => {
    const editor = new Editor({extensions: [StarterKit, SpacedImage, Markdown], content: "Initial", contentType: "markdown"});
    editors.push(editor);
    editor.commands.setNodeSelection(0);
    const instance = Object.create(TiptapMarkdownEditor.prototype);
    const emit = vi.fn();
    Object.assign(instance, {
      editor,
      documentConversionService: {relativeImageUrls: storedAwsImageUrls},
      stripOrphanInlineMarks: markdown => markdown,
      clearEditorHistory: vi.fn(),
      queueMermaidPreviewRefresh: vi.fn(),
      valueChange: {emit},
      zone: {run: action => action()}
    });
    instance.syncValue("![App](api/aws/s3/site-content/app.png)");
    expect(editor.getMarkdown().trimEnd()).toBe("![App](site-content/app.png)");
    expect(emit).not.toHaveBeenCalled();
  });
});
