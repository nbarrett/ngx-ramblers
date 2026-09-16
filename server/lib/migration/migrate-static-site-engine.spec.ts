import expect from "expect";
import { describe, it } from "mocha";
import { discoverPhotoClusters, flickrGroupLinks, pageImageRuns, skippedPageReason, withoutRepeatedBlocks } from "./migrate-static-site-engine";
import { HttpError } from "../shared/http-error";

function pageClosedBeforeReadFinishes() {
  const state = {closed: false, rejectRead: null as (error: Error) => void, resolveRead: null as (value: unknown) => void};
  const page = {
    on: () => undefined,
    goto: async () => ({ok: () => true}),
    evaluate: () => new Promise((resolve, reject) => {
      state.resolveRead = resolve;
      state.rejectRead = reject;
      setTimeout(() => resolve([{title: "Photos", images: [{src: "https://example.org/a.jpg", alt: ""}]}]), 20);
    }),
    close: async () => {
      state.closed = true;
      state.rejectRead?.(new Error("page.evaluate: Target page, context or browser has been closed"));
    }
  };
  return {page, state};
}

describe("discoverPhotoClusters", () => {
  it("finishes reading the page before closing it", async () => {
    const {page, state} = pageClosedBeforeReadFinishes();
    const ctx = {
      config: {baseUrl: "https://example.org", contentSelector: "main"},
      browser: {newPage: async () => page},
      imageMappings: new Map(),
      templateCache: new Map()
    };
    const clusters = await discoverPhotoClusters(ctx as any, "https://example.org", "Home");
    expect(state.closed).toEqual(true);
    expect(clusters).toEqual([{title: "Home photos", images: [{src: "https://example.org/a.jpg", alt: ""}]}]);
  });
});

describe("flickrGroupLinks", () => {
  it("links each Flickr group to a photos page in preference to other pages that mention it", () => {
    const page = (path: string, contentText: string) => ({path, rows: [{type: "text", maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText}]}]});
    const pages = [
      page("contact-us", "A [Flickr group](https://www.flickr.com/groups/examplegroup/) has been set up."),
      page("photos", "See [our Flickr group](http://www.flickr.com/groups/examplegroup)"),
      page("home", "Nothing about Flickr")
    ] as any;
    expect(flickrGroupLinks(pages)).toEqual([{groupName: "examplegroup", pagePath: "photos"}]);
  });
});

describe("pageImageRuns", () => {
  const image = (name: string) => ({type: "text", maxColumns: 1, showSwiper: false, columns: [{columns: 12, imageSource: `https://group.example/images/${name}.jpg`, alt: "Image"}]});
  const text = (contentText: string) => ({type: "text", maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText}]});
  const imageContainer = (names: string[]) => ({type: "text", maxColumns: 1, showSwiper: true, columns: [{columns: 12, rows: names.map(image)}]});

  it("takes a run of photos out of the page so they can become an album, keeping the page text", () => {
    const page = {path: "home", rows: [imageContainer(["a", "b", "c", "d", "e"]), text("# Home"), text("Migrated from the old site")]} as any;
    const runs = pageImageRuns(page);
    expect(runs.images.map(item => item.src)).toEqual(["a", "b", "c", "d", "e"].map(name => `https://group.example/images/${name}.jpg`));
    expect(runs.images[0].alt).toEqual("");
    expect(runs.rows).toEqual([text("# Home"), text("Migrated from the old site")]);
  });

  it("still finds a run of photos when each photo carries only a leftover list bullet as its caption", () => {
    const bulleted = (name: string) => ({...image(name), columns: [{...image(name).columns[0], contentText: "*", showTextAfterImage: true}]});
    const page = {path: "information/walk", rows: [{type: "text", maxColumns: 1, showSwiper: true, columns: [{columns: 12, rows: ["a", "b", "c", "d"].map(bulleted)}]}, text("# Walk")]} as any;
    const runs = pageImageRuns(page);
    expect(runs.images.length).toEqual(4);
    expect(runs.rows).toEqual([text("# Walk")]);
  });

  it("makes an album of even two photos on a gallery page, leaving just its heading", () => {
    const page = {path: "photos/tyringham-riverside-february-2025", rows: [text("# Tyringham Riverside February 2025"), imageContainer(["01", "02"])]} as any;
    const runs = pageImageRuns(page, 1);
    expect(runs.images.length).toEqual(2);
    expect(runs.rows).toEqual([text("# Tyringham Riverside February 2025")]);
  });

  it("leaves a page with only a few photos as it is", () => {
    const page = {path: "about", rows: [imageContainer(["a", "b"]), text("# About")]} as any;
    const runs = pageImageRuns(page);
    expect(runs.images).toEqual([]);
    expect(runs.rows).toEqual(page.rows);
  });

  it("removes the same photos from the page text once they are in the album", () => {
    const src = (name: string) => `https://group.example/images/${name}.jpg`;
    const page = {path: "home", rows: [imageContainer(["a", "b", "c", "d"]), text(`# Home\n\nWelcome\n\n![](${src("a")} "A")\n\n![](${src("b")})\n\nMore text\n\n![](https://elsewhere.example/other.jpg)`)]} as any;
    const runs = pageImageRuns(page);
    const contentText = runs.rows[0].columns[0].contentText;
    expect(contentText).not.toContain(src("a"));
    expect(contentText).not.toContain(src("b"));
    expect(contentText).toContain("More text");
    expect(contentText).toContain("https://elsewhere.example/other.jpg");
  });
});

