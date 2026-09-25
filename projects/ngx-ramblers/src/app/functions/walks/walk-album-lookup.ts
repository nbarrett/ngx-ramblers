import { ExtendedGroupEvent } from "../../models/group-event.model";
import { PageContent, PageContentRow, PageContentType } from "../../models/content-text.model";

export function walkAlbumEventIds(walk: ExtendedGroupEvent): string[] {
  return [walk?.id, walk?.groupEvent?.id, walk?.ramblersId, walk?.fields?.migratedFromId]
    .filter(Boolean)
    .map(id => String(id))
    .filter((id, index, all) => all.indexOf(id) === index);
}

export function normalisedAlbumBasePaths(paths: string[]): string[] {
  return (paths || [])
    .map(path => (path || "").trim().replace(/^\/+|\/+$/g, ""))
    .filter((path, index, all) => !!path && all.indexOf(path) === index);
}

export function albumRowReferencesEvent(row: PageContentRow, eventIds: string[]): boolean {
  const eventId = row?.carousel?.eventId;
  return eventId != null && eventIds.includes(String(eventId));
}

export function albumRowMatchesEventDate(row: PageContentRow, eventDateMs: number | null): boolean {
  if (eventDateMs == null || row?.carousel?.eventDate == null) {
    return false;
  } else {
    return Number(row.carousel.eventDate) === eventDateMs;
  }
}

export function preferredWalkAlbumPage(pages: PageContent[], eventIds: string[], eventDateMs: number | null): PageContent | null {
  const withPath = (pages || []).filter(page => !!page?.path);
  if (withPath.length === 0) {
    return null;
  } else {
    const scored = withPath.map(page => {
      const path = page.path || "";
      const segments = path.split("/").filter(Boolean).length;
      const matchingRows = (page.rows || []).filter(row =>
        albumRowReferencesEvent(row, eventIds) || albumRowMatchesEventDate(row, eventDateMs));
      const albumRows = matchingRows.filter(row => row?.type === PageContentType.ALBUM || !!row?.carousel?.name);
      const carouselNameLooksLikeAlbum = albumRows.some(row => (row?.carousel?.name || "").includes("/"));
      const eventIdMatch = matchingRows.some(row => albumRowReferencesEvent(row, eventIds));
      return {
        page,
        score: (eventIdMatch ? 200 : 0)
          + (albumRows.length > 0 ? 80 : 0)
          + (carouselNameLooksLikeAlbum ? 50 : 0)
          + segments
          + matchingRows.length
      };
    }).filter(candidate => candidate.score >= 80);
    return scored.reduce((best, candidate) => {
      if (!best || candidate.score > best.score) {
        return candidate;
      } else {
        return best;
      }
    }, null as { page: PageContent; score: number } | null)?.page || null;
  }
}
