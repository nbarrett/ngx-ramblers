import { marked } from "marked";

export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) {
    return "";
  }
  return marked.parse(markdown, {async: false}) as string;
}
