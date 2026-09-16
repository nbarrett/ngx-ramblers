import expect from "expect";
import { describe, it } from "mocha";
import { AlbumView, IndexContentType, IndexRenderMode, PageContent, PageContentType, StringMatch } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { MigratedAlbum } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { RegistrationPage, RegistrationPageType, RegistrationWalkCandidate } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { albumsLinkedToWalks, galleryDescription, homeContentRows, matchingWalk, photosByYear, registrationKeyAreas, shortDescription } from "./registration-photos";
import { albumFrom, repeatsAnAlbum } from "../migration/migrate-static-site-engine";
import { migrationNoteRow } from "../migration/page-transformation-engine";
import { galleryDateFrom } from "../../../projects/ngx-ramblers/src/app/functions/gallery-date";

const walks: RegistrationWalkCandidate[] = [
  {id: "w1", startDateTime: "2025-12-21T10:00:00Z", title: "Buckingham Canal and Thornborough", location: ""},
  {id: "w2", startDateTime: "2025-04-06T10:00:00Z", title: "Caldecotte Brook", location: "Meet large public car park at Caldecotte Lake"},
  {id: "w3", startDateTime: "2025-04-13T10:00:00Z", title: "Calverton, Beachampton, Deanshanger and Stony Stratford", location: ""},
  {id: "w4", startDateTime: "2026-08-23T10:00:00Z", title: "Olney", location: "Clubhouse Recreation Ground, East Street, Olney, MK46 4DW"},
  {id: "w5", startDateTime: "2026-08-30T10:00:00Z", title: "Howe Park Wood Short Walk", location: "Howe Park Discovery Centre Car Park"}
];

function page(path: string, title: string, url: string, parentPath = "photos"): RegistrationPage {
  return {path, title, url, parentPath, type: RegistrationPageType.GALLERY, selected: true, proposed: false} as RegistrationPage;
}

function album(name: string, title: string, sourcePagePath: string): MigratedAlbum {
  return {
    album: {rootFolder: RootFolder.siteContent, name, files: [{image: "photo.jpg"}]} as any,
    pageContent: {path: name, rows: [{type: PageContentType.ALBUM, maxColumns: 1, showSwiper: false, columns: [], carousel: {name, title, albumView: AlbumView.GALLERY} as any}]},
    sourcePagePath
  };
}

