import { headingAnchorId, headingSlug } from "./heading-slug";
import { applyHeadingAnchors } from "./heading-anchors";

describe("headingSlug", () => {
  it("builds a single-dash id from the heading text", () => {
    expect(headingSlug("Hello World")).toBe("hello-world");
    expect(headingSlug("Hello, world!")).toBe("hello-world");
    expect(headingSlug("What's new?")).toBe("whats-new");
    expect(headingSlug("Foo & Bar")).toBe("foo-bar");
    expect(headingSlug("Level 2 heading - Before you join a walk make sure that...")).toBe("level-2-heading-before-you-join-a-walk-make-sure-that");
    expect(headingSlug("C++")).toBe("c");
    expect(headingSlug("Already-hyphenated")).toBe("already-hyphenated");
  });

  it("numbers a repeated heading", () => {
    const seen = new Map<string, number>();
    expect(headingAnchorId("Intro", seen)).toBe("intro");
    expect(headingAnchorId("Intro", seen)).toBe("intro-1");
    expect(headingAnchorId("Intro", seen)).toBe("intro-2");
  });
});

describe("applyHeadingAnchors", () => {
  function page(): HTMLElement {
    const root = document.createElement("div");
    root.innerHTML = `
      <h1 class="content-page-title">Walk notes</h1>
      <app-dynamic-content-view>
        <h2>Intro</h2>
        <p><a href="#intro">Back to intro</a></p>
        <h2>Intro</h2>
        <p><a href="/how-to/other#missing">Elsewhere</a></p>
      </app-dynamic-content-view>
      <h2>Ignore me</h2>
    `;
    return root;
  }

  it("ids headings in reading order and rewrites in-page hashes onto the current path", () => {
    const root = page();
    applyHeadingAnchors(root, "/how-to/article");
    const titles = root.querySelectorAll("h1, app-dynamic-content-view h2");
    expect(titles[0].id).toBe("walk-notes");
    expect(titles[1].id).toBe("intro");
    expect(titles[2].id).toBe("intro-1");
    expect(root.querySelector("app-dynamic-content-view")?.nextElementSibling?.id || "").toBe("");
    expect(root.querySelector("a[href='#intro']")).toBeNull();
    expect(root.querySelector("p a")?.getAttribute("href")).toBe("/how-to/article#intro");
    expect(root.querySelectorAll("a.heading-permalink")[0].getAttribute("href")).toBe("/how-to/article#walk-notes");
    expect(root.querySelectorAll("a.heading-permalink")[1].getAttribute("href")).toBe("/how-to/article#intro");
    expect(root.querySelector("a[href='/how-to/other#missing']")).toBeTruthy();
  });

  it("keeps the same ids when applied again", () => {
    const root = page();
    applyHeadingAnchors(root, "/how-to/article");
    applyHeadingAnchors(root, "/how-to/article");
    expect(root.querySelectorAll(".heading-permalink").length).toBe(3);
    expect(root.querySelectorAll("#intro").length).toBe(1);
  });

  it("updates in-page hashes when the page path changes", () => {
    const root = page();
    applyHeadingAnchors(root, "/how-to/article");
    applyHeadingAnchors(root, "/how-to/article?tab=notes");
    expect(root.querySelector("p a")?.getAttribute("href")).toBe("/how-to/article?tab=notes#intro");
  });
});
