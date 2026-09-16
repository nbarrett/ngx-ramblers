import {
  ALBUM_INDEX_MAP_CONFIG_DEFAULTS,
  AlbumIndexSortField,
  IndexContentType,
  IndexRenderMode,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType,
  StringMatch
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { SortDirection } from "../../../projects/ngx-ramblers/src/app/models/sort.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { GalleryDate, MigratedAlbum } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import {
  RegistrationAlbumWalkLink,
  RegistrationKeyArea,
  RegistrationNavbarPath,
  RegistrationPage,
  RegistrationWalkCandidate
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { galleryDateFrom, MONTH_NAME_PATTERN } from "../../../projects/ngx-ramblers/src/app/functions/gallery-date";
import { albumPhotoPaths } from "./registration-content";
import { dateTimeFromIso, dateTimeFromMillis, dateTimeFromObject } from "../shared/dates";

const IGNORED_WORDS = new Set(["and", "the", "of", "a", "an", "to", "from", "at", "in", "on", "via", "with", "walk", "walks", "circular", "short", "long", "photos", "photo", "gallery", "stage", "part", "group", "ramblers", "day"]);
const MIGRATION_NOTE = /Migrated from/i;
const SHORT_DESCRIPTION_LENGTH = 90;

function significantWords(text: string): Set<string> {
  return new Set((text || "")
    .toLowerCase()
    .replace(MONTH_NAME_PATTERN, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !IGNORED_WORDS.has(word)));
}

function sameDay(walk: RegistrationWalkCandidate, date: GalleryDate): boolean {
  const [year, month, day] = walk.startDateTime.slice(0, 10).split("-").map(Number);
  return year === date.year && month === date.month && (date.day === null || day === date.day);
}

function sharedWordCount(title: string, walk: RegistrationWalkCandidate): number {
  const walkWords = significantWords(`${walk.title} ${walk.location}`);
  return [...significantWords(title)].filter(word => walkWords.has(word)).length;
}

export function matchingWalk(title: string, date: GalleryDate | null, walks: RegistrationWalkCandidate[]): {walk: RegistrationWalkCandidate | null; reason: string} {
  if (!date?.month) {
    return {walk: null, reason: "no month or day could be read from the gallery"};
  } else {
    const candidates = walks.filter(walk => sameDay(walk, date));
    const scored = candidates.map(walk => ({walk, score: sharedWordCount(title, walk)})).sort((left, right) => right.score - left.score);
    const best = scored[0];
    const runnerUp = scored[1];
    if (!best) {
      return {walk: null, reason: date.day ? "no walk on that day" : "no walks that month"};
    } else if (date.day && scored.length === 1) {
      return {walk: best.walk, reason: "the only walk on that day"};
    } else if (best.score === 0) {
      return {walk: null, reason: "no walk that month shares a place name with the gallery"};
    } else if (runnerUp && runnerUp.score === best.score) {
      return {walk: null, reason: "two walks match equally well"};
    } else {
      return {walk: best.walk, reason: `shares ${best.score} place name${best.score === 1 ? "" : "s"} with the walk`};
    }
  }
}

function galleryDateValue(date: GalleryDate | null): number | null {
  return date ? dateTimeFromObject({year: date.year, month: date.month || 1, day: date.day || 1}).toMillis() : null;
}

function sourcePageFor(album: MigratedAlbum, pages: RegistrationPage[]): RegistrationPage | null {
  const leaf = (path: string) => (path || "").split("/").pop();
  return pages.find(page => page.path === album.sourcePagePath)
    || pages.find(page => leaf(page.path) === leaf(album.sourcePagePath))
    || null;
}

function albumTitle(album: MigratedAlbum): string {
  return album.pageContent?.rows?.[0]?.carousel?.title || album.album.name;
}

export function albumGalleryDate(album: MigratedAlbum, pages: RegistrationPage[]): GalleryDate | null {
  const source = sourcePageFor(album, pages);
  return galleryDateFrom(source?.url, source?.title, albumTitle(album));
}

function withCarousel(album: MigratedAlbum, update: object): MigratedAlbum {
  const rows = album.pageContent?.rows || [];
  return rows.length && rows[0].carousel
    ? {...album, pageContent: {...album.pageContent, rows: [{...rows[0], carousel: {...rows[0].carousel, ...update}}, ...rows.slice(1)]}}
    : album;
}

export function albumsLinkedToWalks(albums: MigratedAlbum[], pages: RegistrationPage[], walks: RegistrationWalkCandidate[]): {albums: MigratedAlbum[]; links: RegistrationAlbumWalkLink[]} {
  return albums.reduce((linked, album) => {
    if (!album.sourcePagePath || album.sourcePagePath === RegistrationNavbarPath.HOME) {
      return {albums: [...linked.albums, album], links: linked.links};
    } else {
      const date = albumGalleryDate(album, pages);
      const source = sourcePageFor(album, pages);
      const title = source?.title || albumTitle(album);
      const match = matchingWalk(title, date, walks);
      const eventDate = match.walk ? dateTimeFromIso(match.walk.startDateTime).toMillis() : galleryDateValue(date);
      const updated = withCarousel(album, match.walk ? {eventId: match.walk.id, eventDate} : {eventDate});
      return {albums: [...linked.albums, updated], links: [...linked.links, {albumName: album.album.name, albumTitle: title, walk: match.walk, reason: match.reason}]};
    }
  }, {albums: [] as MigratedAlbum[], links: [] as RegistrationAlbumWalkLink[]});
}

function albumRowOf(page: PageContent): PageContentRow | null {
  return (page.rows || []).find(row => row.type === PageContentType.ALBUM) || null;
}

function galleryYear(page: PageContent, pages: RegistrationPage[]): number | null {
  const eventDate = albumRowOf(page)?.carousel?.eventDate;
  if (eventDate) {
    return dateTimeFromMillis(eventDate).year;
  } else {
    const source = pages.find(item => item.path === page.path);
    return galleryDateFrom(source?.url, source?.title, page.path)?.year || null;
  }
}

function linkListText(text: string): boolean {
  const links = (text || "").match(/\[[^\]]*\]\([^)]*\)/g) || [];
  const remaining = (text || "").replace(/\[[^\]]*\]\([^)]*\)/g, "").replace(/[\s#*_-]/g, "");
  return links.length >= 3 && remaining.length < (text || "").length * 0.2;
}

function withoutLinkLists(rows: PageContentRow[]): PageContentRow[] {
  return rows.filter(row => row.type !== PageContentType.ALBUM_INDEX)
    .filter(row => !(row.type === PageContentType.TEXT && (row.columns || []).length > 0 && (row.columns || []).every(column => linkListText(column.contentText) && !column.imageSource)));
}

function indexRow(contentPath: string, maxPathSegments: number, contentTypes: IndexContentType[], renderModes: IndexRenderMode[], field: AlbumIndexSortField): PageContentRow {
  return {
    type: PageContentType.ALBUM_INDEX, maxColumns: 3, showSwiper: false, columns: [],
    albumIndex: {
      contentPaths: [{contentPath, stringMatch: StringMatch.STARTS_WITH, maxPathSegments}],
      excludePaths: [], columnOverrides: [], contentTypes, renderModes, indexMarkdown: "", autoTitle: false,
      showInParentIndex: true, minCols: 2, maxCols: 3,
      sortConfig: {field, direction: SortDirection.DESC},
      ...(renderModes.includes(IndexRenderMode.MAP) ? {mapConfig: {...ALBUM_INDEX_MAP_CONFIG_DEFAULTS}} : {})
    }
  };
}

function headingRow(text: string): PageContentRow {
  return {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: text}]};
}