describe("withoutRepeatedBlocks", () => {
  const page = (path: string, contentText: string) => ({path, rows: [{type: "text", maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText}]}]}) as any;
  const header = "css/blue.css\n\n# The Example Walkers\n\n**_Example District Group_**\n\n[Public Site](http://www.group.example/)";
  const footer = "The [Ramblers Association](http://www.ramblers.org.uk/) is a company limited by guarantee.";

  it("removes header and footer text repeated across many pages, keeping each page's own content", () => {
    const pages = [
      page("home", `${header}\n\n## Introduction\n\nWe walk every Sunday.\n\n${footer}`),
      page("information/agm", `${header}\n\n## AGM 2025\n\nThe AGM is in October.\n\n${footer}`),
      page("information/new-walkers", `${header}\n\n## New walkers\n\nEveryone is welcome.\n\n${footer}`),
      page("information/contacts", `${header}\n\n## Contacts\n\nEmail the secretary.\n\n${footer}`)
    ];
    const cleaned = withoutRepeatedBlocks(pages).map(item => item.rows[0].columns[0].contentText);
    expect(cleaned[0]).toEqual("## Introduction\n\nWe walk every Sunday.");
    expect(cleaned[1]).toEqual("## AGM 2025\n\nThe AGM is in October.");
    expect(cleaned.join(" ")).not.toContain("css/blue.css");
  });

  it("removes the old site's header from a few pages of a large site when the home page carries it too", () => {
    const others = Array.from({length: 20}, (_, index) => page(`information/walk-${index}`, `## Walk ${index}\n\nPhotos from walk ${index}.`));
    const pages = [
      page("home", `${header}\n\n## Introduction\n\nWe walk every Sunday.`),
      page("information/agm", `${header}\n\n## AGM 2025\n\nThe AGM is in October.`),
      page("information/agm-minutes", `${header}\n\n## Minutes\n\nApproved.`),
      ...others
    ];
    const cleaned = withoutRepeatedBlocks(pages).map(item => item.rows[0].columns[0].contentText);
    expect(cleaned[1]).toEqual("## AGM 2025\n\nThe AGM is in October.");
    expect(cleaned[3]).toEqual("## Walk 0\n\nPhotos from walk 0.");
  });

  it("leaves a small site alone when text appears on fewer than three pages", () => {
    const pages = [page("home", `${footer}\n\nWelcome`), page("about", `${footer}\n\nAbout us`)];
    expect(withoutRepeatedBlocks(pages)).toEqual(pages);
  });
});


describe("skippedPageReason", () => {
  it("explains a skipped page in plain words", () => {
    expect(skippedPageReason(new HttpError(404, "https://group.example/newsletter31.pdf returned HTTP 404 (text/html)."))).toEqual("the old site no longer has this page");
    expect(skippedPageReason(new HttpError(500, "failed"))).toEqual("the old site answered with HTTP 500");
    expect(skippedPageReason(new Error("socket hang up"))).toEqual("socket hang up");
  });
});
