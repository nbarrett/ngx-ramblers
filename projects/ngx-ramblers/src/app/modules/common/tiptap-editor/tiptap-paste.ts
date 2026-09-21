import { isArray } from "es-toolkit/compat";

export function isInternalPaste(html: string): boolean {
  return !!html && html.includes("data-pm-slice");
}

export function isWordClipboardHtml(html: string): boolean {
  return /\bMso[A-Za-z]+\b|xmlns:(?:o|w|v)=|\bmso-[a-z-]+:/i.test(html || "");
}

export function shouldPastePlainTextAsMarkdown(
  internalPaste: boolean,
  plainText: string,
  looksLikeMarkdown: boolean
): boolean {
  return !internalPaste && !!plainText && looksLikeMarkdown;
}

export type PasteJsonNode = {
  type?: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
  content?: PasteJsonNode[];
  [key: string]: unknown;
};

export function stripIncompatibleTextMarks<T extends PasteJsonNode>(node: T): T {
  const marks = node.marks;
  const hasCode = isArray(marks) && marks.some(mark => mark.type === "code");
  const nextMarks = hasCode && marks && marks.length > 1
    ? marks.filter(mark => mark.type === "code")
    : marks;
  const content = isArray(node.content)
    ? node.content.map(child => stripIncompatibleTextMarks(child))
    : node.content;
  const next = {...node} as T;
  if (nextMarks !== marks) {
    if (nextMarks && nextMarks.length > 0) {
      next.marks = nextMarks;
    } else {
      delete next.marks;
    }
  }
  if (content !== node.content) {
    next.content = content;
  }
  return next;
}

const RICH_FORMATTING_SELECTOR = "a[href], strong, b, em, i, u, s, strike, del, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, img";

function bytesFromHex(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g) || [];
  const bytes = new Uint8Array(pairs.length);
  pairs.forEach((pair, index) => {
    bytes[index] = parseInt(pair, 16);
  });
  return bytes;
}

export function imagesFromRtf(rtf: string): { bytes: Uint8Array; type: string }[] {
  if (!rtf) {
    return [];
  } else {
    return Array.from(rtf.matchAll(/\\(pngblip|jpegblip)/gi)).map(marker => {
      const start = (marker.index || 0) + marker[0].length;
      const nextPicture = rtf.indexOf("\\pict", start);
      const body = rtf.slice(start, nextPicture === -1 ? undefined : nextPicture);
      const jpeg = marker[1].toLowerCase() === "jpegblip";
      const signature = jpeg ? /ffd8ff/i : /89504e47/i;
      const imageAt = body.search(signature);
      const imageHex = imageAt >= 0 ? (body.slice(imageAt).match(/^[0-9a-fA-F\s]+/)?.[0] || "").replace(/\s/g, "") : "";
      return {bytes: bytesFromHex(imageHex), type: jpeg ? "image/jpeg" : "image/png"};
    }).filter(image => image.bytes.length > 24);
  }
}

export function dataImagesFromHtml(html: string): string[] {
  if (!html) {
    return [];
  } else {
    return Array.from(html.matchAll(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g))
      .map(match => match[0].replace(/\s+/g, ""));
  }
}

export function htmlReferencesLocalImages(html: string): boolean {
  let local = false;
  if (html) {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      local = Array.from(doc.body.querySelectorAll("img")).some(image => {
        const src = image.getAttribute("src") || "";
        return !/^https?:\/\//i.test(src) && !src.startsWith("data:image/");
      });
    } catch {
      local = false;
    }
  }
  return local;
}

export function htmlHasRichFormatting(html: string): boolean {
  let rich = false;
  if (html) {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      rich = !!doc.body.querySelector(RICH_FORMATTING_SELECTOR);
    } catch {
      rich = false;
    }
  }
  return rich;
}

export function sanitiseHtmlForPaste(html: string): string {
  let result = html;
  if (html) {
    try {
      const collapsed = html.replace(/&nbsp;/gi, " ").replace(/\u00A0/g, " ");
      const doc = new DOMParser().parseFromString(collapsed, "text/html");
      const widthAffectingAttrs = ["style", "width", "height", "bgcolor", "align", "valign", "cellpadding", "cellspacing", "border"];
      doc.querySelectorAll("*").forEach(el => {
        widthAffectingAttrs.forEach(attr => el.removeAttribute(attr));
        const cls = (el.getAttribute("class") ?? "")
          .split(/\s+/)
          .filter(c => c && !/^mso/i.test(c) && !/^Mso/.test(c))
          .join(" ");
        if (cls) {
          el.setAttribute("class", cls);
        } else {
          el.removeAttribute("class");
        }
      });
      doc.querySelectorAll("o\\:p, v\\:shape, v\\:imagedata, v\\:roundrect, v\\:line, v\\:rect, v\\:textbox, w\\:wordDocument").forEach(el => el.remove());
      doc.querySelectorAll("font").forEach(el => {
        const span = doc.createElement("span");
        Array.from(el.childNodes).forEach(child => span.appendChild(child));
        el.replaceWith(span);
      });
      result = doc.body.innerHTML;
    } catch {
      result = html;
    }
  }
  return result;
}

export function sanitiseMarkdownForPaste(text: string): string {
  let cleaned = text;
  if (cleaned.startsWith("---\n")) {
    const closingIdx = cleaned.indexOf("\n---", 4);
    if (closingIdx > 0) {
      const afterClosing = closingIdx + 4;
      const newlineAfter = cleaned.indexOf("\n", afterClosing);
      cleaned = cleaned.slice(newlineAfter > 0 ? newlineAfter + 1 : afterClosing);
    }
  }
  cleaned = cleaned.replace(/<\/?(?:Tabs|Tab|Note|Tip|Warning|Steps|Step|Frame|Card|CardGroup|Accordion|AccordionGroup|CodeGroup|Info|Check|Callout)\b[^>]*>/gi, "");
  cleaned = cleaned.replace(/^\s*```[a-zA-Z0-9]*\s+theme=\{null\}\s*$/gm, "```");
  return cleaned;
}
