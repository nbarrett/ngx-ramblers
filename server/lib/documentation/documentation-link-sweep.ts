import { isArray, isObject, isString, kebabCase, toPairs, values, escapeRegExp } from "es-toolkit/compat";
import { ADMIN_PATH_REDIRECTS, LegacyAdminPath, AdminContentPath, AdminMembersPath, AdminPath, AdminPlatformPath, AdminProfilePath, AdminSettingsPath } from "../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { PageContent, PageContentColumn } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { DOCUMENTATION_SITE_PLACEHOLDER, DocumentationLinkChange, DocumentationMenuLink, DocumentationSweepContext, LegacyDocumentationTab } from "../../../projects/ngx-ramblers/src/app/models/documentation-links.model";
import { MailSettingsTab, MAIL_SETTINGS_TAB_REDIRECTS } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { SystemSettingsTab, ExternalSystemsSubTab } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { ScheduledTaskSubTab } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import { StoredValue } from "../../../projects/ngx-ramblers/src/app/models/ui-actions";
import { DEFAULT_WALKS_AREA, WalksAdminSegment, walksAdminPath } from "../../../projects/ngx-ramblers/src/app/models/walks-route-paths.model";
import { apexHostFromUrl } from "../../../projects/ngx-ramblers/src/app/functions/hosts";
import { documentationHrefParts, documentationLinkPath } from "../../../projects/ngx-ramblers/src/app/functions/documentation-links";
import { isApplicationContentPath } from "../../../projects/ngx-ramblers/src/app/functions/application-content-paths";

