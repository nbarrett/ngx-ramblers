import expect from "expect";
import { applyTextExclusions } from "../migration/text-exclusions";
import { describe, it } from "mocha";
import {
  RegistrationPageType,
  RegistrationMigrationTemplate,
  RegistrationPlan,
  RegistrationPage,
  RegistrationSiteFlavour,
  RegistrationState,
  RegistrationStep,
  StoredSiteRegistration
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { ParentPageMode } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { withContactUsLinks, discoverRegistrationPages, isNgxRamblersSite, mergeRegistrationPages, pagesFoundOn, proposedRegistrationNavigation, registrationMigrationConfig, registrationPageType, registrationContentType, registrationSourceUrl, earlierImportFilters, importedPagePath, pairedImageRows, repeatedLayoutImagePaths, withIntroductionPhotos, withoutButtonsTo, withoutEmptyRows, withPageHeading, withSourcePageAlbums } from "./registration-content";
import { assembleRegistrationPages, registrationPageTree, registrationPagesMoved, registrationPagesWithSelection } from "../../../projects/ngx-ramblers/src/app/functions/registration-page-tree";
import { SitemapMoveDirection } from "../../../projects/ngx-ramblers/src/app/models/sitemap.model";
import { excludedImage, markdownSegments, migrateStaticSite, sourceFidelityGaps } from "../migration/migrate-static-site-engine";

function registration(pages = discoverRegistrationPages(`
  <html><body><nav>
    <a href="/about.html">About us</a>
    <a href="/contact.php">Contact</a>
    <a href="/scrapbook/holidays/alps.html">Alps holiday</a>
    <a href="/walks-programme">Walks programme</a>
    <a href="https://elsewhere.example/page">Elsewhere</a>
  </nav></body></html>`, "https://group.example").pages): StoredSiteRegistration {
  return {
    id: "registration-1",
    group: {scope: "G", group_code: "AB01", area_code: "AB", groups_in_area: [], name: "Example Ramblers", url: "", external_url: "https://group.example", description: "", latitude: 0, longitude: 0, date_updated: "", date_walks_events_updated: ""},
    email: "committee@example.com",
    plan: RegistrationPlan.FULL,
    currentStep: RegistrationStep.CONTENT,
    website: "https://group.example",
    pages,
    proposedNavigation: [],
    state: RegistrationState.DRAFT,
    verifiedAt: 1,
    createdAt: 1,
    updatedAt: 1,
    environmentName: "example",
    siteUrl: null,
    flavour: RegistrationSiteFlavour.GENERIC,
    progress: [],
    error: null,
    resumeTokenHash: "resume",
    verificationTokenHash: "verify",
    verificationExpiresAt: 0,
    lastEmailAt: 1,
    migrationConfig: null,
    provisionedAt: null,
    walksLoadedAt: null,
    importedAt: null,
    reviewedAt: null,
    reviewNotifiedAt: null,
    invitedAt: null,
    leaseUntil: 0,
    leaseOwner: null
  };
}

describe("site registration content discovery", () => {
  it("classifies supported page types", () => {
    expect(registrationPageType("walks-programme")).toBe(RegistrationPageType.WALKS);
    expect(registrationPageType("committee/contact-us")).toBe(RegistrationPageType.CONTACT);
    expect(registrationPageType("scrapbook/gallery")).toBe(RegistrationPageType.GALLERY);
    expect(registrationPageType("about-us")).toBe(RegistrationPageType.TEXT);
  });

  it("discovers internal pages and proposes the missing index hierarchy", () => {
    const result = registration().pages;
    expect(result.map(page => page.path).sort()).toEqual(["about-us", "alps-holiday", "contact"]);
    expect(result.find(page => page.path === "about-us")?.title).toBe("About us");
    expect(result.find(page => page.path === "alps-holiday")?.url).toContain("/scrapbook/holidays/alps.html");
    expect(result.find(page => page.path === "walks-programme")).toBeFalsy();
  });

  it("stores navbar paths in kebab-case instead of encoded spaces", () => {
    const pages = discoverRegistrationPages(`
      <html><body><nav>
        <a href="/walk%20guides">Walk guides</a>
        <a href="/Social Events">Social events</a>
      </nav></body></html>`, "https://group.example").pages;
    expect(pages.map(page => page.path).sort()).toEqual(["social-events", "walk-guides"]);
  });

  it("omits Walks Manager programme pages and keeps walk-related content pages", () => {
    const pages = discoverRegistrationPages(`
      <html><body><nav>
        <a href="/walks">Walks</a>
        <a href="/walks-programme">Walks programme</a>
        <a href="/leaders">Walk Leaders</a>
        <a href="/guides">Walk guides</a>
      </nav></body></html>`, "https://group.example").pages;
    expect(pages.map(page => page.path).sort()).toEqual(["walk-guides", "walk-leaders"]);
  });

  it("adds Walks and Social Events navbar items when the group has those events", () => {
    const pages = assembleRegistrationPages(discoverRegistrationPages(`<nav><a href="/about">About Us</a></nav>`, "https://group.example").pages.filter(page => page.path !== "admin"), true, true);
    const roots = pages.filter(page => !page.parentPath).map(page => page.path);
    expect(roots).toContain("walks");
    expect(roots).toContain("social");
    expect(pages.find(page => page.path === "walks")?.title).toBe("Walks");
    expect(pages.find(page => page.path === "social")?.title).toBe("Events");
  });

  it("lifts About Us and Contact Us out of Information onto the navbar", () => {
    const pages = assembleRegistrationPages([
      {url: "https://group.example/", path: "home", title: "Ramblers New Forest Group", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false},
      {url: "https://group.example/i", path: "information", title: "Information", type: RegistrationPageType.INDEX, selected: true, parentPath: null, proposed: true},
      {url: "https://group.example/about", path: "information/about-us", title: "About Us", type: RegistrationPageType.TEXT, selected: true, parentPath: "information", proposed: false},
      {url: "https://group.example/contact", path: "information/contact", title: "Contact us", type: RegistrationPageType.CONTACT, selected: true, parentPath: "information", proposed: false},
      {url: "https://group.example/n1", path: "information/junk", title: "details at bottom of calendar page", type: RegistrationPageType.TEXT, selected: true, parentPath: "information", proposed: false},
      {url: "https://group.example/leaders", path: "information/walk-leaders", title: "Walk Leaders", type: RegistrationPageType.TEXT, selected: true, parentPath: "information", proposed: false}
    ], true, false);
    const roots = pages.filter(page => !page.parentPath).map(page => page.path);
    expect(roots).toContain("about-us");
    expect(roots).toContain("contact-us");
    expect(roots).toContain("home");
    expect(pages.filter(page => !page.parentPath).map(page => page.path)).toEqual(expect.arrayContaining(["about-us", "contact-us"]));
    expect(pages.find(page => page.path === "home")?.title).toBe("Home");
    expect(pages.find(page => page.path === "walks/leading-a-walk")?.parentPath).toBe("walks");
    expect(pages.filter(page => /details at bottom/i.test(page.title)).map(page => page.parentPath)).toEqual(["information"]);
    expect(pages.some(page => page.parentPath === "information" && page.title === "About Us")).toBe(false);
    expect(pages.some(page => page.parentPath === "information" && /contact/i.test(page.title))).toBe(false);
  });

  it("always keeps About Us and Contact Us on the navbar", () => {
    const pages = assembleRegistrationPages([], false, false);
    const roots = pages.filter(page => !page.parentPath).map(page => page.path);
    expect(roots).toContain("about-us");
    expect(roots).toContain("contact-us");
  });

  it("nests walk leaders under Walks instead of the navbar", () => {
    const pages = assembleRegistrationPages(discoverRegistrationPages(`
      <nav>
        <a href="/about">About Us</a>
        <a href="/leaders">Walk Leaders</a>
        <a href="/guides">Walk guides</a>
      </nav>`, "https://group.example").pages.filter(page => page.path !== "admin"), true, false);
    expect(pages.find(page => page.path === "walks/leading-a-walk")?.parentPath).toBe("walks");
    expect(pages.find(page => page.path === "walks/walk-guides")?.parentPath).toBe("walks");
    expect(pages.filter(page => !page.parentPath).map(page => page.path)).not.toContain("leading-a-walk");
  });

  it("moves a walk leaders page's own sub-pages with it when it goes under Walks", () => {
    const page = (path: string, title: string, parentPath: string | null) => ({url: `https://group.example/${path}`, path, title, parentPath, type: RegistrationPageType.TEXT, selected: true, proposed: false});
    const pages = assembleRegistrationPages([
      page("leading-a-walk", "Leading a walk", null),
      page("leading-a-walk/lift-sharing", "Lift Sharing", "leading-a-walk"),
      page("leading-a-walk/resources-for-walkers", "Resources for walkers", "leading-a-walk")
    ] as RegistrationPage[], true, false);
    expect(pages.find(item => item.title === "Lift Sharing")).toEqual(expect.objectContaining({path: "walks/leading-a-walk/lift-sharing", parentPath: "walks/leading-a-walk"}));
    expect(pages.filter(item => item.parentPath && !pages.some(parent => parent.path === item.parentPath))).toEqual([]);
  });

  it("keeps at most eight navbar items and hangs extra pages under More", () => {
    const links = ["Home", "About Us", "Contact", "News", "Social", "Links", "Committee", "History", "Lift Sharing", "Books"]
      .map(title => `<a href="/${title.toLowerCase().replace(/ /g, "-")}">${title}</a>`).join("");
    const pages = assembleRegistrationPages(discoverRegistrationPages(`<html><body><nav>${links}</nav></body></html>`, "https://group.example").pages);
    const roots = pages.filter(page => !page.parentPath);
    expect(roots.length).toBeLessThanOrEqual(8);
    expect(roots.map(page => page.path).sort()).toEqual(["about-us", "admin", "contact-us", "home", "information"]);
    expect(roots.some(page => page.path === "walks")).toBe(false);
    expect(pages.filter(page => page.parentPath).every(page => pages.some(parent => parent.path === page.parentPath))).toBe(true);
  });

  it("keeps sentence-titled source pages but excludes them from the navbar", () => {
    const discovered = discoverRegistrationPages(`
      <html><body><nav>
        <a href="/about">About Us</a>
        <a href="/n1">details at bottom of calendar page</a>
        <a href="/n2">Our 2026 AGM is on November 21st</a>
        <a href="/n3">Could this be you?</a>
      </nav></body></html>`, "https://group.example").pages;
    const pages = assembleRegistrationPages(discovered);
    expect(discovered.map(page => page.path)).toEqual(expect.arrayContaining(["details-at-bottom-of-calendar-page", "our-2026-agm-is-on-november-21-st", "could-this-be-you"]));
    const extras = pages.filter(page => /calendar|AGM|Could this/i.test(page.title));
    expect(extras.length).toBeGreaterThan(0);
    expect(extras.every(page => page.parentPath === "information")).toBe(true);
    expect(pages.filter(page => !page.parentPath).map(page => page.path)).not.toEqual(expect.arrayContaining(extras.map(page => page.path)));
  });

  it("nests discovered pages under their parent path", () => {
    const tree = registrationPageTree(discoverRegistrationPages(`<nav><ul><li><a href="/about">About us</a><ul><li><a href="/scrapbook">Scrapbook</a></li></ul></li></ul></nav>`, "https://group.example").pages);
    const about = tree.find(node => node.key === "about-us");
    const scrapbook = about?.children.find(node => node.key === "about-us/scrapbook");
    expect(about).toBeTruthy();
    expect(scrapbook).toBeTruthy();
  });

  it("clears a section and its children when import is switched off", () => {
    const nested = discoverRegistrationPages(`<nav><ul><li><a href="/about">About us</a><ul><li><a href="/scrapbook">Scrapbook</a></li></ul></li></ul></nav>`, "https://group.example").pages;
    const pages = registrationPagesWithSelection(nested, "about-us", false);
    expect(pages.filter(page => page.path.startsWith("about-us")).every(page => page.selected === false)).toBe(true);
  });

  it("moves a page among its siblings", () => {
    const pages = registration().pages;
    const moved = registrationPagesMoved(pages, "about-us", SitemapMoveDirection.DOWN);
    const roots = moved.filter(page => !page.parentPath).map(page => page.path);
    expect(roots.indexOf("about-us")).toBeGreaterThan(pages.filter(page => !page.parentPath).map(page => page.path).indexOf("about-us"));
  });

  it("recognises Ramblerswebs and WordPress without requiring either flavour", () => {
    expect(discoverRegistrationPages('<div class="BMenu"><a href="/about">About</a></div>', "https://group.example").flavour).toBe(RegistrationSiteFlavour.RAMBLERSWEBS);
    expect(discoverRegistrationPages('<meta name="generator" content="WordPress 6"><a href="/about">About</a>', "https://group.example").flavour).toBe(RegistrationSiteFlavour.WORDPRESS);
    expect(discoverRegistrationPages('<nav><a href="/about">About</a></nav>', "https://group.example").flavour).toBe(RegistrationSiteFlavour.GENERIC);
  });

  it("keeps query-string pages and gives different source URLs unique destination paths", () => {
    const first = discoverRegistrationPages(`<nav><a href="/page?id=1">News</a><a href="/page?id=2">News</a></nav>`, "https://group.example").pages;
    const second = discoverRegistrationPages(`<nav><a href="/other">News</a></nav>`, "https://group.example/page?id=1").pages;
    const merged = mergeRegistrationPages([...first, ...second]);
    expect(merged.filter(page => !page.proposed).map(page => page.url)).toEqual([
      "https://group.example/page?id=1",
      "https://group.example/page?id=2",
      "https://group.example/other"
    ]);
    expect(merged.filter(page => !page.proposed).map(page => page.path)).toEqual(["news", "news-2", "news-3"]);
  });

  it("normalises tracking parameters without removing page-defining query values", () => {
    expect(registrationSourceUrl("https://group.example/page?utm_source=email&id=2&fbclid=abc#top")).toBe("https://group.example/page?id=2");
  });

  it("recognises existing NGX Ramblers sites on standard and custom hostnames", () => {
    expect(isNgxRamblersSite("<html></html>", "https://example.ngx-ramblers.org.uk")).toBe(true);
    expect(isNgxRamblersSite('<meta name="generator" content="NGX Ramblers">', "https://walks.example.org.uk")).toBe(true);
    expect(isNgxRamblersSite('<meta name="theme-color" content="#1b4332"><link rel="manifest" href="/manifest.webmanifest"><app-root></app-root>', "https://walks.example.org.uk")).toBe(true);
    expect(isNgxRamblersSite("<html><body>Another site</body></html>", "https://walks.example.org.uk")).toBe(false);
  });

  it("uses nested source navigation to propose a hierarchy when source URLs are flat", () => {
    const result = discoverRegistrationPages(`<nav><ul><li><a href="/walks">Walks</a><ul><li><a href="/scrapbook">Scrapbook</a></li></ul></li></ul></nav>`, "https://group.example");
    expect(result.pages.map(page => page.path)).toEqual(["scrapbook"]);
    expect(result.pages[0].parentPath).toBe(null);
  });

  it("builds and persists navigation candidates from selected root pages", () => {
    expect(proposedRegistrationNavigation(assembleRegistrationPages(registration().pages)).map(item => item.path).filter(path => path !== "admin").sort()).toEqual(["about-us", "alps-holiday", "contact-us"]);
  });
});

describe("site registration migration config", () => {
  it("uses the existing migration modes and includes every discovered source page", () => {
    const config = registrationMigrationConfig(registration());
    expect(config.uploadTos3).toBe(false);
    expect(config.persistData).toBe(false);
    expect(config.requireSourceFidelity).toBe(true);
    expect(config.parentPages.some(page => page.pathPrefix === "walks-programme")).toBe(false);
    expect(config.parentPages.some(page => page.pathPrefix === "about-us")).toBe(true);
    expect(config.parentPages.find(page => page.pathPrefix === "contact")?.pageTransformation?.name).toBe("Registration contact");
    expect(config.parentPages.find(page => page.pathPrefix === "contact")?.templateFragmentId).toBe(RegistrationMigrationTemplate.CONTACT);
    const nested = registrationMigrationConfig({...registration(), pages: discoverRegistrationPages(`<nav><ul><li><a href="/about">About us</a><ul><li><a href="/scrapbook">Scrapbook</a></li></ul></li></ul></nav>`, "https://group.example").pages});
    expect(nested.parentPages.some(page => page.pathPrefix === "photos" || page.pathPrefix === "about-us/scrapbook")).toBe(true);
  });

  it("reports source text and images that a transformation failed to carry across", () => {
    const source = {path: "https://group.example/about", title: "About", segments: [
      {text: "Authentic source text"},
      {text: "Source caption", image: {src: "https://group.example/source.jpg", alt: "Source caption"}}
    ]};
    const complete = {path: "about", rows: [{type: PageContentType.TEXT, maxColumns: 2, showSwiper: false, columns: [
      {columns: 9, contentText: "Authentic source text"},
      {columns: 3, imageSource: "https://group.example/source.jpg", alt: "Source caption"}
    ]}]};
    expect(sourceFidelityGaps(source, complete)).toEqual([]);
    expect(sourceFidelityGaps(source, {path: "about", rows: []})).toEqual([
      "text block 1: Authentic source text", "text block 2: Source caption", "image: https://group.example/source.jpg"
    ]);
    expect(sourceFidelityGaps(source, {...complete, rows: [{...complete.rows[0], columns: [
      ...complete.rows[0].columns, {columns: 12, imageSource: "https://new.example/stock.jpg", alt: ""}
    ]}]})).toContain("non-source image: https://new.example/stock.jpg");
    const copiedImage = "site-content/copied-source.jpg";
    const copied = {...complete, rows: [{...complete.rows[0], columns: complete.rows[0].columns.map(column =>
      column.imageSource ? {...column, imageSource: copiedImage} : column)}]};
    expect(sourceFidelityGaps(source, copied, new Map([["https://group.example/source.jpg", copiedImage]]))).toEqual([]);
  });

  it("supplies built-in selectors for recognised WordPress sites", () => {
    const saved = registration();
    saved.flavour = RegistrationSiteFlavour.WORDPRESS;
    const config = registrationMigrationConfig(saved);
    expect(config.menuSelector).toContain(".wp-block-navigation");
    expect(config.contentSelector).toContain(".entry-content");
  });

  it("includes an entire source branch even when stale selection flags say otherwise", () => {
    const saved = {...registration(), pages: discoverRegistrationPages(`<nav><ul><li><a href="/about">About us</a><ul><li><a href="/scrapbook">Scrapbook</a></li></ul></li></ul></nav>`, "https://group.example").pages};
    saved.pages = [
      {url: "https://group.example/information", path: "information", title: "Information", type: RegistrationPageType.INDEX, selected: false, parentPath: null, proposed: true},
      {url: "https://group.example/scrapbook", path: "information/scrapbook", title: "Scrapbook", type: RegistrationPageType.TEXT, selected: true, parentPath: "information", proposed: false}
    ];
    const config = registrationMigrationConfig(saved);
    expect(config.parentPages.map(page => page.pathPrefix)).toEqual(["information", "information/scrapbook"]);
  });

  it("allows source-fidelity validation to be disabled for diagnosis", () => {
    expect(registrationMigrationConfig(registration(), false).requireSourceFidelity).toBe(false);
  });

  it("builds proposed folders as browseable child indexes through the migration engine", async () => {
    const config = registrationMigrationConfig({...registration(), pages: [
      {url: "https://group.example/information", path: "information", title: "Information", type: RegistrationPageType.INDEX, selected: true, parentPath: null, proposed: true},
      {url: "https://group.example/scrapbook", path: "information/scrapbook", title: "Scrapbook", type: RegistrationPageType.TEXT, selected: true, parentPath: "information", proposed: false}
    ]});
    config.parentPages = config.parentPages.filter(page => page.pathPrefix === "information");
    delete config.parentPages[0].templateFragmentId;
    const browser = {
      newPage: async () => ({route: async () => null, on: () => null, goto: async () => null, evaluate: async () => [], close: async () => null}),
      close: async () => null
    } as any;
    const result = await migrateStaticSite(config, browser);
    expect(result.pageContents[0].path).toBe("information");
    expect(result.pageContents[0].rows[0].type).toBe(PageContentType.ALBUM_INDEX);
    expect(result.pageContents[0].rows[0].albumIndex.contentPaths[0].contentPath).toBe("information/");
  });

  it("keeps a linked image whole so no link fragments are left in the text", () => {
    const logo = {src: "https://group.example/images/logo.png", alt: ""};
    const badge = {src: "https://group.example/images/badge.png", alt: "Walk with us"};
    const markdown = "[![](https://group.example/images/logo.png)](https://partner.example/)\n\nWelcome to the group\n\n[![Walk with us](/images/badge.png)](https://group.example/walks.html)\n\nSee our programme";
    expect(markdownSegments(markdown, [logo, badge])).toEqual([
      {text: "", image: logo},
      {text: "Welcome to the group"},
      {text: "Walk with us", image: badge},
      {text: "See our programme"}
    ]);
  });

  it("still splits plain images that are not links", () => {
    const photo = {src: "https://group.example/images/photo.jpg", alt: "Photo"};
    expect(markdownSegments("Before ![Photo](https://group.example/images/photo.jpg) after", [photo])).toEqual([
      {text: "Before"},
      {text: "Photo", image: photo},
      {text: "after"}
    ]);
  });
});


describe("site registration page grouping", () => {
  const page = (path: string, title: string, url: string, type = RegistrationPageType.TEXT, parentPath: string = null) => ({url, path, title, type, selected: true, parentPath, proposed: false});

  it("keeps pages found only on another page under that page, and puts a photo gallery and its galleries under Photos", () => {
    const home = page("home", "Home", "https://group.example/");
    const topLevel = [
      home,
      page("photo-gallery", "Photo Gallery", "https://group.example/gallery/", RegistrationPageType.GALLERY),
      page("newsletter-archive", "Newsletter Archive", "https://group.example/newsarchive.htm"),
      page("new-walkers", "New Walkers", "https://group.example/newwalkers.htm"),
      page("links", "Links", "https://group.example/links.htm"),
      page("path-checkers", "Path Checkers", "https://group.example/pathcheckers.htm"),
      page("future-events", "Future Events", "https://group.example/futureevents.php"),
      page("using-a-compass", "Using a Compass", "https://group.example/compass.htm")
    ];
    const galleries = pagesFoundOn(topLevel, "https://group.example/gallery/", [
      page("3-parks-walk-may-2026", "3 Parks Walk May 2026", "https://group.example/gallery.php?3parks"),
      page("new-walkers", "New Walkers", "https://group.example/newwalkers.htm")
    ]);
    const newsletters = pagesFoundOn(topLevel, "https://group.example/newsarchive.htm", [page("newsletter-issue-45", "Newsletter Issue 45", "https://group.example/newsletters.php?45")]);
    const fromHome = pagesFoundOn(topLevel, "https://group.example/", [page("links", "Links", "https://group.example/links.htm")]);
    expect(galleries.map(item => item.path)).toEqual(["photo-gallery/3-parks-walk-may-2026", "new-walkers"]);
    expect(fromHome.map(item => item.path)).toEqual(["links"]);
    const assembled = assembleRegistrationPages(mergeRegistrationPages([...topLevel, ...galleries, ...newsletters]), true, false);
    const pathOf = (url: string) => assembled.find(item => item.url === url && !item.proposed)?.path;
    expect(pathOf("https://group.example/gallery/")).toEqual("photos");
    expect(pathOf("https://group.example/gallery.php?3parks")).toEqual("photos/3-parks-walk-may-2026");
    expect(pathOf("https://group.example/newsletters.php?45")).toEqual("information/newsletter-archive/newsletter-issue-45");
    expect(assembled.find(item => item.path === "photos/3-parks-walk-may-2026").parentPath).toEqual("photos");
    expect(assembleRegistrationPages(assembled, true, false).map(item => item.path).sort()).toEqual(assembled.map(item => item.path).sort());
  });
});

describe("site registration page addresses and layout images", () => {
  it("removes pages and albums from an earlier import that this import did not write again, leaving template fragments alone", () => {
    const filters = earlierImportFilters(["information/walk-may-2026", "gallery/home-photos"], ["gallery/home-photos"]);
    expect(filters.pages.path.$nin).toEqual(["information/walk-may-2026", "gallery/home-photos"]);
    expect(filters.pages.path.$not.test("fragments/templates/self-service/child-index")).toBe(true);
    expect(filters.pages.$or).toEqual([{debugLogs: {$exists: true}}, {path: /^gallery\//}]);
    expect(filters.albums.name.$nin).toEqual(["gallery/home-photos"]);
    expect(filters.albums.name.$regex.test("gallery/2026/may/3-parks-walk-photos")).toBe(true);
    expect(filters.albums.name.$regex.test("committee/2025")).toBe(false);
  });

  it("keeps a proposed index on its own path when it borrows a child page address, and follows moved pages by address", () => {
    const galleryUrl = "https://group.example/gallery.php?20260510+Walk__=";
    const pages = [
      {url: galleryUrl, path: "information", title: "Information", type: RegistrationPageType.INDEX, selected: true, parentPath: null as string, proposed: true},
      {url: galleryUrl, path: "information/walk-may-2026", title: "Walk May 2026", type: RegistrationPageType.TEXT, selected: true, parentPath: "information", proposed: false},
      {url: "https://group.example/about.htm", path: "about-us/about", title: "About", type: RegistrationPageType.TEXT, selected: true, parentPath: "about-us", proposed: false}
    ];
    const moved = pages.map(page => page.path === "about-us/about" ? {...page, path: "contact/about", parentPath: "contact"} : page);
    expect(importedPagePath("information", pages, moved)).toEqual("information");
    expect(importedPagePath("information/walk-may-2026", pages, moved)).toEqual("information/walk-may-2026");
    expect(importedPagePath("about-us/about", pages, moved)).toEqual("contact/about");
  });

  it("treats a site root and its index page as the same page", () => {
    expect(registrationSourceUrl("https://group.example/index.html")).toEqual(registrationSourceUrl("https://group.example/"));
    expect(registrationSourceUrl("https://group.example/walks/default.aspx")).toEqual("https://group.example/walks/");
    const result = discoverRegistrationPages(`<nav><ul><li><a href="/index.html">Home</a></li><li><a href="/">Home</a></li><li><a href="/about.html">About us</a></li></ul></nav>`, "https://group.example");
    expect(result.pages.map(page => page.path)).toEqual(["about-us", "home"]);
  });

  it("excludes images repeated across most pages as layout, keeping images unique to a page", () => {
    const page = (path: string, images: string[]) => ({url: `https://group.example/${path}.html`, path, title: path, type: RegistrationPageType.TEXT, selected: true, parentPath: null as string, proposed: false, imageUrls: images.map(image => `https://group.example/images/${image}`)});
    const pages = [
      page("home", ["banner.png", "logo.png", "walkers.jpg"]),
      page("contact", ["banner.png", "logo.png"]),
      page("social", ["banner.png", "logo.png", "picnic.jpg"]),
      page("books", ["banner.png", "logo.png", "walkers.jpg"])
    ];
    expect(repeatedLayoutImagePaths(pages).sort()).toEqual(["images/banner.png", "images/logo.png"]);
    expect(repeatedLayoutImagePaths(pages.slice(0, 2))).toEqual([]);
  });

  it("keeps excluded layout images out of the imported page entirely", () => {
    const excludeImageUrls = repeatedLayoutImagePaths([
      {url: "https://group.example/", path: "home", title: "Home", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false, imageUrls: ["https://group.example/images/banner.png", "https://group.example/images/walkers.jpg"]},
      {url: "https://group.example/contact.html", path: "contact", title: "Contact", type: RegistrationPageType.CONTACT, selected: true, parentPath: null, proposed: false, imageUrls: ["https://group.example/images/banner.png"]},
      {url: "https://group.example/books.html", path: "books", title: "Books", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false, imageUrls: ["https://group.example/images/banner.png"]}
    ]);
    const images = [{src: "https://group.example/images/banner.png", alt: ""}, {src: "https://group.example/images/walkers.jpg", alt: "Walkers"}];
    const markdown = applyTextExclusions("![](images/banner.png)\n\n## Welcome\n\n![Walkers](https://group.example/images/walkers.jpg)", {excludeImageUrls});
    const segments = markdownSegments(markdown, images.filter(image => !excludedImage(image.src, excludeImageUrls)));
    expect(segments.filter(segment => segment.image).map(segment => segment.image.src)).toEqual(["https://group.example/images/walkers.jpg"]);
  });

  it("turns old site contact pages into contact us links for the matching committee role", () => {
    const text = "[Membership Secretary](https://group.example/component/contact/contact/4-membership.html?Itemid=101&catid=10)";
    expect(withContactUsLinks(text, "information/members")).toBe("[Membership Secretary](?contact-us&role=membership&redirect=information/members)");
    expect(withContactUsLinks("[Footpath Secretary](/component/contact/contact/1-footpaths.html)", "information/footpaths"))
      .toBe("[Footpath Secretary](?contact-us&role=walks&redirect=information/footpaths)");
    expect(withContactUsLinks("[Get in touch](/index.php?option=com_contact&view=contact&id=2)", "contact-us"))
      .toBe("[Get in touch](?contact-us&role=contact-us&redirect=contact-us)");
    expect(withContactUsLinks("[Our walks](/walks.html)", "walks")).toBe("[Our walks](/walks.html)");
  });

  it("sets consecutive images side by side at half width, two to a row", () => {
    const image = (name: string) => ({type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, imageSource: `site-content/${name}.jpg`}]});
    const text = {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "Our walks"}]};
    const rows = [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: true, columns: [{columns: 12, rows: [image("a"), image("b"), image("c")]}]}, text, image("d")];
    const paired = pairedImageRows(rows);
    const nested = paired[0].columns[0].rows;
    expect(nested.map(row => row.columns.map(column => `${column.imageSource}@${column.columns}`))).toEqual([
      ["site-content/a.jpg@6", "site-content/b.jpg@6"],
      ["site-content/c.jpg@6"]
    ]);
    expect(paired[1]).toEqual(text);
    expect(paired[2].columns.map(column => column.columns)).toEqual([12]);
  });

  it("keeps a lone image full width in an ordinary row, without a nested row around it", () => {
    const hero = {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, imageSource: "site-content/hero.jpg"}]};
    const text = {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# Footpaths"}]};
    const paired = pairedImageRows([{type: PageContentType.TEXT, maxColumns: 1, showSwiper: true, columns: [{columns: 12, rows: [hero]}]}, text]);
    expect(paired[0].columns).toEqual([{columns: 12, imageSource: "site-content/hero.jpg"}]);
    expect(paired[0].columns[0].rows).toBeUndefined();
    expect(paired[1]).toEqual(text);
  });

  it("imports a real page that has child pages with its own content template, keeping child index only for proposed sections", () => {
    const page = (path: string, proposed: boolean) => ({url: proposed ? "" : `https://group.example/${path}/`, path, title: path, type: RegistrationPageType.INDEX, selected: true, parentPath: null as string, proposed});
    expect(registrationContentType(page("contact-us", false))).toBe(RegistrationPageType.CONTACT);
    expect(registrationContentType(page("more-links", false))).toBe(RegistrationPageType.TEXT);
    expect(registrationContentType(page("information", true))).toBe(RegistrationPageType.INDEX);
  });

  it("leaves an old site's upcoming walks page to the Walks Manager walks page", () => {
    const config = registrationMigrationConfig({...registration(), pages: [
      ...registration().pages,
      {url: "https://group.example/upcoming-walks/", path: "upcoming-walks", title: "Upcoming Walks", type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false}
    ]});
    expect(config.parentPages.some(page => page.pathPrefix === "upcoming-walks")).toBe(false);
  });

  it("places an album from a page directly under that page's main heading", () => {
    const text = (contentText: string) => ({type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText}]});
    const albumRow = {type: PageContentType.ALBUM, maxColumns: 1, showSwiper: false, columns: [{columns: 12}]};
    const pages = [{path: "photos", rows: [text("Search\n\n# Photos\n\nOur walks in pictures"), text("Migrated from the old site")]}, {path: "home", rows: [text("Welcome")]}];
    const albums = [{album: {name: "gallery/group-photos"} as any, pageContent: {path: "gallery/group-photos", rows: [albumRow]}, sourcePagePath: "photos"}];
    const placed = withSourcePageAlbums(pages, albums);
    expect(placed[0].rows.map(row => row.type === PageContentType.ALBUM ? "album" : row.columns[0].contentText)).toEqual(["Search\n\n# Photos", "album", "Our walks in pictures", "Migrated from the old site"]);
    expect(placed[1]).toEqual(pages[1]);
  });

  it("gives a page with no main heading one from its title, and drops rows left empty once images were left out", () => {
    const text = (contentText: string) => ({type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText}]});
    const emptyImages = {type: PageContentType.TEXT, maxColumns: 1, showSwiper: true, columns: [{columns: 12, rows: [{type: PageContentType.TEXT, maxColumns: 2, showSwiper: false, columns: [{columns: 6, imageSource: null as string, alt: "Image"}]}]}]};
    const page = {path: "information/walk", rows: [text(""), emptyImages, text("Migrated from the old site")]};
    expect(withoutEmptyRows(page.rows)).toEqual([text("Migrated from the old site")]);
    expect(withPageHeading({...page, rows: withoutEmptyRows(page.rows)}, "3 Parks Walk").rows.map(row => row.columns[0].contentText)).toEqual(["# 3 Parks Walk", "Migrated from the old site"]);
    expect(withPageHeading({path: "about", rows: [text("# About us")]}, "About")).toEqual({path: "about", rows: [text("# About us")]});
  });

  it("removes buttons that point at pages the build took away, and the button row when none are left", () => {
    const button = (href: string) => ({columns: 6, title: href, href});
    const buttons = (...hrefs: string[]) => ({type: PageContentType.ACTION_BUTTONS, maxColumns: 2, showSwiper: false, columns: hrefs.map(button)});
    const text = {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: "# Walks"}]};
    expect(withoutButtonsTo([text, buttons("walks/information", "walks/admin")], ["walks/information"])).toEqual([text, buttons("walks/admin")]);
    expect(withoutButtonsTo([text, buttons("/walks/information")], ["walks/information"])).toEqual([text]);
  });

  it("keeps a gallery page's query exactly as the old site wrote it, dropping only tracking parameters", () => {
    const gallery = "https://group.example/flashgallery/mobile.php?20250112%20Haversham%20%26%20New%20Bradwell~January%202025__";
    expect(registrationSourceUrl(gallery)).toEqual(gallery);
    expect(registrationSourceUrl("https://group.example/page.php?b=2&utm_source=news&a=1&fbclid=xyz#top")).toEqual("https://group.example/page.php?a=1&b=2");
    expect(registrationSourceUrl("https://group.example/page.php?utm_campaign=autumn")).toEqual("https://group.example/page.php");
  });

  it("puts a real photo under the heading of each indexed page that has no images, so its index card shows it too", () => {
    const text = (contentText: string) => ({type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText}]});
    const indexRow = {type: PageContentType.ALBUM_INDEX, maxColumns: 4, showSwiper: true, columns: [], albumIndex: {contentPaths: []}} as any;
    const ownPhoto = {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, imageSource: "site-content/own.jpg"}]};
    const pages = [
      {path: "information", rows: [text("## Information"), indexRow]},
      {path: "information/faq", rows: [text("# FAQ\n\nWhat are the walks like?"), text("Migrated from the old site")]},
      {path: "information/documents", rows: [text("Documents without a heading")]},
      {path: "information/photos", rows: [text("# Photos"), ownPhoto]},
      {path: "about", rows: [text("# About")]}
    ];
    const albums = [{album: {rootFolder: "site-content", name: "gallery/home-photos", files: [{image: "a.jpg"}, {image: "b.jpg"}]} as any, pageContent: {path: "gallery/home-photos", rows: []}}];
    const placed = withIntroductionPhotos(pages, albums);
    expect(placed[1].rows.map(row => row.columns[0].contentText || row.columns[0].imageSource)).toEqual(["# FAQ", "site-content/gallery/home-photos/a.jpg", "What are the walks like?", "Migrated from the old site"]);
    expect(placed[2].rows[0].columns[0].imageSource).toEqual("site-content/gallery/home-photos/b.jpg");
    expect(placed[3]).toEqual(pages[3]);
    expect(placed[4]).toEqual(pages[4]);
    expect(withIntroductionPhotos(pages, [])).toEqual(pages);
  });

  it("repairs a gallery address that was saved after its query had been re-encoded", () => {
    const saved = "https://group.example/flashgallery/mobile.php?20250112+Haversham+%26+New+Bradwell%7EJanuary+2025__=";
    expect(registrationSourceUrl(saved)).toEqual("https://group.example/flashgallery/mobile.php?20250112%20Haversham%20%26%20New%20Bradwell~January%202025__");
    expect(registrationSourceUrl("https://group.example/search.php?q=walks+in+kent")).toEqual("https://group.example/search.php?q=walks+in+kent");
  });

  it("repairs saved child page addresses as well as top-level ones", () => {
    const saved = "https://group.example/flashgallery/mobile.php?20250112+Haversham+%26+New+Bradwell%7EJanuary+2025__=";
    const config = registrationMigrationConfig({...registration(), pages: [
      ...registration().pages,
      {url: "https://group.example/gallery/", path: "photo-gallery", title: "Photo Gallery", type: RegistrationPageType.INDEX, selected: true, parentPath: null, proposed: false},
      {url: saved, path: "photo-gallery/haversham", title: "Haversham", type: RegistrationPageType.TEXT, selected: true, parentPath: "photo-gallery", proposed: false}
    ]});
    const children = config.parentPages.flatMap(page => page.selectedChildren || []);
    expect(children.map(child => child.path)).toContain("https://group.example/flashgallery/mobile.php?20250112%20Haversham%20%26%20New%20Bradwell~January%202025__");
  });
});

