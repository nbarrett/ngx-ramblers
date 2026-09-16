import expect from "expect";
import {describe, it} from "mocha";
import {PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {RegistrationNavbarPath, RegistrationPageType, StoredSiteRegistration} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import {documentSlug, rewriteRegistrationPageLinks, tooSmallForPhoto} from "./registration-assets";

describe("registration assets", () => {
  it("rewrites links between migrated pages while retaining anchors", () => {
    const registration = {
      website: "https://group.example/",
      pages: [
        {url: "https://group.example/", path: RegistrationNavbarPath.HOME, title: "Home", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false},
        {url: "https://group.example/about", path: "about", title: "About", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false}
      ],
      proposedNavigation: [{path: RegistrationNavbarPath.HOME, title: "Home"}, {path: "about", title: "About"}]
    } as StoredSiteRegistration;
    const pages = [{path: RegistrationNavbarPath.HOME, rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Read [about us](/about#history)."}]}]}];
    const rewritten = rewriteRegistrationPageLinks(registration, pages);
    expect(rewritten[0].rows[0].columns[0].contentText).toBe("Read [about us](/about-us#history).");
  });

  it("rewrites a source document link to its migrated destination", () => {
    const registration = {website: "https://group.example/", pages: [], proposedNavigation: []} as StoredSiteRegistration;
    const pages = [{path: RegistrationNavbarPath.HOME, rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Read [minutes](/files/minutes.pdf)."}]}]}];
    const rewritten = rewriteRegistrationPageLinks(registration, pages, new Map([["https://group.example/files/minutes.pdf", "/home/minutes"]]));
    expect(rewritten[0].rows[0].columns[0].contentText).toBe("Read [minutes](/home/minutes).");
  });

  it("leaves out an image the current website no longer has, instead of keeping a broken address", () => {
    const registration = {website: "https://group.example/", pages: [], proposedNavigation: []} as StoredSiteRegistration;
    const missing = "https://group.example/images/missing.png";
    const pages = [{path: RegistrationNavbarPath.HOME, rows: [{type: PageContentType.TEXT, maxColumns: 2, showSwiper: false, columns: [{columns: 6, imageSource: missing}, {columns: 6, imageSource: "https://group.example/images/walkers.jpg"}]}]}];
    const rewritten = rewriteRegistrationPageLinks(registration, pages, new Map(), new Map([["https://group.example/images/walkers.jpg", "site-content/walkers.jpg"]]), new Set([missing]));
    expect(rewritten[0].rows[0].columns.map(column => column.imageSource)).toEqual([null, "site-content/walkers.jpg"]);
  });

  it("names a document page after the link that pointed to it, unless the link text is generic", () => {
    const link = (label: string) => ({label, href: "/files/imgp01.pdf", parentPath: "information/links", sourcePageUrl: "https://group.example/links.html"});
    expect(documentSlug(link("Forestry Car Parks"), "pdf image imgp 01")).toBe("forestry-car-parks");
    expect(documentSlug(link("click here"), "Summer Newsletter")).toBe("summer-newsletter");
    expect(documentSlug(link("imgp01"), "")).toBe("imgp-01");
  });

  it("keeps a link that shows its own address, such as the migration note, pointing at the old site", () => {
    const registration = {
      website: "https://group.example/",
      pages: [{url: "https://group.example/books.htm", path: "books", title: "Books", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false}],
      proposedNavigation: [{path: "books", title: "Books"}]
    } as StoredSiteRegistration;
    const note = "Migrated from [https://group.example/books.htm](https://group.example/books.htm) on 2026-09-17 03:19";
    const pages = [{path: "books", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: `See [our books](https://group.example/books.htm). ${note}`}]}]}];
    const rewritten = rewriteRegistrationPageLinks(registration, pages);
    const contentText = rewritten[0].rows[0].columns[0].contentText;
    expect(contentText).toContain(note);
    expect(contentText).not.toContain("[our books](https://group.example/books.htm)");
  });

  it("turns links and images pointing back at the old site into plain text, unless they were imported", () => {
    const registration = {
      website: "https://www.group.example/",
      pages: [{url: "https://www.group.example/about.htm", path: "about", title: "About", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false}],
      proposedNavigation: [{path: "about", title: "About"}]
    } as StoredSiteRegistration;
    const text = [
      "Come on our [walks](https://www.group.example/walks.php \"walks programme\") and read [about us](https://www.group.example/about.htm).",
      "![](https://www.group.example/images/hill.jpg)",
      "* [AGM 2024 - Minutes (Draft)](https://www.group.example/AGM2025/2024%20AGM%20Minutes%20\\(Draft\\).pdf)",
      "See [Hike MK](https://www.hikemk.example/).",
      "[Public Site](http://www.group.example/ \"Home\")"
    ].join("\n\n");
    const pages = [{path: "about", rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: text}]}]}];
    const minutes = "https://www.group.example/AGM2025/2024%20AGM%20Minutes%20(Draft).pdf";
    const rewritten = rewriteRegistrationPageLinks(registration, pages, new Map([[minutes, "/about/agm-2024-minutes"]]));
    expect(rewritten[0].rows[0].columns[0].contentText).toBe([
      "Come on our walks and read [about us](/about-us).",
      "",
      "* [AGM 2024 - Minutes (Draft)](/about/agm-2024-minutes)",
      "See [Hike MK](https://www.hikemk.example/).",
      ""
    ].join("\n\n"));
  });

  it("treats logos, buttons and counters as too small to be photos, but keeps real photos and unreadable images", () => {
    expect(tooSmallForPhoto(100, 100)).toBe(true);
    expect(tooSmallForPhoto(468, 60)).toBe(true);
    expect(tooSmallForPhoto(800, 600)).toBe(false);
    expect(tooSmallForPhoto(undefined, undefined)).toBe(false);
  });
});