describe("registration-photos", () => {

  describe("galleryDateFrom", () => {
    it("reads an exact day from a gallery link, and short month names from a title", () => {
      expect(galleryDateFrom("https://example.org/flashgallery/mobile.php?20251221%20Buckingham%20Canal~December%202025")).toEqual({year: 2025, month: 12, day: 21});
      expect(galleryDateFrom("Olney Aug 2026")).toEqual({year: 2026, month: 8, day: null});
      expect(galleryDateFrom("Mike Mellor Way Sept 2026")).toEqual({year: 2026, month: 9, day: null});
      expect(galleryDateFrom("No date here")).toBe(null);
    });
  });

  describe("matchingWalk", () => {
    it("links a gallery to the only walk on its day", () => {
      expect(matchingWalk("Buckingham Canal Thornborough", {year: 2025, month: 12, day: 21}, walks).walk?.id).toBe("w1");
    });

    it("picks the walk that month sharing a place name, using the meeting place too", () => {
      expect(matchingWalk("Caldecotte Brook April 2025", {year: 2025, month: 4, day: null}, walks).walk?.id).toBe("w2");
      expect(matchingWalk("Olney Aug 2026", {year: 2026, month: 8, day: null}, walks).walk?.id).toBe("w4");
    });

    it("leaves a gallery unlinked when nothing matches or two walks tie", () => {
      expect(matchingWalk("Somewhere Else April 2025", {year: 2025, month: 4, day: null}, walks).walk).toBe(null);
      expect(matchingWalk("Anywhere", {year: 2020, month: 1, day: null}, walks).reason).toBe("no walks that month");
      expect(matchingWalk("Park Walk", {year: 2026, month: 8, day: null}, [
        {id: "a", startDateTime: "2026-08-01T10:00:00Z", title: "Park loop", location: ""},
        {id: "b", startDateTime: "2026-08-02T10:00:00Z", title: "Park circuit", location: ""}
      ]).reason).toBe("two walks match equally well");
    });
  });

  describe("albumsLinkedToWalks", () => {
    it("stores the walk id and date on the album so the map can place it", () => {
      const pages = [page("photos/olney-aug-2026", "Olney Aug 2026", "https://example.org/gallery/?m")];
      const linked = albumsLinkedToWalks([album("gallery/2026/august/olney-photos", "Olney Aug 2026 photos", "photos/olney-aug-2026")], pages, walks);
      const carousel = linked.albums[0].pageContent.rows[0].carousel;
      expect(carousel.eventId).toBe("w4");
      expect(carousel.eventDate).toBeGreaterThan(0);
      expect(linked.links[0].walk?.title).toBe("Olney");
    });
  });

  describe("gallery descriptions", () => {
    it("describes a gallery from its walk, or from its date when no walk matched", () => {
      expect(galleryDescription("Olney Aug 2026", {year: 2026, month: 8, day: null}, walks[3])).toBe("Photos from our Olney walk on Sunday 23 August 2026.");
      expect(galleryDescription("Wolverton Town Trail July 2026", {year: 2026, month: 7, day: null}, null)).toBe("Photos from our walk in July 2026.");
      expect(galleryDescription("Wolverton Town Trail July 2026", null, null)).toBe("Photos from Wolverton Town Trail.");
    });

    it("does not add walk to a walk title that already says so, or keep its trailing full stop", () => {
      const picnic = {...walks[3], title: "Midsummer walk and picnic.", startDateTime: "2026-07-04T10:00:00+01:00"};
      expect(galleryDescription("Midsummer Walk and Picnic July 2026", null, picnic)).toBe("Photos from our Midsummer walk and picnic on Saturday 4 July 2026.");
    });
  });

  describe("photosByYear", () => {
    const indexTemplate: PageContent = {path: "fragments/templates/self-service/photos-index", rows: [
      {type: PageContentType.ALBUM_INDEX, maxColumns: 3, showSwiper: false, columns: [], albumIndex: {contentPaths: [{contentPath: "example", stringMatch: StringMatch.STARTS_WITH, maxPathSegments: 1}], contentTypes: [IndexContentType.INDEX_PAGES, IndexContentType.PAGES], renderModes: [IndexRenderMode.ACTION_BUTTONS]} as any}
    ]};
    const yearTemplate: PageContent = {path: "fragments/templates/self-service/photos-year", rows: [
      {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# {{year}}\n\nPhotos from our walks in {{year}}."}]},
      {type: PageContentType.ALBUM_INDEX, maxColumns: 3, showSwiper: false, columns: [], marginBottom: 3, albumIndex: {contentPaths: [{contentPath: "photos/2000", stringMatch: StringMatch.STARTS_WITH, maxPathSegments: 1}], contentTypes: [IndexContentType.ALBUMS], renderModes: [IndexRenderMode.MAP, IndexRenderMode.ACTION_BUTTONS], mapConfig: {mapHeight: 513, osStyle: "Outdoor_27700"}} as any}
    ]};
    const templates = {index: indexTemplate, year: yearTemplate};

    it("moves galleries under a page per year, indexes the years on the photos page and drops the old link list", () => {
      const albumRow = (eventDate: number) => ({type: PageContentType.ALBUM, maxColumns: 1, showSwiper: false, columns: [], carousel: {name: "x", eventDate} as any});
      const pages: PageContent[] = [
        {path: "photos", rows: [
          {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# Photos"}]},
          {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "[Olney\nAug 2026](/photos/olney-aug-2026)\n\n[Brill\nJune 2025](/photos/brill-june-2025)\n\n[Lavendon\nApril 2025](/photos/lavendon-april-2025)"}]}
        ]},
        {path: "photos/olney-aug-2026", rows: [albumRow(1787482800000)]},
        {path: "photos/brill-june-2025", rows: [albumRow(1749546000000)]}
      ];
      const organised = photosByYear(pages, [], templates, [52.03, -0.83]);
      const paths = organised.map(item => item.path).sort();
      expect(paths).toEqual(["photos", "photos/2025", "photos/2025/brill-june-2025", "photos/2026", "photos/2026/olney-aug-2026"]);
      const landing = organised.find(item => item.path === "photos");
      expect(landing.rows.map(row => row.type)).toEqual([PageContentType.TEXT, PageContentType.ALBUM_INDEX]);
      expect(landing.rows[1].showSwiper).toBe(false);
      const year = organised.find(item => item.path === "photos/2026").rows.find(row => row.type === PageContentType.ALBUM_INDEX);
      expect(year.albumIndex.contentTypes).toEqual([IndexContentType.ALBUMS]);
      expect(year.albumIndex.renderModes).toEqual([IndexRenderMode.MAP, IndexRenderMode.ACTION_BUTTONS]);
      expect(year.albumIndex.contentPaths).toEqual([{contentPath: "photos/2026", stringMatch: "starts-with", maxPathSegments: 1}]);
      expect(landing.rows[1].albumIndex.contentPaths).toEqual([{contentPath: "photos", stringMatch: "starts-with", maxPathSegments: 1}]);
    });

    it("builds each year page from the template, filling in the year, its own path and the group's map centre", () => {
      const pages: PageContent[] = [
        {path: "photos", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# Photos"}]}]},
        {path: "photos/olney-aug-2026", rows: [{type: PageContentType.ALBUM, maxColumns: 1, showSwiper: false, columns: [], carousel: {name: "x", eventDate: 1787482800000} as any}]}
      ];
      const yearPage = photosByYear(pages, [], templates, [52.03, -0.83]).find(item => item.path === "photos/2026");
      expect(yearPage.rows[0].columns[0].contentText).toBe("# 2026\n\nPhotos from our walks in 2026.");
      expect(yearPage.rows[1].marginBottom).toBe(3);
      expect(yearPage.rows[1].albumIndex.mapConfig).toEqual({mapHeight: 513, osStyle: "Outdoor_27700", mapCenter: [52.03, -0.83]});
      expect(yearTemplate.rows[0].columns[0].contentText).toContain("{{year}}");
    });

    it("uses the walk date so a gallery without eventDate on the page still sits under its year", () => {
      const pages: PageContent[] = [
        {path: "photos", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# Photos"}]}]},
        {path: "photos/olney-aug-2026", rows: [{type: PageContentType.ALBUM, maxColumns: 1, showSwiper: false, columns: [], carousel: {name: "x"} as any}]}
      ];
      const organised = photosByYear(pages, [page("photos/olney-aug-2026", "Olney Aug 2026", "https://example.org/gallery/?m")], templates, null);
      expect(organised.map(item => item.path).sort()).toEqual(["photos", "photos/2026", "photos/2026/olney-aug-2026"]);
    });
  });

  describe("home page", () => {
    it("keeps one carousel above the heading and introduction, then buttons to the key areas", () => {
      const home: PageContent = {path: "home", rows: [
        {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# Milton Keynes & District Group"}]},
        {type: PageContentType.ALBUM, maxColumns: 1, showSwiper: false, columns: [], carousel: {name: "gallery/home-photos"} as any},
        {type: PageContentType.ALBUM, maxColumns: 1, showSwiper: false, columns: [], carousel: {name: "another"} as any},
        {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "## Introduction\n\nWe are a group of people who enjoy walking."}]},
        migrationNoteRow("Migrated from", "https://example.org")
      ]};
      const navigation = [
        {path: "home", title: "Home", selected: true, parentPath: null},
        {path: "about-us", title: "About Us", selected: true, parentPath: null, proposed: true},
        {path: "walks", title: "Walks", selected: true, parentPath: null},
        {path: "photos", title: "Photos", selected: true, parentPath: null}
      ] as RegistrationPage[];
      const photos: PageContent = {path: "photos", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# Photos\n\nPictures from our Sunday walks."}]}]};
      const areas = registrationKeyAreas(navigation, [home, photos], [album("gallery/home-photos", "Home photos", "home")], new Set(["home", "photos"]));
      const rows = homeContentRows(home, areas);
      expect(rows.map(row => row.type)).toEqual([PageContentType.ALBUM, PageContentType.TEXT, PageContentType.TEXT, PageContentType.ACTION_BUTTONS]);
      expect(rows[0].carousel.showTitle).toBe(false);
      expect(rows[3].columns.map(column => [column.title, column.contentText])).toEqual([["Walks", "See our programme of upcoming walks"], ["Photos", "Pictures from our Sunday walks."]]);
      expect(rows[3].maxColumns).toBe(2);
      expect(rows[3].columns.every(column => !!column.imageSource && column.columns === 6)).toBe(true);
    });

    it("describes a page in one short sentence, which a migration note row never supplies", () => {
      expect(shortDescription([migrationNoteRow("Migrated from", "https://example.org"), {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# About\n\nWe walk every Sunday. We also meet midweek."}]}])).toBe("We walk every Sunday.");
    });
  });

  describe("migration engine albums", () => {
    it("names albums with short month names and skips photo clusters already collected into a page album", () => {
      expect(albumFrom("Olney Aug 2026 photos")).toBe("gallery/2026/august/olney-photos");
      const collected = [{album: null, pageContent: null, sourceImageUrls: ["a.jpg", "b.jpg", "c.jpg"]}] as MigratedAlbum[];
      expect(repeatsAnAlbum([{src: "a.jpg", alt: ""}, {src: "b.jpg", alt: ""}, {src: "c.jpg", alt: ""}], collected)).toBe(true);
      expect(repeatsAnAlbum([{src: "x.jpg", alt: ""}, {src: "y.jpg", alt: ""}, {src: "z.jpg", alt: ""}], collected)).toBe(false);
    });
  });
});
