import { Marked } from "marked";

const emailComposerMarked = new Marked({
  extensions: [
    {
      name: "underline",
      level: "inline",
      renderer(token: any) {
        const inner = token.tokens ? (this as any).parser.parseInline(token.tokens) : (token.text ?? "");
        return `<u>${inner}</u>`;
      }
    }
  ]
});

export function renderEmailComposerMarkdown(markdown: string): string {
  if (!markdown) {
    return "";
  }
  try {
    const rendered = emailComposerMarked.parse(markdown, {async: false}) as string;
    return styleMarkdownElements(constrainInlineImages(rendered));
  } catch {
    const escaped = markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre>${escaped}</pre>`;
  }
}

function styleMarkdownElements(html: string): string {
  return [
    {tag: "table", style: "border-collapse:collapse;margin:8px 0;width:100%;max-width:100%;"},
    {tag: "th", style: "border:1px solid #ced4da;padding:6px 8px;vertical-align:top;overflow-wrap:break-word;background-color:#f8f9fa;font-weight:bold;text-align:left;"},
    {tag: "td", style: "border:1px solid #ced4da;padding:6px 8px;vertical-align:top;overflow-wrap:break-word;"},
    {tag: "blockquote", style: "border-left:4px solid #9bc8ab;margin:16px 0;padding:12px 20px;background-color:#f7fbf8;color:#343a40;font-style:italic;"}
  ].reduce((styledHtml, element) => addInlineStyle(styledHtml, element.tag, element.style), html);
}

function addInlineStyle(html: string, tag: string, style: string): string {
  const openingTag = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
  return html.replace(openingTag, match => {
    if (/style\s*=/i.test(match)) {
      return match.replace(/style\s*=\s*"([^"]*)"/i, (_styleMatch, existing) => {
        const current = (existing as string).trim();
        const separator = current.endsWith(";") || current === "" ? "" : ";";
        return `style="${current}${separator}${style}"`;
      });
    }
    return match.replace(/>$/, ` style="${style}">`);
  });
}

function constrainInlineImages(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    if (/style\s*=/.test(attrs)) {
      return match.replace(/style\s*=\s*"([^"]*)"/i, (_styleMatch, existing) => {
        const trimmed = (existing as string).trim();
        const separator = trimmed.endsWith(";") || trimmed === "" ? "" : ";";
        return `style="${trimmed}${separator}max-width:100%;height:auto;"`;
      });
    }
    return `<img${attrs} style="max-width:100%;height:auto;">`;
  });
}
