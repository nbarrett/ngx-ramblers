import { isArray, isObject, isString, toPairs } from "es-toolkit/compat";
import { lastItemFrom, titleCase } from "../../shared/string-utils";
import { BuiltInPath, PageContent } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { ContentMetadata } from "../../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import {
  PageEntry,
  SearchableSegment,
  SegmentSources
} from "../../../../projects/ngx-ramblers/src/app/models/site-search.model";

const FRAGMENT_REFERENCE_FIELD = "pageContentId";
const PROSE_FIELDS = ["contentText", "title", "subtitle", "summary", "description", "text", "label", "alt", "note", "instruction", "wayName", "writtenDirections", "introductoryText", "preAlbumText", "indexMarkdown", "pageTitle"];

function titleFromPath(path: string): string {
  return titleCase((lastItemFrom(path) || path || "").replace(/-/g, " "));
}

function breadcrumbFromPath(path: string): string {
  const segments = (path || "").split("/").filter(segment => segment.length > 0);
  return segments.slice(0, -1).map(segment => titleCase(segment.replace(/-/g, " "))).join(" / ");
}

function albumCaptionsFrom(albums: ContentMetadata[]): Map<string, string> {
  return new Map(albums
    .filter(album => !!album.name)
    .map(album => [album.name, (album.files || [])
      .filter(file => !file.draft)
      .map(file => file.text)
      .filter(text => !!text?.trim())
      .join(" ")]));
}

export function pageIdOf(page: PageContent): string {
  return (page as any)._id?.toString() || page.id;
}

function fragmentIdsIn(value: unknown): string[] {
  if (isArray(value)) {
    return value.flatMap(item => fragmentIdsIn(item));
  } else if (isObject(value)) {
    return toPairs(value).flatMap(([key, child]) => key === FRAGMENT_REFERENCE_FIELD && isString(child) ? [child] : fragmentIdsIn(child));
  } else {
    return [];
  }
}

function segmentsFrom(node: unknown, level: AccessLevel, sources: SegmentSources, visitedFragments: string[]): SearchableSegment[] {
  const texts: string[] = [];
  const nested: SearchableSegment[] = [];
  gatherText(node, level, sources, visitedFragments, texts, nested, true);
  const ownText = texts.join(" ");
  return ownText.trim().length > 0 ? [{text: ownText, level}, ...nested] : nested;
}

function gatherText(value: unknown, level: AccessLevel, sources: SegmentSources, visitedFragments: string[], texts: string[], nested: SearchableSegment[], boundary: boolean): void {
  if (isArray(value)) {
    value.forEach(item => gatherText(item, level, sources, visitedFragments, texts, nested, false));
  } else if (isObject(value)) {
    const record = value as Record<string, unknown>;
    const ownLevel = record.accessLevel as AccessLevel;
    if (ownLevel && !boundary) {
      nested.push(...segmentsFrom(record, ownLevel, sources, visitedFragments));
    } else {
      toPairs(record).forEach(([key, child]) => {
        if (isString(child)) {
          if (PROSE_FIELDS.includes(key) && child.trim().length > 0) {
            texts.push(child);
          }
          if (sources.albumCaptions.get(child)) {
            texts.push(sources.albumCaptions.get(child));
          }
          const fragment = key === FRAGMENT_REFERENCE_FIELD && !visitedFragments.includes(child) ? sources.pagesById.get(child) : null;
          if (fragment) {
            nested.push(...segmentsFrom(fragment.rows, level, sources, visitedFragments.concat(child)));
          }
        } else {
          gatherText(child, level, sources, visitedFragments, texts, nested, false);
        }
      });
    }
  }
}

function firstSegmentOf(path: string): string {
  return (path || "").split("/").filter(segment => segment.length > 0)[0] || "";
}

function pathIncluded(page: PageContent, fragmentIds: Set<string>): boolean {
  return !!page.path
    && !page.path.includes("#")
    && firstSegmentOf(page.path) !== BuiltInPath.ADMIN
    && !page.migrationTemplate?.isTemplate
    && !page.migrationTemplate?.templateType
    && !fragmentIds.has(pageIdOf(page));
}

export function pageEntriesFrom(pages: PageContent[], albums: ContentMetadata[]): PageEntry[] {
  const sources: SegmentSources = {
    albumCaptions: albumCaptionsFrom(albums),
    pagesById: new Map(pages.map(page => [pageIdOf(page), page]))
  };
  const fragmentIds = new Set(fragmentIdsIn(pages.map(page => page.rows)));
  return pages
    .filter(page => pathIncluded(page, fragmentIds))
    .map(page => ({
      path: page.path,
      title: titleFromPath(page.path),
      breadcrumb: breadcrumbFromPath(page.path),
      segments: segmentsFrom(page.rows, AccessLevel.PUBLIC, sources, [pageIdOf(page)])
    }));
}
