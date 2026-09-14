import expect from "expect";
import { describe, it } from "mocha";
import {
  RegistrationPageType,
  RegistrationMigrationTemplate,
  RegistrationPlan,
  RegistrationSiteFlavour,
  RegistrationState,
  RegistrationStep,
  StoredSiteRegistration
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { ParentPageMode } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { discoverRegistrationPages, isNgxRamblersSite, mergeRegistrationPages, proposedRegistrationNavigation, registrationMigrationConfig, registrationPageType, registrationSourceUrl } from "./registration-content";
import { assembleRegistrationPages, registrationPageTree, registrationPagesMoved, registrationPagesWithSelection } from "../../../projects/ngx-ramblers/src/app/functions/registration-page-tree";
import { SitemapMoveDirection } from "../../../projects/ngx-ramblers/src/app/models/sitemap.model";
import { migrateStaticSite, sourceFidelityGaps } from "../migration/migrate-static-site-engine";

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
    expect(pages.some(page => /details at bottom/i.test(page.title))).toBe(false);
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
    expect(pages.some(page => /calendar|AGM|Could this/i.test(page.title))).toBe(false);
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
    expect(proposedRegistrationNavigation(assembleRegistrationPages(registration().pages)).map(item => item.path).filter(path => path !== "admin").sort()).toEqual(["about-us", "contact-us", "information"]);
  });
});

describe("site registration migration config", () => {
  it("uses the existing migration modes and includes every discovered source page", () => {
    const config = registrationMigrationConfig(registration());
    expect(config.uploadTos3).toBe(true);
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
});
