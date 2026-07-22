import { PageContentColumn, PageContentRow } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { S3_BASE_URL } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { htmlToPlainText, lastItemFrom, titleCase } from "../shared/string-utils";
import { renderMarkdownToHtml } from "../shared/markdown-renderer";

const DESCRIPTION_MAX_LENGTH = 160;

function publicColumn(column: PageContentColumn): boolean {
  return (column.accessLevel || AccessLevel.PUBLIC) === AccessLevel.PUBLIC;
}

function imageMarkdownFrom(column: PageContentColumn): string {
  if (!column.imageSource || column.imageSource.startsWith("data:")) {
    return "";
  }
  const url = column.imageSource.startsWith("http") || column.imageSource.includes(S3_BASE_URL)
    ? column.imageSource
    : `/${S3_BASE_URL}/${column.imageSource.replace(/^\/+/, "")}`;
  return `![${column.alt || ""}](${url.startsWith("http") ? url : `/${url.replace(/^\/+/, "")}`})`;
}

function markdownFromColumn(column: PageContentColumn): string {
  const heading = column.title ? `## ${column.title}` : "";
  const image = imageMarkdownFrom(column);
  const text = column.contentText || "";
  const orderedSections = column.showTextAfterImage ? [heading, image, text] : [heading, text, image];
  const nested = column.rows ? publicMarkdownFromRows(column.rows) : "";
  return [...orderedSections, nested].filter(section => section.trim().length > 0).join("\n\n");
}

export function publicMarkdownFromRows(rows: PageContentRow[]): string {
  return (rows || [])
    .flatMap(row => (row.columns || []).filter(publicColumn).map(markdownFromColumn))
    .filter(section => section.trim().length > 0)
    .join("\n\n");
}

export function publicHtmlFromRows(rows: PageContentRow[]): string {
  return renderMarkdownToHtml(publicMarkdownFromRows(rows));
}

export function descriptionFromMarkdown(markdown: string): string {
  const plainText = htmlToPlainText(renderMarkdownToHtml(markdown)).replace(/\s+/g, " ").trim();
  if (plainText.length <= DESCRIPTION_MAX_LENGTH) {
    return plainText;
  } else {
    const truncated = plainText.slice(0, DESCRIPTION_MAX_LENGTH);
    const lastSpace = truncated.lastIndexOf(" ");
    return `${truncated.slice(0, lastSpace > 0 ? lastSpace : DESCRIPTION_MAX_LENGTH)}…`;
  }
}

export function titleFromPath(path: string): string {
  return titleCase((lastItemFrom(path) || path || "").replace(/-/g, " "));
}

export function normalisePath(rawPath: string): string {
  return decodeURIComponent(rawPath || "").replace(/^\/+|\/+$/g, "").trim();
}

export function absolutiseMarkdownLinks(markdown: string, baseUrl: string): string {
  if (!baseUrl || !markdown) {
    return markdown;
  }
  return markdown.replace(/\]\((?!https?:\/\/|mailto:|tel:|#|data:)([^)\s]+)/g, (match, target) => `](${baseUrl}/${target.replace(/^\/+/, "")}`);
}
