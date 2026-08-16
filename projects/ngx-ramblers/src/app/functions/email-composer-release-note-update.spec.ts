import { ArticleBlockImageAlignment, ArticleBlockPosition, ComposerFragmentKind, NewsletterCadence, ReleaseNoteUpdateCategory } from "../models/email-composer.model";
import { DateRangeUnit } from "../models/search.model";
import { ReleaseNoteUpdateDraft } from "../models/ai.model";
import {
  releaseNoteUpdateArticlesFrom,
  releaseNoteUpdateConfigurationFrom,
  releaseNoteUpdateFragmentOrder,
  releaseNoteUpdateSettingsFrom,
  releaseNoteUpdateSubject
} from "./email-composer";

function draft(overrides: Partial<ReleaseNoteUpdateDraft> = {}): ReleaseNoteUpdateDraft {
  return {
    intro: "A few things have shipped.",
    items: [{
      path: "how-to/committee/release-notes/2026-08-10-share",
      url: "https://example.test/how-to/committee/release-notes/2026-08-10-share",
      sourcePaths: ["how-to/committee/release-notes/2026-08-10-share"],
      sourceNotes: [{
        description: "Members can now see and share clear walk information",
        url: "https://example.test/how-to/committee/release-notes/2026-08-10-share",
        date: "10 August 2026"
      }],
      title: "Share a walk more easily",
      body: "Members can send a walk to a friend from the walk page.",
      theme: "Running walks",
      category: ReleaseNoteUpdateCategory.NON_EMAIL
    }],
    indexPath: "how-to/committee/release-notes",
    indexUrl: "https://example.test/how-to/committee/release-notes",
    ...overrides
  };
}

