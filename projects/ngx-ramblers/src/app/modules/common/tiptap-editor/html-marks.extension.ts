import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import { JSONContent } from "@tiptap/core";

type MarkRenderHelpers = { renderChildren: (nodes: JSONContent | JSONContent[], separator?: string) => string };

function markdownMark(content: string, marker: string): string {
  const leadingWhitespace = content.match(/^\s*/)?.[0] ?? "";
  const trailingWhitespace = content.match(/\s*$/)?.[0] ?? "";
  const markedContent = content.slice(leadingWhitespace.length, content.length - trailingWhitespace.length);
  return markedContent ? `${leadingWhitespace}${marker}${markedContent}${marker}${trailingWhitespace}` : content;
}

export function markdownMarksForClipboard(markdown: string): string {
  return markdown
    .replace(/<strong>([\s\S]*?)<\/strong>/g, (_match, content: string) => markdownMark(content, "**"))
    .replace(/<em>([\s\S]*?)<\/em>/g, (_match, content: string) => markdownMark(content, "*"));
}

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
