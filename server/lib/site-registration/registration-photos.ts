import {
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { GalleryDate, MigratedAlbum } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import {
  RegistrationAlbumWalkLink,
  RegistrationKeyArea,
  RegistrationNavbarPath,
  REGISTRATION_TEMPLATE_YEAR,
  RegistrationPage,
  RegistrationPhotoTemplates,
  RegistrationWalkCandidate
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { galleryDateFrom, MONTH_NAME_PATTERN } from "../../../projects/ngx-ramblers/src/app/functions/gallery-date";
import { albumPhotoPaths } from "./registration-content";
import { dateTimeFromIso, dateTimeFromMillis, dateTimeFromObject } from "../shared/dates";

const IGNORED_WORDS = new Set(["and", "the", "of", "a", "an", "to", "from", "at", "in", "on", "via", "with", "walk", "walks", "circular", "short", "long", "photos", "photo", "gallery", "stage", "part", "group", "ramblers", "day"]);
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
      const subtitle = galleryDescription(title, date, match.walk);
      const updated = withCarousel(album, match.walk ? {eventId: match.walk.id, eventDate, subtitle} : {eventDate, subtitle});
      return {albums: [...linked.albums, updated], links: [...linked.links, {albumName: album.album.name, albumTitle: title, walk: match.walk, reason: match.reason}]};
    }
  }, {albums: [] as MigratedAlbum[], links: [] as RegistrationAlbumWalkLink[]});
}

export function galleryDescription(title: string, date: GalleryDate | null, walk: RegistrationWalkCandidate | null): string {
  if (walk) {
    const walkTitle = walk.title.trim().replace(/[.!,;:\s]+$/, "");
    const walkName = /\bwalk\b/i.test(walkTitle) ? walkTitle : `${walkTitle} walk`;
    return `Photos from our ${walkName} on ${dateTimeFromIso(walk.startDateTime).toFormat("cccc d LLLL yyyy")}.`;
  } else if (date?.day && date.month) {
    return `Photos from our walk on ${dateTimeFromObject({year: date.year, month: date.month, day: date.day}).toFormat("cccc d LLLL yyyy")}.`;
  } else if (date?.month) {
    return `Photos from our walk in ${dateTimeFromObject({year: date.year, month: date.month, day: 1}).toFormat("LLLL yyyy")}.`;
  } else {
    return `Photos from ${title.replace(MONTH_NAME_PATTERN, "").replace(/\b(19|20)\d{2}\b/g, "").replace(/\s+/g, " ").trim()}.`;
  }
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

function withMigrationNoteLast(rows: PageContentRow[]): PageContentRow[] {
  return [...rows.filter(row => row.type !== PageContentType.MIGRATION_NOTE), ...rows.filter(row => row.type === PageContentType.MIGRATION_NOTE)];
}

function templateRows(template: PageContent, contentPath: string, year: string, mapCenter: [number, number] | null): PageContentRow[] {
  const rows: PageContentRow[] = JSON.parse(JSON.stringify(template.rows || []).split(REGISTRATION_TEMPLATE_YEAR).join(year));
  return rows.map(row => row.albumIndex ? {
    ...row,
    albumIndex: {
      ...row.albumIndex,
      contentPaths: (row.albumIndex.contentPaths || []).map(item => ({...item, contentPath})),
      ...(row.albumIndex.mapConfig && mapCenter ? {mapConfig: {...row.albumIndex.mapConfig, mapCenter}} : {})
    }
  } : row);
}

export function photosByYear(pages: PageContent[], registrationPages: RegistrationPage[], templates: RegistrationPhotoTemplates, mapCenter: [number, number] | null): PageContent[] {
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
        rows: templateRows(templates.year, `${root}/${year}`, `${year}`, mapCenter)
      }));
    return [...moved.map(page => page.path === root ? {
      ...page,
      rows: withMigrationNoteLast([...withoutLinkLists(page.rows || []), ...templateRows(templates.index, root, "", mapCenter)])
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
    .filter(block => block.length > 0)
    .map(block => block.split(/(?<=[.!?])\s/)[0])[0] || "";
  return sentence.length > SHORT_DESCRIPTION_LENGTH ? `${sentence.slice(0, SHORT_DESCRIPTION_LENGTH).replace(/\s+\S*$/, "")}…` : sentence;
}

export function registrationKeyAreas(navigation: RegistrationPage[], pages: PageContent[], albums: MigratedAlbum[], availablePaths: Set<string>): RegistrationKeyArea[] {
  const photoPool = albums.map(albumPhoto).filter(Boolean);
  const excluded = [RegistrationNavbarPath.HOME, RegistrationNavbarPath.ADMIN, RegistrationNavbarPath.INFORMATION,
    RegistrationNavbarPath.WALKS, RegistrationNavbarPath.EVENTS] as string[];
  const descriptionFor = (path: string): string => {
    const page = pages.find(candidate => candidate.path === path);
    const children = pages.filter(candidate => candidate.path.startsWith(`${path}/`) && candidate.path.split("/").length === path.split("/").length + 1);
    return shortDescription(withoutIndexRows(page?.rows || []))
      || children.map(child => shortDescription(withoutIndexRows(child.rows || []))).find(Boolean)
      || "";
  };
  return navigation
    .filter(item => !item.parentPath && item.selected && !excluded.includes(item.path))
    .filter(item => availablePaths.has(item.path))
    .map(item => ({item, description: descriptionFor(item.path)}))
    .filter(entry => !!entry.description)
    .map((entry, index) => {
      const page = pages.find(candidate => candidate.path === entry.item.path);
      const pageAlbum = albums.find(album => album.sourcePagePath === entry.item.path || (album.sourcePagePath || "").startsWith(`${entry.item.path}/`));
      return {
        title: entry.item.title,
        href: `/${entry.item.path}`,
        description: entry.description,
        imageSource: firstImageIn(page?.rows || []) || (pageAlbum ? albumPhoto(pageAlbum) : null) || photoPool[index % Math.max(photoPool.length, 1)] || null
      };
    });
}

function withoutIndexRows(rows: PageContentRow[]): PageContentRow[] {
  return rows.filter(row => row.type !== PageContentType.ALBUM_INDEX);
}

export function balancedColumnCount(count: number): number {
  if (count <= 3) {
    return Math.max(count, 1);
  } else if (count === 4) {
    return 2;
  } else {
    return 3;
  }
}

function keyAreaRow(areas: RegistrationKeyArea[]): PageContentRow {
  const columnCount = balancedColumnCount(areas.length);
  return {
    type: PageContentType.ACTION_BUTTONS, maxColumns: columnCount, showSwiper: false,
    columns: areas.map((area): PageContentColumn => ({
      columns: 12 / columnCount, title: area.title, href: area.href, contentText: area.description,
      imageSource: area.imageSource || undefined, accessLevel: AccessLevel.PUBLIC
    }))
  };
}

export function homeContentRows(home: PageContent | null, areas: RegistrationKeyArea[]): PageContentRow[] {
  const rows = home?.rows || [];
  const albumRow = rows.find(row => row.type === PageContentType.ALBUM);
  const carousel = albumRow?.carousel ? {...albumRow, carousel: {...albumRow.carousel, showTitle: false}} : albumRow;
  const content = rows.filter(row => ![PageContentType.ALBUM, PageContentType.ALBUM_INDEX, PageContentType.MIGRATION_NOTE].includes(row.type) && !row.migrationPlaceholder);
  return [...(carousel ? [carousel] : []), ...content, ...(areas.length ? [keyAreaRow(areas)] : [])];
}