const adminPaths = [...values(AdminPath), ...values(AdminContentPath), ...values(AdminMembersPath), ...values(AdminPlatformPath), ...values(AdminProfilePath), ...values(AdminSettingsPath)];
const proseFields = new Set(["contentText", "text", "introductoryText", "preAlbumText", "summary", "writtenDirections", "description"]);
const protectedMarkdown = /(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\2[^\n]*(?:\n|$)|$(?![\s\S]))|^ {4}(?![-*+]\s)[^\n]*(?:\n|$)|!?\[(?:\\.|[^\]\\])*\]\((?:\\.|[^)\\\n])*\)|<a\b[^>]*>[\s\S]*?<\/a>|<img\b[^>]*>|`+[^`\n]*`+|<[^>\n]+>)/gim;
const placeholderHost = /^(?:https?:\/\/)?(?:<your[- ]website[- ]address>|your[- ]website[- ]address|your-group(?:-site)?\.(?:org\.uk|example\.org\.uk)|example\.org\.uk)/i;

export function documentationMenuLinks(pages: PageContent[]): DocumentationMenuLink[] {
  const fromPaths = adminPaths.map(path => ({label: path.split("/").at(-1).replace(/-/g, " "), path: `/${path}`}));
  const fromPages = pages.flatMap(page => collectMenuLinks(page));
  const walkLinks = values(WalksAdminSegment).map(segment => ({label: segment.replace(/-/g, " "), path: `/${walksAdminPath(DEFAULT_WALKS_AREA, segment)}`}));
  return [...fromPaths, ...fromPages, ...walkLinks];
}

function collectMenuLinks(value: unknown): DocumentationMenuLink[] {
  if (isArray(value)) {
    return value.flatMap(collectMenuLinks);
  } else if (isObject(value)) {
    const column = value as Partial<PageContentColumn>;
    const own = column.title && column.href && adminPaths.includes(column.href as AdminPath)
      ? [{label: column.title, path: `/${column.href}`}]
      : [];
    return [...own, ...toPairs(value).flatMap(([, child]) => collectMenuLinks(child))];
  } else {
    return [];
  }
}

export function canonicalDocumentationPath(path: string, pageOrigin?: string): string {
  const parts = documentationHrefParts(path, pageOrigin);
  const parsed = new URL(`${parts?.pathname || "/"}${parts?.search || ""}${parts?.hash || ""}`, pageOrigin || parts?.origin || "https://localhost");
  const clean = parsed.pathname.replace(/^\//, "");
  const matching = adminPaths.filter(candidate => candidate.split("/").at(-1) === clean.slice("admin/".length));
  const canonical = ADMIN_PATH_REDIRECTS[clean as LegacyAdminPath] ? `/${ADMIN_PATH_REDIRECTS[clean as LegacyAdminPath]}` : clean.startsWith("admin/") && !adminPaths.includes(clean as AdminPath) && matching.length === 1 ? `/${matching[0]}` : parsed.pathname;
  const tab = parsed.searchParams.get(StoredValue.TAB);
  const destination = {path: canonical};
  if (canonical === `/${AdminSettingsPath.SYSTEM_SETTINGS}` && tab === LegacyDocumentationTab.GROUP_DETAILS) {
    parsed.searchParams.set(StoredValue.TAB, kebabCase(SystemSettingsTab.AREA_AND_GROUP));
  } else if (canonical === `/${AdminSettingsPath.SYSTEM_SETTINGS}` && tab === LegacyDocumentationTab.AREA_MAP_DATA) {
    parsed.searchParams.set(StoredValue.TAB, kebabCase(SystemSettingsTab.MAPS));
  } else if (canonical === `/${AdminPath.MAIL_SETTINGS}` && tab === LegacyDocumentationTab.CAMPAIGN_QUEUE) {
    destination.path = `/${AdminSettingsPath.SYSTEM_SETTINGS}`;
    parsed.searchParams.set(StoredValue.TAB, kebabCase(SystemSettingsTab.SCHEDULED_TASKS));
    parsed.searchParams.set(StoredValue.TASK_SUB_TAB, ScheduledTaskSubTab.BREVO);
  } else if (canonical === `/${AdminPath.MAIL_SETTINGS}` && MAIL_SETTINGS_TAB_REDIRECTS[tab]) {
    parsed.searchParams.set(StoredValue.TAB, MAIL_SETTINGS_TAB_REDIRECTS[tab]);
  }
  return destination.path + parsed.search + parsed.hash;
}

export function documentationFeaturePath(value: string, context: DocumentationSweepContext): string | null {
  const placeholderPath = documentationLinkPath(value);
  const placeholder = placeholderHost.exec(value);
  const candidate = placeholderPath || (placeholder ? value.slice(placeholder[0].length) : value);
  try {
    const parts = documentationHrefParts(candidate, context.url);
    const knownOrigin = parts?.origin && context.origins.some(origin => apexHostFromUrl(origin) === apexHostFromUrl(parts.origin));
    const local = !/^https?:/i.test(candidate);
    const combined = parts ? `${parts.pathname}${parts.search}${parts.hash}` : null;
    const canonical = combined ? canonicalDocumentationPath(combined, context.url) : null;
    return parts && canonical && (local || knownOrigin || placeholder) && isApplicationContentPath(canonical.split(/[?#]/)[0]) && !/\.(?:ts|js|md|json|csv|pdf|png|jpe?g|svg)$/i.test(parts.pathname)
      ? canonical
      : null;
  } catch {
    return null;
  }
}

export function documentationMarkdownLink(label: string, path: string, title: string | null = null): string {
  const markedTitle = title?.startsWith(DOCUMENTATION_SITE_PLACEHOLDER) ? title : title ? `${DOCUMENTATION_SITE_PLACEHOLDER} ${title}` : DOCUMENTATION_SITE_PLACEHOLDER;
  return `[${label}](${path} "${markedTitle}")`;
}

function menuPath(label: string, context: DocumentationSweepContext): string | null {
  const parts = label.replace(/\*\*/g, "").split(/\s*(?:→|>|»)\s*/).map(part => part.trim());
  const matches = context.menuLinks.filter(link => kebabCase(link.label) === kebabCase(parts.at(-1)));
  const paths = [...new Set(matches.map(link => link.path))];
  const trusted = /^(admin|walks(?: admin)?|system settings|mail settings|profile|settings|members|content)$/i.test(parts[0])
    || context.menuLinks.some(link => kebabCase(link.label) === kebabCase(parts[0]));
  const admin = parts.some(part => kebabCase(part) === "admin");
  const walks = parts.some(part => kebabCase(part) === "walks");
  const preferred = paths.filter(path => walks ? path.startsWith("/walks/") : admin ? path.startsWith("/admin/") : true);
  const systemTab = values(SystemSettingsTab).find(tab => kebabCase(tab) === kebabCase(parts.at(-1)));
  const mailTab = values(MailSettingsTab).find(tab => kebabCase(tab) === kebabCase(parts.at(-1)));
  if (!trusted) {
    return null;
  } else if (parts.some(part => kebabCase(part) === "system-settings") && systemTab) {
    return `/${AdminSettingsPath.SYSTEM_SETTINGS}?${StoredValue.TAB}=${kebabCase(systemTab)}`;
  } else if (parts.some(part => kebabCase(part) === "mail-settings") && mailTab) {
    return `/${AdminPath.MAIL_SETTINGS}?${StoredValue.TAB}=${kebabCase(mailTab)}`;
  } else if (parts.some(part => kebabCase(part) === "external-systems") && values(ExternalSystemsSubTab).includes(kebabCase(parts.at(-1)) as ExternalSystemsSubTab)) {
    return `/${AdminSettingsPath.SYSTEM_SETTINGS}?${StoredValue.TAB}=${kebabCase(SystemSettingsTab.EXTERNAL_SYSTEMS)}&${StoredValue.SUB_TAB}=${kebabCase(parts.at(-1))}`;
  } else {
    if (preferred.some(path => path.startsWith("/admin/platform"))) {
      return null;
    } else if (preferred.length === 1) {
      return preferred[0];
    } else {
      return parts.length > 1 ? menuPath(parts.slice(0, -1).join(" → "), context) : null;
    }
  }
}

function rewriteProse(text: string, context: DocumentationSweepContext): string {
  const linked = text.replace(/(?<![\w/])(?:https?:\/\/[^\s<>`"\[\]()]+|(?:walks|admin)\/[^\s<>`"\[\]()]+|(?:<your[- ]website[- ]address>|your[- ]website[- ]address|your-group(?:-site)?\.(?:org\.uk|example\.org\.uk)|example\.org\.uk)?\/(?:admin|walks|social-events|app|committee|contact-us|area-map)(?:[/?#][^\s<>`"\[\]()]*)?)/gi, raw => {
    const suffix = /[.,;:]+$/.exec(raw)?.[0] || "";
    const value = suffix ? raw.slice(0, -suffix.length) : raw;
    const path = documentationFeaturePath(value, context);
    return path ? documentationMarkdownLink(path, path) + suffix : raw;
  });
  const emphasised = linked.replace(/\*\*([^*\n]*(?:→|»| > )[^*\n]*)\*\*/g, (original, label) => {
    const path = menuPath(label, context);
    return path ? documentationMarkdownLink(`**${label}**`, path) : original;
  });
  const labels = [...new Set([...context.menuLinks.map(link => link.label), ...values(SystemSettingsTab), ...values(MailSettingsTab)])].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  const menu = new RegExp(`\\b(?:Admin|Walks|System Settings|Mail Settings|Profile|Settings|Members|Content)(?:\\s*(?:→|>|»)\\s*(?:${labels}))+(?![\\w-])`, "gi");
  const cursor = {offset: 0};
  const pieces: string[] = [];
  for (const match of emphasised.matchAll(/!?\[[^\]]*\]\([^\n]*?\)/g)) {
    pieces.push(rewriteMenuText(emphasised.slice(cursor.offset, match.index), menu, context), match[0]);
    cursor.offset = match.index + match[0].length;
  }
  pieces.push(rewriteMenuText(emphasised.slice(cursor.offset), menu, context));
  return pieces.join("");
}

