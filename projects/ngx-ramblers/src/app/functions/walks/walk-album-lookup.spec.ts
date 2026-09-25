import { PageContentType } from "../../models/content-text.model";
import {
  albumRowMatchesEventDate,
  albumRowReferencesEvent,
  normalisedAlbumBasePaths,
  preferredWalkAlbumPage,
  walkAlbumEventIds
} from "./walk-album-lookup";

describe("walk-album-lookup", () => {
  it("includes the migrated walk id among album event ids", () => {
    expect(walkAlbumEventIds({
      id: "new-id",
      ramblersId: null,
      groupEvent: {id: null},
      fields: {migratedFromId: "67a9ec8aef3ed5028cd59e9b"}
    } as any)).toEqual(["new-id", "67a9ec8aef3ed5028cd59e9b"]);
  });

  it("normalises album base paths and drops blanks and duplicates", () => {
    expect(normalisedAlbumBasePaths([" /walks/photos/ ", "walks/weekends-away", "walks/photos", ""])).toEqual([
      "walks/photos",
      "walks/weekends-away"
    ]);
  });

  it("matches a carousel event id", () => {
    expect(albumRowReferencesEvent({carousel: {eventId: "67a9ec8aef3ed5028cd59e9b"}} as any, ["new-id", "67a9ec8aef3ed5028cd59e9b"])).toBe(true);
  });

  it("matches a carousel event date", () => {
    expect(albumRowMatchesEventDate({carousel: {eventDate: 1746831600000}} as any, 1746831600000)).toBe(true);
    expect(albumRowMatchesEventDate({carousel: {eventDate: 1746831600000}} as any, 1746918000000)).toBe(false);
  });

  it("prefers a nested weekend-away album over an index page when the event id matches", () => {
    const chosen = preferredWalkAlbumPage([
      {path: "walks/weekends-away/shropshire-may-2025", rows: [{type: PageContentType.TEXT, carousel: {name: "walks/weekends-away/shropshire-may-2025"}}]},
      {
        path: "walks/weekends-away/shropshire-may-2025/day-2",
        rows: [{
          type: PageContentType.ALBUM,
          carousel: {name: "walks/weekends-away/shropshire-may-2025/day-2", eventId: "old-id"}
        }]
      }
    ] as any, ["new-id", "old-id"], null);
    expect(chosen?.path).toEqual("walks/weekends-away/shropshire-may-2025/day-2");
  });

  it("can match an album under an extra path by event date when no event id is stored", () => {
    const chosen = preferredWalkAlbumPage([
      {
        path: "walks/weekends-away/shropshire-may-2025/day-2",
        rows: [{
          type: PageContentType.ALBUM,
          carousel: {name: "walks/weekends-away/shropshire-may-2025/day-2", eventDate: 1746831600000}
        }]
      }
    ] as any, ["new-id"], 1746831600000);
    expect(chosen?.path).toEqual("walks/weekends-away/shropshire-may-2025/day-2");
  });
});
