import { headingAnchorId } from "./heading-slug";

const HEADING_SELECTOR = ".content-page-title, app-dynamic-content-view h1, app-dynamic-content-view h2, app-dynamic-content-view h3, app-dynamic-content-view h4, app-dynamic-content-view h5, app-dynamic-content-view h6";
const LINK_REGION_SELECTOR = ".page-heading, app-dynamic-content-view";

export function applyHeadingAnchors(root: ParentNode, path: string): void {
  const seen = new Map<string, number>();
  root.querySelectorAll<HTMLElement>(HEADING_SELECTOR).forEach(heading => {
    const id = headingAnchorId(headingText(heading), seen);
    if (heading.id !== id) {
      heading.id = id;
    }
    const controls = ensureControls(heading);
    const permalink = controls.querySelector<HTMLAnchorElement>("a.heading-permalink");
    const href = `${path}#${id}`;
    if (permalink && permalink.getAttribute("href") !== href) {
      permalink.setAttribute("href", href);
    }
    if (permalink) {
      permalink.dataset.headingUrl = href;
    }
    const copy = controls.querySelector<HTMLButtonElement>("button.heading-copy");
    if (copy) {
      copy.dataset.headingUrl = href;
    }
  });
  root.querySelectorAll<HTMLAnchorElement>(`${LINK_REGION_SELECTOR} a[href]`).forEach(anchor => {
    if (!anchor.classList.contains("heading-permalink")) {
      const raw = anchor.getAttribute("href") || "";
      const stored = anchor.dataset.headingInPageHash;
      const hash = stored || (raw.startsWith("#") && raw.length > 1 ? raw : "");
      if (hash) {
        anchor.dataset.headingInPageHash = hash;
        const href = `${path}${hash}`;
        if (anchor.getAttribute("href") !== href) {
          anchor.setAttribute("href", href);
        }
      }
    }
  });
}

export function headingAnchorUrl(anchor: HTMLElement, origin: string): string {
  const href = anchor.dataset.headingUrl || "";
  if (href.startsWith("/")) {
    return `${origin}${href}`;
  } else {
    return href;
  }
}

function headingText(heading: HTMLElement): string {
  const copy = heading.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(".heading-anchor-controls").forEach(node => node.remove());
  return copy.textContent || "";
}

function ensureControls(heading: HTMLElement): HTMLElement {
  const existing = heading.querySelector<HTMLElement>(":scope > .heading-anchor-controls");
  if (existing?.querySelector("a.heading-permalink svg") && existing.querySelector("button.heading-copy")) {
    if (heading.lastElementChild !== existing) {
      heading.appendChild(existing);
    }
    return existing;
  } else {
    existing?.remove();
    const controls = heading.ownerDocument.createElement("span");
    controls.className = "heading-anchor-controls";
    controls.innerHTML = `<a class="heading-permalink" href="#" aria-label="Link to this heading">${linkIcon()}</a><button type="button" class="heading-copy" aria-label="Copy link to this heading">${copyIcon()}</button>`;
    heading.appendChild(controls);
    return controls;
  }
}

export function showHeadingCopyIcon(button: HTMLButtonElement, copied: boolean): void {
  button.innerHTML = copied ? tickIcon() : copyIcon();
}

function tickIcon(): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>`;
}

function copyIcon(): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path fill="currentColor" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;
}

function linkIcon(): string {
  return `<svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path></svg>`;
}
