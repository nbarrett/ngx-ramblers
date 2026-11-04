import { Marked } from "marked";
import { escapeHtml } from "./strings";
import { resourceAwsImageUrls } from "./aws-image-paths";
import {EmailImageLayout, EVENT_EMAIL_IMAGE_HEIGHT, eventEmailImageStyle} from "../models/email-composer.model";

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

export function renderEmailComposerMarkdown(markdown: string, imageLayout = EmailImageLayout.NATURAL, imageHeight = EVENT_EMAIL_IMAGE_HEIGHT): string {
  if (!markdown) {
    return "";
  }
  try {
    const rendered = emailComposerMarked.parse(markdown, {async: false}) as string;
    return formatEmailComposerHtml(rendered, imageLayout, imageHeight);
  } catch {
    return `<pre>${escapeHtml(markdown)}</pre>`;
  }
}

export function formatEmailComposerHtml(html: string, imageLayout = EmailImageLayout.NATURAL, imageHeight = EVENT_EMAIL_IMAGE_HEIGHT): string {
  return resourceAwsImageUrls(styleMarkdownElements(constrainQuotedImages(constrainInlineImages(html, imageLayout, imageHeight))));
}

function styleMarkdownElements(html: string): string {
  const withWhitespace = html.replace(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi, paragraph =>
    / {2,}|\t|&#(?:32|9);/.test(paragraph) ? addInlineStyle(paragraph, "p", "white-space:pre-wrap;") : paragraph);
  const withQuotes = addInlineStyle(withWhitespace, "blockquote", "border-left:4px solid #9bc8ab;margin:16px 0;padding:12px 20px;background-color:#f7fbf8;color:#343a40;font-style:italic;");
  return withQuotes.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, table => styleContentTable(table));
}

function styleContentTable(table: string): string {
  if (/role\s*=\s*"presentation"/i.test(table)) {
    return table;
  } else {
    const header = table.match(/<tr[\s\S]*?<\/tr>/i);
    const columns = header ? (header[0].match(/<t[hd]\b/gi) || []).length : 0;
    const widths = columnShare(columns);
    const progress = {column: 0};
    const withTableWidth = /\swidth\s*=/i.test(table) ? table : table.replace(/<table\b/i, "<table width=\"100%\"");
    const withTableStyle = addInlineStyle(withTableWidth, "table",
      "border-collapse:collapse;margin:8px 0;width:100%;max-width:100%;table-layout:fixed;");
    return withTableStyle.replace(/<\/tr>|<t([hd])(\s[^>]*)?>/gi, (match, kind, attrs) => {
      if (match === "</tr>") {
        progress.column = 0;
        return match;
      } else {
        const width = widths[progress.column] || "";
        progress.column += 1;
        const opening = width && !/\swidth\s*=/i.test(match) ? `<t${kind}${attrs || ""} width="${width}">` : match;
        const heading = kind === "h" ? "background-color:#f8f9fa;font-weight:bold;text-align:left;" : "";
        return addInlineStyle(opening, `t${kind}`,
          `border:1px solid #ced4da;padding:6px 8px;vertical-align:top;overflow-wrap:break-word;word-break:normal;${heading}${width ? `width:${width};` : ""}`);
      }
    });
  }
}

function columnShare(columns: number): string[] {
  if (columns === 3) {
    return ["30%", "28%", "42%"];
  } else if (columns > 0) {
    const share = `${Math.floor(100 / columns)}%`;
    return Array.from({length: columns}, () => share);
  } else {
    return [];
  }
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

function constrainInlineImages(html: string, imageLayout: EmailImageLayout, imageHeight: number): string {
  return constrainImages(html, imageLayout === EmailImageLayout.EVENT ? eventEmailImageStyle(imageHeight) : "max-width:100%;height:auto;", imageLayout, imageHeight);
}

function constrainImages(html: string, style: string, imageLayout = EmailImageLayout.NATURAL, imageHeight = EVENT_EMAIL_IMAGE_HEIGHT): string {
  return html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    const styled = /style\s*=/i.test(attrs)
      ? match.replace(/style\s*=\s*"([^"]*)"/i, (_styleMatch, existing) => styleAttribute(existing as string, `${style};background-color:#ffffff`))
      : `<img${attrs} style="${style};background-color:#ffffff">`;
    return wrapEmailImageOnWhite(styled, imageLayout, imageHeight);
  });
}

export function wrapEmailImageOnWhite(imgTag: string, imageLayout = EmailImageLayout.NATURAL, imageHeight = EVENT_EMAIL_IMAGE_HEIGHT): string {
  const sizing = imageLayout === EmailImageLayout.EVENT ? ` height="${imageHeight}" valign="middle"` : "";
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background-color:#ffffff;"><tr><td bgcolor="#ffffff" align="center"${sizing} style="background-color:#ffffff;">${imgTag}</td></tr></table>`;
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
