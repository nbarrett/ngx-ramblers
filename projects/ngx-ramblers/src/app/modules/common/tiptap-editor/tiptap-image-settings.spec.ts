import {afterEach, describe, expect, it, vi} from "vitest";
import {Editor} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {SpacedImage} from "./spaced-image.extension";
import {TiptapMarkdownEditor} from "./tiptap-markdown-editor";

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
});
