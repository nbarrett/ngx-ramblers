import { Node } from "@tiptap/core";

export const PAGE_BREAK_NODE_NAME = "pageBreak";
export const PAGE_BREAK_MARKER = "PAGEBREAK";

export const PageBreak = Node.create({
  name: PAGE_BREAK_NODE_NAME,
  group: "block",
  atom: true,
  selectable: true,
  marks: "",
  parseHTML() {
    return [{tag: "page-break"}];
  },
  renderHTML() {
    return ["page-break", {class: "page-break-chip", contenteditable: "false"},
      ["span", {class: "page-break-label"}, "Page break"]];
  },
  markdownTokenName: PAGE_BREAK_NODE_NAME,
  markdownTokenizer: {
    name: PAGE_BREAK_NODE_NAME,
    level: "block",
    start: (source: string) => source.indexOf(PAGE_BREAK_MARKER),
    tokenize: (source: string) => {
      const match = /^PAGEBREAK[ \t]*(?:\n+|$)/.exec(source);
      if (!match) {
        return undefined;
      }
      return {type: PAGE_BREAK_NODE_NAME, raw: match[0]};
    }
  },
  parseMarkdown: () => ({type: PAGE_BREAK_NODE_NAME}),
  renderMarkdown: () => PAGE_BREAK_MARKER
});