function rewriteMenuText(text: string, menu: RegExp, context: DocumentationSweepContext): string {
  return text.replace(menu, label => {
    const path = menuPath(label, context);
    return path ? documentationMarkdownLink(label, path) : label;
  });
}

export function rewriteDocumentationMarkdown(text: string, context: DocumentationSweepContext): string {
  const pieces: string[] = [];
  const cursor = {offset: 0};
  for (const match of text.matchAll(protectedMarkdown)) {
    pieces.push(rewriteProse(text.slice(cursor.offset, match.index), context));
    const raw = match[0];
    const link = /^\[([\s\S]*)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)$/.exec(raw);
    const code = /^`([^`]+)`$/.exec(raw);
    if (link) {
      const path = documentationFeaturePath(link[2], context);
      const hasPlaceholder = /<your[- ]website[- ]address>/i.test(link[1]);
      const label = hasPlaceholder ? link[1].replace(/<your[- ]website[- ]address>/gi, "your website").replace(/`/g, "") : link[1];
      pieces.push(path ? documentationMarkdownLink(label, path, link[3]) : raw);
    } else if (/^<a\b/i.test(raw)) {
      const href = /href\s*=\s*(["'])(.*?)\1/i.exec(raw);
      const path = href ? documentationFeaturePath(href[2].replace(/&amp;/g, "&"), context) : null;
      if (path) {
        const linked = raw.replace(href[0], `href="${path.replace(/&/g, "&amp;")}"`);
        const title = /\btitle\s*=\s*(["'])(.*?)\1/i.exec(linked);
        const markedTitle = title?.[2]?.startsWith(DOCUMENTATION_SITE_PLACEHOLDER) ? title[2] : title ? `${DOCUMENTATION_SITE_PLACEHOLDER} ${title[2]}` : DOCUMENTATION_SITE_PLACEHOLDER;
        pieces.push(title ? linked.replace(title[0], `title="${markedTitle}"`) : linked.replace(/^<a\b/i, `<a title="${markedTitle}"`));
      } else {
        pieces.push(raw);
      }
    } else if (code) {
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      const lineEnd = text.indexOf("\n", match.index);
      const line = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
      const technical = /https?:\/\//i.test(code[1]) || /oauth|redirect uri|origin \+|endpoint|callback|request|response|\b(?:GET|POST|PUT|DELETE)\b/i.test(line);
      const path = technical ? null : documentationFeaturePath(code[1], context);
      pieces.push(path ? documentationMarkdownLink(path, path) : raw);
    } else {
      pieces.push(raw);
    }
    cursor.offset = match.index + raw.length;
  }
  pieces.push(rewriteProse(text.slice(cursor.offset), context));
  return pieces.join("");
}

export function sweepDocumentationPage(page: PageContent, context: DocumentationSweepContext, changes: DocumentationLinkChange[]): PageContent {
  const visit = (value: unknown, field: string): unknown => {
    if (isArray(value)) {
      return value.map((item, index) => visit(item, `${field}[${index}]`));
    } else if (isObject(value)) {
      return toPairs(value).reduce((result, [key, child]) => ({...result, [key]: visit(child, field ? `${field}.${key}` : key)}), {});
    } else if (isString(value) && proseFields.has(field.split(".").at(-1))) {
      const rewritten = rewriteDocumentationMarkdown(value, context);
      const after = rewritten === value ? value : rewritten.trim();
      if (value !== after) {
        changes.push({field, before: value, after});
      }
      return after;
    } else {
      return value;
    }
  };
  return visit(page, "") as PageContent;
}