export function photosByYear(pages: PageContent[], registrationPages: RegistrationPage[]): PageContent[] {
  const root = RegistrationNavbarPath.PHOTOS;
  const galleries = pages.filter(page => page.path.startsWith(`${root}/`) && page.path.split("/").length === 2 && !!albumRowOf(page));
  const years = new Map(galleries.map(page => [page.path, galleryYear(page, registrationPages)]));
  const datedYears = [...new Set([...years.values()].filter(year => !!year))].sort((left, right) => right - left);
  if (!pages.some(page => page.path === root) || datedYears.length === 0) {
    return pages;
  } else {
    const moved = pages.map(page => {
      const year = years.get(page.path);
      return year ? {...page, path: `${root}/${year}/${page.path.split("/").pop()}`} : page;
    });
    const yearPages: PageContent[] = datedYears
      .filter(year => !pages.some(page => page.path === `${root}/${year}`))
      .map(year => ({
        path: `${root}/${year}`,
        rows: [
          headingRow(`# ${year}\n\nPhotos from our walks in ${year}.`),
          indexRow(`${root}/${year}/`, 3, [IndexContentType.ALBUMS], [IndexRenderMode.MAP, IndexRenderMode.ACTION_BUTTONS], AlbumIndexSortField.EVENT_DATE)
        ]
      }));
    return [...moved.map(page => page.path === root ? {
      ...page,
      rows: [...withoutLinkLists(page.rows || []), indexRow(`${root}/`, 2, [IndexContentType.INDEX_PAGES, IndexContentType.PAGES], [IndexRenderMode.ACTION_BUTTONS], AlbumIndexSortField.TITLE)]
    } : page), ...yearPages];
  }
}

