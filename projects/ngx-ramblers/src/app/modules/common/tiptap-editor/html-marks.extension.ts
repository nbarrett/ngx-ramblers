import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import { JSONContent } from "@tiptap/core";

type MarkRenderHelpers = { renderChildren: (nodes?: JSONContent | JSONContent[] | JSONContent, separator?: string) => string };

function markdownMark(content: string, marker: string): string {
  const leadingWhitespace = content.match(/^\s*/)?.[0] ?? "";
  const trailingWhitespace = content.match(/\s*$/)?.[0] ?? "";
  const markedContent = content.slice(leadingWhitespace.length, content.length - trailingWhitespace.length);
  return markedContent ? `${leadingWhitespace}${marker}${markedContent}${marker}${trailingWhitespace}` : content;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function markdownMarksForClipboard(markdown: string): string {
  return markdown
    .replace(/<strong>([\s\S]*?)<\/strong>/g, (_match, content: string) => markdownMark(content, "**"))
    .replace(/<em>([\s\S]*?)<\/em>/g, (_match, content: string) => markdownMark(content, "*"));
}

export function renderLinkMarkdown(node: JSONContent, helpers: MarkRenderHelpers): string {
  const href = String(node.attrs?.["href"] ?? "");
  const title = String(node.attrs?.["title"] ?? "");
  const target = node.attrs?.["target"];
  const text = helpers.renderChildren(node);
  const rel = String(node.attrs?.["rel"] || "noopener noreferrer");
  const titleAttr = title ? ` title="${escapeHtmlAttribute(title)}"` : "";
  return target === "_blank"
    ? `<a href="${escapeHtmlAttribute(href)}" target="_blank" rel="${escapeHtmlAttribute(rel)}"${titleAttr}>${text}</a>`
    : (title ? `[${text}](${href} "${title}")` : `[${text}](${href})`);
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

export const HtmlLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      target: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("target"),
        renderHTML: (attributes: Record<string, string | null>) => attributes["target"] ? { target: attributes["target"] } : {}
      },
      rel: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("rel"),
        renderHTML: (attributes: Record<string, string | null>) => attributes["rel"] ? { rel: attributes["rel"] } : {}
      }
    };
  },
  renderMarkdown(node: JSONContent, helpers: MarkRenderHelpers): string {
    return renderLinkMarkdown(node, helpers);
  }
});
