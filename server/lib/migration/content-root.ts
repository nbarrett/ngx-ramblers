import { JSDOM } from "jsdom";

export function selectorList(selector: string): string[] {
  return (selector || "").split(",").map(item => item.trim()).filter(Boolean);
}

export function firstMatchingElement(root: ParentNode, selector: string): Element | null {
  return selectorList(selector).reduce((found, item) => {
    if (found) {
      return found;
    } else {
      try {
        return root.querySelector(item);
      } catch (error) {
        return found;
      }
    }
  }, null as Element | null);
}

export function removeMatchingElements(root: ParentNode, selectors: string[]): void {
  selectors.forEach(selector => {
    try {
      [...root.querySelectorAll(selector)].forEach(node => node.remove());
    } catch (error) {
      return;
    }
  });
}

const SITE_NAV_LABEL = /^(home|walks(\s+programme)?|social(\s+events)?|gallery|photos|contacts?|about(\s+us)?|walk leaders|wellbeing walks|information|programme)$/i;
const SITE_NAV_HREF = /(?:index|walks|social|gallery|contact|about|leaders|photos|eventdisplay|healthwalks)(?:\.php)?(?:[/?#]|$)/i;

function listItemLabel(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function chromeNavigationItem(text: string, href = ""): boolean {
  const label = listItemLabel(text);
  return SITE_NAV_LABEL.test(label) || SITE_NAV_HREF.test(href);
}

function navigationList(list: Element): boolean {
  const items = [...list.children].filter(child => child.tagName === "LI");
  if (items.length < 4) {
    return false;
  } else {
    const shortLinks = items.filter(item => {
      const links = [...item.querySelectorAll(":scope > a")];
      const text = listItemLabel(item.textContent || "");
      return links.length === 1 && text.length > 0 && text.length < 40 && !item.querySelector("p, img");
    });
    const chromeItems = shortLinks.filter(item => chromeNavigationItem(item.textContent || "", item.querySelector("a")?.getAttribute("href") || ""));
    return shortLinks.length === items.length && chromeItems.length >= 3;
  }
}

function replaceFormControlsWithReadableMarkup(node: Element): void {
  const document = node.ownerDocument;
  [...node.querySelectorAll("select")].forEach(select => {
    const values = [...select.querySelectorAll("option")].map(option => (option.textContent || "").trim()).filter(Boolean);
    const list = document.createElement("ul");
    values.forEach(value => {
      const item = document.createElement("li");
      item.textContent = value;
      list.appendChild(item);
    });
    select.replaceWith(list);
  });
  [...node.querySelectorAll("input, button, textarea")].forEach(element => element.remove());
}

export function withoutNavigationLists(root: ParentNode): void {
  [...root.querySelectorAll("ul, ol")].filter(navigationList).forEach(list => list.remove());
}

export function contentHtmlFromDocument(document: Document, contentSelector: string, excludeSelectors: string[] = []): string {
  const source = firstMatchingElement(document, contentSelector) || document.body;
  const node = source.cloneNode(true) as Element;
  removeMatchingElements(node, excludeSelectors);
  withoutNavigationLists(node);
  replaceFormControlsWithReadableMarkup(node);
  return node.innerHTML;
}

export function contentHtmlFromPage(html: string, pageUrl: string, contentSelector: string, excludeSelectors: string[] = []): string {
  const document = new JSDOM(html || "", {url: pageUrl || "https://group.example.org.uk/"}).window.document;
  return contentHtmlFromDocument(document, contentSelector, excludeSelectors);
}

function markdownListItem(line: string): {label: string; href: string} | null {
  const match = line.match(/^\s*(?:[-*]|\d+\.)\s+(?:\[([^\]]{1,40})\]\(([^)]+)\)|([A-Za-z][A-Za-z0-9 &'/-]{0,38}))\s*$/);
  if (!match) {
    return null;
  } else {
    return {label: match[1] || match[3] || "", href: match[2] || ""};
  }
}

export function withoutLeadingNavigationMarkdown(markdown: string): string {
  const lines = (markdown || "").split("\n");
  const start = lines.findIndex(line => line.trim().length > 0);
  if (start < 0) {
    return markdown || "";
  } else {
    const navRun = lines.slice(start).reduce((count, line) => {
      const item = markdownListItem(line);
      if (count.done) {
        return count;
      } else if (!line.trim()) {
        return count.kept ? {...count, done: true} : count;
      } else if (item && chromeNavigationItem(item.label, item.href)) {
        return {kept: count.kept + 1, done: false};
      } else {
        return {...count, done: true};
      }
    }, {kept: 0, done: false});
    if (navRun.kept < 4) {
      return markdown || "";
    } else {
      return lines.slice(start + navRun.kept).join("\n").replace(/^\s+/, "");
    }
  }
}
