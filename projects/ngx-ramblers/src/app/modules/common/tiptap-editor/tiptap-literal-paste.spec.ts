import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { MermaidCodeBlock } from "./mermaid-code-block.extension";
import { SafeParagraph } from "./html-marks.extension";
import { Markdown } from "@tiptap/markdown";
import { vi } from "vitest";
import { TiptapMarkdownEditor } from "./tiptap-markdown-editor";
import { TiptapPasteEvent } from "../../../models/tiptap-editor.model";
import { renderEmailComposerMarkdown } from "../../../functions/email-composer-markdown";

describe("editor paste confirmation", () => {
  const diagnostic = "From: Alex Reed <alex.reed@example.com>\nSubject: Keep this in the body\n\n% diff before.txt after.txt\n< <link rel=\"canonical\" href=\"https://group.example.org.uk/example.pdf\">\n---\n> <meta property=\"og:url\" content=\"example\">\n  spacing    stays\n    four spaces stay\n1) Not a list\n1. Not a list\n# Not a heading\n**Not bold**\n```html\n<meta name=\"example\">\n```";

  function editor() {
    return new Editor({extensions: [StarterKit.configure({codeBlock: false, paragraph: false}), SafeParagraph, MermaidCodeBlock, Markdown], content: "", contentType: "markdown"});
  }

  function context(instance: Editor | null = null) {
    return Object.assign(Object.create(TiptapMarkdownEditor.prototype), {
      editor: instance,
      literalPasteShortcut: false,
      sourceMode: false,
      pendingLiteralPaste: null,
      pendingLiteralHtml: null,
      pasteError: "",
      pasteDetectionService: {looksLikeLiteralPlainText: () => true},
      changeDetector: {detectChanges: vi.fn()},
      editingChange: {emit: vi.fn()},
      rawPaste: {emit: vi.fn()},
      enterDetailMode: vi.fn(),
      zone: {run: (fn: () => void) => fn()}
    });
  }

  function clipboard(text: string, html = "") {
    return {preventDefault: vi.fn(), clipboardData: {getData: (type: string) => type === "text/plain" ? text : type === "text/html" ? html : ""}} as unknown as ClipboardEvent;
  }

  it.each([true, false])("preserves diagnostic text through draft reload and sending with preformatted=%s", preformatted => {
    const original = editor();
    const restored = editor();
    try {
      const instance = context(original);
      instance.pendingLiteralPaste = diagnostic;
      if (preformatted) {
        instance.confirmLiteralPaste();
      } else {
        instance.confirmFormattedPaste();
      }
      const markdown = original.getMarkdown();
      restored.commands.setContent(markdown, {contentType: "markdown"});
      expect(restored.getText()).toBe(original.getText());
      const document = new DOMParser().parseFromString(renderEmailComposerMarkdown(markdown), "text/html");
      expect(document.body.textContent).toContain("Alex Reed <alex.reed@example.com>");
      expect(document.body.textContent).toContain("<link rel=\"canonical\"");
      expect(document.body.textContent).toContain("# Not a heading");
      expect(document.body.textContent).toContain("**Not bold**");
      expect(document.body.textContent).toContain("    four spaces stay");
      expect(document.body.textContent).toContain("1) Not a list");
      expect(document.querySelector("meta, link, blockquote, strong, h1, hr, ol")).toBeNull();
    } finally {
      original.destroy();
      restored.destroy();
    }
  });

  it("does not emit extraction before confirmation and passes the original clipboard when confirmed", () => {
    const instance = context();
    const html = "<h1>Proposed subject</h1><p>Body</p>";
    const event = clipboard("Proposed subject\nBody", html);
    expect(instance.handleLiteralPaste(event)).toBe(true);
    expect(instance.rawPaste.emit).not.toHaveBeenCalled();
    instance.rawPaste.emit.mockImplementation((paste: TiptapPasteEvent) => paste.consume());
    instance.confirmFormattedPaste();
    expect(instance.rawPaste.emit).toHaveBeenCalledOnce();
    expect(instance.rawPaste.emit.mock.calls[0][0]).toMatchObject({text: "Proposed subject\nBody", html, confirmed: true});
    expect(instance.pendingLiteralPaste).toBeNull();
  });

  it("pastes immediately through the plain-paste shortcut without offering extraction", () => {
    const instance = context(editor());
    try {
      instance.literalPasteShortcut = true;
      expect(instance.handleLiteralPaste(clipboard(diagnostic))).toBe(true);
      expect(instance.literalPasteShortcut).toBe(false);
      expect(instance.rawPaste.emit).not.toHaveBeenCalled();
      expect(instance.editor.state.doc.firstChild.textContent).toBe(diagnostic);
    } finally {
      instance.editor.destroy();
    }
  });

  it("leaves internal editor copies to the normal paste handler", () => {
    const instance = context();
    expect(instance.handleLiteralPaste(clipboard("# Subject\nBody", '<p data-pm-slice="1 1 []">Content</p>'))).toBe(false);
    expect(instance.pendingLiteralPaste).toBeNull();
  });

  it.each(["Control", "Meta"])("uses %s+Shift+V for one plain paste", modifier => {
    const instance = context();
    instance.handleEmojiSuggestionKey = () => false;
    instance.handleListIndentKey = () => false;
    expect(instance.handleEditorKeyDown(new KeyboardEvent("keydown", {key: "V", ctrlKey: modifier === "Control", metaKey: modifier === "Meta", shiftKey: true}))).toBe(false);
    expect(instance.literalPasteShortcut).toBe(true);
    instance.handleEditorKeyDown(new KeyboardEvent("keydown", {key: "v", ctrlKey: true}));
    expect(instance.literalPasteShortcut).toBe(false);
  });
});

describe("emoji suggestions while composer change detection is detached", () => {
  it("paints the shortcode list with detectChanges so it still appears while typing", () => {
    const detectChanges = vi.fn();
    const view = Object.assign(Object.create(TiptapMarkdownEditor.prototype), {
      editable: true,
      emojiSuggestions: [],
      emojiActiveIndex: 0,
      emojiSuggestionLimit: 36,
      emojiShortcodeRange: null,
      changeDetector: {detectChanges, markForCheck: vi.fn()},
      zone: {run: (fn: () => void) => fn()},
      emojiShortcodeService: {suggestionsFor: () => [{shortname: ":sun:", unicode: "☀️"}]},
      editor: {
        isActive: () => false,
        state: {
          selection: {
            $from: {
              pos: 5,
              parentOffset: 4,
              parent: {textBetween: () => ":sun"}
            }
          }
        },
        view: {
          coordsAtPos: () => ({bottom: 0, left: 0}),
          dom: {closest: () => null}
        }
      }
    }) as TiptapMarkdownEditor;
    view["refreshEmojiSuggestions"]();
    expect(view["emojiSuggestions"]).toEqual([{shortname: ":sun:", unicode: "☀️"}]);
    expect(detectChanges).toHaveBeenCalled();
    expect(view["changeDetector"].markForCheck).not.toHaveBeenCalled();
  });
});
