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
    return styleMarkdownElements(constrainQuotedImages(constrainInlineImages(rendered)));
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

const QUOTED_IMAGE_STYLE = "max-width:300px;height:auto;";

function constrainQuotedImages(html: string): string {
  return html.split(/(<blockquote\b[^>]*>|<\/blockquote>)/gi)
    .reduce<{ depth: number; html: string }>((accumulator, segment) => {
      const opening = /^<blockquote\b/i.test(segment);
      const closing = /^<\/blockquote>/i.test(segment);
      const quoted = accumulator.depth > 0 && !opening && !closing;
      return {
        depth: Math.max(0, accumulator.depth + (opening ? 1 : 0) - (closing ? 1 : 0)),
        html: accumulator.html + (quoted ? constrainImages(segment, QUOTED_IMAGE_STYLE) : segment)
      };
    }, {depth: 0, html: ""}).html;
}

function constrainInlineImages(html: string): string {
  return constrainImages(html, "max-width:100%;height:auto;");
}

function constrainImages(html: string, style: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (match, attrs) => /style\s*=/i.test(attrs)
    ? match.replace(/style\s*=\s*"([^"]*)"/i, (_styleMatch, existing) => styleAttribute(existing as string, style))
    : `<img${attrs} style="${style}">`);
}

function styleAttribute(existing: string, style: string): string {
  const applied = declarations(style);
  const properties = applied.map(propertyOf);
  const retained = declarations(existing).filter(declaration => !properties.includes(propertyOf(declaration)));
  return `style="${[...retained, ...applied].join(";")};"`;
}

function declarations(style: string): string[] {
  return style.split(";").map(declaration => declaration.trim()).filter(declaration => declaration.length > 0);
}

function propertyOf(declaration: string): string {
  return declaration.split(":")[0].trim().toLowerCase();
}