describe("release note update composer helpers", () => {

  it("turns highlighted items into article blocks with a read more link", () => {
    const articles = releaseNoteUpdateArticlesFrom(draft({indexUrl: null, indexPath: null}));

    expect(articles.length).toBe(1);
    expect(articles[0].title).toBe("Share a walk more easily");
    expect(articles[0].markdown).toContain("Members can send a walk to a friend from the walk page.");
    expect(articles[0].markdown).toContain("**Related release notes**");
    expect(articles[0].markdown).toContain("On [10 August 2026](https://example.test/how-to/committee/release-notes/2026-08-10-share), members can now see and share clear walk information.");
    expect(articles[0].markdown).not.toContain("\n- ");
    expect(articles[0].buttonText).toBeUndefined();
    expect(articles[0].buttonUrl).toBeUndefined();
    expect(articles[0].position).toBe(ArticleBlockPosition.ABOVE_EVENTS);
  });

  it("adds a selected release-note image to its generated subject", () => {
    const withImage = draft({items: [{
      ...draft().items[0],
      image: {url: "https://example.test/route.png", alt: "Editing a walk route on a phone"}
    }], indexUrl: null});

    const articles = releaseNoteUpdateArticlesFrom(withImage);

    expect(articles[0].image).toEqual({
      src: "https://example.test/route.png",
      alt: "Editing a walk route on a phone",
      alignment: ArticleBlockImageAlignment.FULL
    });
  });

  it("adds a final article pointing at the release-note index", () => {
    const articles = releaseNoteUpdateArticlesFrom(draft());

    expect(articles[articles.length - 1].title).toBe("Read the full notes");
    expect(articles[articles.length - 1].buttonText).toBe("Open the release notes");
    expect(articles[articles.length - 1].buttonUrl).toBe("https://example.test/how-to/committee/release-notes");
  });

  it("adds separate top-level headings when email and non-email features are both present", () => {
    const nonEmailItem = draft().items[0];
    const emailItem = {...nonEmailItem, path: "email", title: "Clearer email", category: ReleaseNoteUpdateCategory.EMAIL};
    const articles = releaseNoteUpdateArticlesFrom(draft({items: [nonEmailItem, emailItem], indexUrl: null}));

    expect(articles.map(article => article.title)).toEqual([
      "Email features",
      "Clearer email",
      "Non-email features",
      "Share a walk more easily"
    ]);
    expect(articles.find(article => article.title === "Non-email features")?.markdown).toBe("Changes to the other features available on your website.");
  });

  it("gives platform management its own top-level heading", () => {
    const nonEmailItem = draft().items[0];
    const platformItem = {...nonEmailItem, path: "platform", title: "Simpler website setup", category: ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT};
    const articles = releaseNoteUpdateArticlesFrom(draft({items: [nonEmailItem, platformItem], indexUrl: null}));

    expect(articles.map(article => article.title)).toEqual([
      "Non-email features",
      "Share a walk more easily",
      "Platform management",
      "Simpler website setup"
    ]);
  });

  it("builds intro, articles and sign-off in that order", () => {
    const order = releaseNoteUpdateFragmentOrder(releaseNoteUpdateArticlesFrom(draft()));

    expect(order.map(fragment => fragment.kind)).toEqual([
      ComposerFragmentKind.INTRO,
      ComposerFragmentKind.ARTICLE,
      ComposerFragmentKind.ARTICLE,
      ComposerFragmentKind.SIGNOFF
    ]);
  });

  it("reads a stored period amount and unit", () => {
    const settings = releaseNoteUpdateSettingsFrom({periodAmount: 3, periodUnit: DateRangeUnit.DAYS});

    expect(settings.periodAmount).toBe(3);
    expect(settings.periodUnit).toBe(DateRangeUnit.DAYS);
  });

  it("maps an older monthly cadence onto one month", () => {
    const settings = releaseNoteUpdateSettingsFrom({cadence: NewsletterCadence.MONTHLY});

    expect(settings.periodAmount).toBe(1);
    expect(settings.periodUnit).toBe(DateRangeUnit.MONTHS);
  });

  it("migrates the former non-email scope to the non-email checkbox", () => {
    const settings = releaseNoteUpdateSettingsFrom({scope: "non-email-only"});

    expect(settings.categories).toEqual([ReleaseNoteUpdateCategory.NON_EMAIL]);
  });

  it("migrates existing single defaults into a named saved configuration", () => {
    const configuration = releaseNoteUpdateConfigurationFrom({categories: [ReleaseNoteUpdateCategory.EMAIL], maximumThemes: 7});

    expect(configuration.defaultProfileId).toBe("default");
    expect(configuration.profiles[0].name).toBe("General update");
    expect(configuration.profiles[0].defaults.categories).toEqual([ReleaseNoteUpdateCategory.EMAIL]);
    expect(configuration.profiles[0].defaults.maximumThemes).toBe(7);
  });

  it("retains several saved configurations with their reporting periods", () => {
    const configuration = releaseNoteUpdateConfigurationFrom({
      defaultProfileId: "email",
      profiles: [
        {id: "email", name: "Email audience", periodAmount: 2, periodUnit: DateRangeUnit.WEEKS, defaults: {categories: [ReleaseNoteUpdateCategory.EMAIL]}},
        {id: "admins", name: "Site administrators", periodAmount: 6, periodUnit: DateRangeUnit.MONTHS, defaults: {categories: [ReleaseNoteUpdateCategory.NON_EMAIL, ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT]}}
      ]
    });

    expect(configuration.defaultProfileId).toBe("email");
    expect(configuration.profiles.map(profile => profile.name)).toEqual(["Email audience", "Site administrators"]);
    expect(configuration.profiles[1].periodAmount).toBe(6);
    expect(configuration.profiles[1].defaults.categories).toEqual([ReleaseNoteUpdateCategory.NON_EMAIL, ReleaseNoteUpdateCategory.PLATFORM_MANAGEMENT]);
  });

  it("replaces the email type's default subject for a generated update", () => {
    expect(releaseNoteUpdateSubject("Newsletter", "Newsletter", "20 July to 20 August 2026"))
      .toBe("What's new in NGX: 20 July to 20 August 2026");
  });

  it("preserves a subject customised by the author", () => {
    expect(releaseNoteUpdateSubject("Committee news", "Newsletter", "20 July to 20 August 2026"))
      .toBe("Committee news");
  });
});
