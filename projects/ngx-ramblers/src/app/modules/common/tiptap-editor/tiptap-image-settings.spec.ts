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
      changeDetector: {markForCheck: vi.fn()},
      positionTokenEditor: vi.fn(),
      positionImageHandle: vi.fn()
    });
    editor.on("selectionUpdate", () => instance.updateSelectionChrome());
    return instance;
  }

  it("selects an image without opening its settings", () => {
    const instance = imageEditor();
    instance.editor.commands.setNodeSelection(0);
    instance.updateSelectionChrome();
    expect(instance.imageSelected).toBe(true);
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