function albumPhoto(album: MigratedAlbum): string | null {
  return albumPhotoPaths(album)[0] || null;
}

function firstImageIn(rows: PageContentRow[]): string | null {
  return rows.flatMap(row => row.columns || []).map(column => column.imageSource || firstImageIn(column.rows || [])).find(Boolean) || null;
}

function textsIn(rows: PageContentRow[]): string[] {
  return rows.flatMap(row => (row.columns || []).flatMap(column => [column.contentText || "", ...textsIn(column.rows || [])]));
}

export function shortDescription(rows: PageContentRow[]): string {
  const sentence = textsIn(rows)
    .flatMap(text => text.split(/\n\s*\n/))
    .map(block => block.replace(/^#+\s.*$/gm, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`>]/g, "").replace(/\s+/g, " ").trim())
    .filter(block => block.length > 0 && !MIGRATION_NOTE.test(block))
    .map(block => block.split(/(?<=[.!?])\s/)[0])[0] || "";
  return sentence.length > SHORT_DESCRIPTION_LENGTH ? `${sentence.slice(0, SHORT_DESCRIPTION_LENGTH).replace(/\s+\S*$/, "")}…` : sentence;
}

export function registrationKeyAreas(navigation: RegistrationPage[], pages: PageContent[], albums: MigratedAlbum[]): RegistrationKeyArea[] {
  const photoPool = albums.map(albumPhoto).filter(Boolean);
  const excluded = [RegistrationNavbarPath.HOME, RegistrationNavbarPath.ADMIN, RegistrationNavbarPath.INFORMATION] as string[];
  const fixedDescriptions: Record<string, string> = {
    [RegistrationNavbarPath.WALKS]: "See our programme of upcoming walks",
    [RegistrationNavbarPath.EVENTS]: "See our upcoming social events",
    [RegistrationNavbarPath.PHOTOS]: "Photos from our walks, year by year",
    [RegistrationNavbarPath.CONTACT_US]: "Get in touch with the committee"
  };
  return navigation
    .filter(item => !item.parentPath && item.selected && !excluded.includes(item.path))
    .map((item, index) => {
      const page = pages.find(candidate => candidate.path === item.path);
      const pageAlbum = albums.find(album => album.sourcePagePath === item.path || (album.sourcePagePath || "").startsWith(`${item.path}/`));
      const imageSource = firstImageIn(page?.rows || []) || (pageAlbum ? albumPhoto(pageAlbum) : null) || photoPool[index % Math.max(photoPool.length, 1)] || null;
      return {
        title: item.title,
        href: `/${item.path}`,
        description: fixedDescriptions[item.path] || shortDescription(page?.rows || []) || `Find out more about ${item.title.toLowerCase()}`,
        imageSource
      };
    });
}

function keyAreaRow(areas: RegistrationKeyArea[]): PageContentRow {
  return {
    type: PageContentType.ACTION_BUTTONS, maxColumns: 3, showSwiper: false,
    columns: areas.map((area): PageContentColumn => ({
      columns: 4, title: area.title, href: area.href, contentText: area.description,
      imageSource: area.imageSource || undefined, accessLevel: AccessLevel.PUBLIC
    }))
  };
}

export function homeContentRows(home: PageContent | null, areas: RegistrationKeyArea[]): PageContentRow[] {
  const rows = home?.rows || [];
  const carousel = rows.find(row => row.type === PageContentType.ALBUM);
  const migrationNoteOnly = (row: PageContentRow) => (row.columns || []).length > 0 && (row.columns || []).every(column => MIGRATION_NOTE.test(column.contentText || "") && !column.imageSource);
  const content = rows.filter(row => row.type !== PageContentType.ALBUM && row.type !== PageContentType.ALBUM_INDEX && !row.migrationPlaceholder && !migrationNoteOnly(row));
  return [...(carousel ? [carousel] : []), ...content, ...(areas.length ? [keyAreaRow(areas)] : [])];
}
