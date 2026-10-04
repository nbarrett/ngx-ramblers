import { DOCUMENTATION_SITE_PLACEHOLDER } from "../models/documentation-links.model";
import { isApplicationContentPath, isDocumentationContentPath } from "./application-content-paths";

export function documentationSiteOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

export function documentationLinkPath(value: string): string | null {
  const decodedPlaceholder = value?.replace(/%7B/gi, "{").replace(/%7D/gi, "}");
  const path = decodedPlaceholder?.startsWith(DOCUMENTATION_SITE_PLACEHOLDER)
    ? decodedPlaceholder.slice(DOCUMENTATION_SITE_PLACEHOLDER.length)
    : null;
  return path && /^\/(?!\/)/.test(path) && !/[\\\s]/.test(path) && !path.split("").some(character => character.charCodeAt(0) < 32) ? path : null;
}

export function documentationLinkUrl(value: string, siteUrl: string): string | null {
  const path = documentationLinkPath(value);
  const origin = documentationSiteOrigin(siteUrl);
  return path && origin ? `${origin}${path}` : null;
}

export function documentationHrefParts(value: string, pageOrigin?: string): {pathname: string, search: string, hash: string, origin: string | null} | null {
  const result = {parts: null as {pathname: string, search: string, hash: string, origin: string | null} | null};
  if (value) {
    try {
      if (/^https?:/i.test(value)) {
        const url = new URL(value);
        result.parts = {pathname: url.pathname, search: url.search, hash: url.hash, origin: url.origin};
      } else if (pageOrigin) {
        const href = value.startsWith("/") ? value : `/${value}`;
        const url = new URL(href, pageOrigin);
        result.parts = {pathname: url.pathname, search: url.search, hash: url.hash, origin: url.origin};
      } else {
        const href = value.startsWith("/") ? value : `/${value}`;
        const hashIndex = href.indexOf("#");
        const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
        const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
        const queryIndex = withoutHash.indexOf("?");
        result.parts = {
          pathname: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
          search: queryIndex >= 0 ? withoutHash.slice(queryIndex) : "",
          hash,
          origin: null
        };
      }
    } catch {
      result.parts = null;
    }
  }
  return result.parts;
}

export function documentationFeaturePath(value: string, origins: string[] = [], pageOrigin?: string): string | null {
  const placeholder = documentationLinkPath(value);
  const result = {path: placeholder && isApplicationContentPath(placeholder) ? placeholder : null};
  if (!result.path && value) {
    const parts = documentationHrefParts(value, pageOrigin);
    if (parts) {
      const known = origins.some(site => documentationSiteOrigin(site) === documentationSiteOrigin(parts.origin || ""));
      const local = !/^https?:/i.test(value) || (pageOrigin && parts.origin === documentationHrefParts(pageOrigin)?.origin) || known;
      if (local && isApplicationContentPath(parts.pathname) && !isDocumentationContentPath(parts.pathname)) {
        result.path = `${parts.pathname}${parts.search}${parts.hash}`;
      }
    }
  }
  return result.path;
}

export function documentationFeatureUrl(value: string, siteUrl: string, origins: string[] = [], pageOrigin?: string): string | null {
  const path = documentationFeaturePath(value, origins, pageOrigin);
  const origin = documentationSiteOrigin(siteUrl);
  return path && origin ? `${origin}${path}` : null;
}

export function documentationLinkTitle(label: string): string {
  return `Opens on ${label}. Click the gear above to change this.`;
}
