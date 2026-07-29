export function isInternalPaste(html: string): boolean {
  return !!html && html.includes("data-pm-slice");
}

const RICH_FORMATTING_SELECTOR = "a[href], strong, b, em, i, u, s, strike, del, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, img";

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
      doc.querySelectorAll("table").forEach(table => {
        const fragment = doc.createDocumentFragment();
        table.querySelectorAll("td, th").forEach(cell => {
          Array.from(cell.childNodes).forEach(child => fragment.appendChild(child));
          fragment.appendChild(doc.createElement("br"));
        });
        table.replaceWith(fragment);
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
