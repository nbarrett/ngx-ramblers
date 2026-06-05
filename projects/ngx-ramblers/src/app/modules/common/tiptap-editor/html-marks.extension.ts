import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import { JSONContent } from "@tiptap/core";

type MarkRenderHelpers = { renderChildren: (nodes: JSONContent | JSONContent[], separator?: string) => string };

export const HtmlBold = Bold.extend({
  renderMarkdown(node: JSONContent, helpers: MarkRenderHelpers): string {
    return `<strong>${helpers.renderChildren(node.content ?? [])}</strong>`;
  }
});

export const HtmlItalic = Italic.extend({
  renderMarkdown(node: JSONContent, helpers: MarkRenderHelpers): string {
    return `<em>${helpers.renderChildren(node.content ?? [])}</em>`;
  }
});
