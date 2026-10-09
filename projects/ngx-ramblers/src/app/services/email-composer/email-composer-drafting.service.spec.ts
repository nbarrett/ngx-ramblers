import { describe, expect, it, vi } from "vitest";
import { BrandingMode, DEFAULT_NEWSLETTER_CADENCE, EmailCompositionKind, NEWSLETTER_CADENCE_OPTIONS, NewsletterCadence, NewsletterStartMode } from "../../models/email-composer.model";
import { DEFAULT_NEWSLETTER_INTRO_DETAIL, NewsletterIntroDetail } from "../../models/ai.model";
import { EmailComposerDraftingService } from "./email-composer-drafting.service";

describe("composer drafting start UI", () => {
  function drafting(overrides: Record<string, unknown> = {}) {
    const state = {
      brandingMode: BrandingMode.BRANDED,
      compositionKind: EmailCompositionKind.STANDARD,
      notificationConfig: {composerDrafting: {offerDraftedIntro: true, onlyApprovedWalks: true}}
    };
    const session = {
      state,
      inboxReplyContext: null as unknown,
      currentDraftId: null as string | null,
      platformAdminEnabled: false,
      newsletterMode: () => state.compositionKind === EmailCompositionKind.NEWSLETTER,
      releaseNoteUpdateMode: () => state.compositionKind === EmailCompositionKind.RELEASE_NOTE_UPDATE
    };
    const instance = Object.create(EmailComposerDraftingService.prototype);
    Object.assign(instance, {
      session,
      events: {selectedGroupEventCount: () => 0},
      newsletterStartMode: NewsletterStartMode.PERIOD,
      newsletterStartPeriod: DEFAULT_NEWSLETTER_CADENCE,
      introDetail: DEFAULT_NEWSLETTER_INTRO_DETAIL,
      newsletterPeriodOptions: NEWSLETTER_CADENCE_OPTIONS.filter(option => option.key !== NewsletterCadence.CUSTOM),
      leaderRequestPeriodReady: false,
      startPeriodFromPreviousApplied: false,
      compositionsService: {previousNewsletter: vi.fn(async () => null)},
      createNewsletter: vi.fn(),
      ...overrides
    });
    return instance as EmailComposerDraftingService & {createNewsletter: ReturnType<typeof vi.fn>};
  }

  it("offers period and free text on a new branded newsletter compose", () => {
    expect(drafting().availableStartModes()).toEqual([
      NewsletterStartMode.PERIOD,
      NewsletterStartMode.FREE_TEXT
    ]);
  });

  it("hides start modes on an inbox reply", () => {
    const instance = drafting();
    instance.session.inboxReplyContext = {threadId: "thread-1"} as any;
    expect(instance.availableStartModes()).toEqual([]);
  });

  it("hides start modes on a saved draft", () => {
    const instance = drafting();
    instance.session.currentDraftId = "draft-1";
    expect(instance.availableStartModes()).toEqual([]);
  });

  it("hides start modes on an unbranded letter", () => {
    const instance = drafting();
    instance.session.state.brandingMode = BrandingMode.UNBRANDED;
    expect(instance.availableStartModes()).toEqual([]);
  });

  it("keeps the period choices after a branded newsletter is created", () => {
    const instance = drafting();
    instance.session.state.compositionKind = EmailCompositionKind.NEWSLETTER;
    expect(instance.availableStartModes()).toEqual([
      NewsletterStartMode.PERIOD,
      NewsletterStartMode.FREE_TEXT
    ]);
  });

  it("offers a platform update on a new branded compose for a platform admin", () => {
    const instance = drafting();
    instance.session.platformAdminEnabled = true;
    expect(instance.availableStartModes()).toEqual([
      NewsletterStartMode.PERIOD,
      NewsletterStartMode.FREE_TEXT,
      NewsletterStartMode.UPDATE
    ]);
  });

  it("does not auto-create a newsletter on a reply or draft", async () => {
    const reply = drafting();
    reply.session.inboxReplyContext = {threadId: "thread-1"} as any;
    await reply.startPeriodEvents();
    expect(reply.createNewsletter).not.toHaveBeenCalled();
    const saved = drafting();
    saved.session.currentDraftId = "draft-1";
    await saved.startPeriodEvents();
    expect(saved.createNewsletter).not.toHaveBeenCalled();
  });

  it("selects events for the period on a new branded newsletter compose", async () => {
    const instance = drafting();
    await instance.startPeriodEvents();
    expect(instance.createNewsletter).toHaveBeenCalled();
  });

  it("still creates a newsletter when events are already selected but the email is not one yet", async () => {
    const instance = drafting({
      events: {selectedGroupEventCount: () => 54}
    });
    await instance.startPeriodEvents();
    expect(instance.createNewsletter).toHaveBeenCalled();
  });

  it("does not recreate a newsletter that already has events", async () => {
    const instance = drafting({
      events: {selectedGroupEventCount: () => 54}
    });
    instance.session.state.compositionKind = EmailCompositionKind.NEWSLETTER;
    await instance.startPeriodEvents();
    expect(instance.createNewsletter).not.toHaveBeenCalled();
  });

  it("offers the intro draft on a branded compose that is not yet a newsletter", () => {
    expect(drafting().introDraftOffered()).toEqual(true);
  });

  it("hides the intro draft when creating a platform update", () => {
    const instance = drafting({platformAdminEnabled: true, newsletterStartMode: NewsletterStartMode.UPDATE});
    instance.session.platformAdminEnabled = true;
    instance.newsletterStartMode = NewsletterStartMode.UPDATE;
    expect(instance.introDraftOffered()).toEqual(false);
  });

  it("defaults the period to the last newsletter cadence", async () => {
    const instance = drafting({
      compositionsService: {previousNewsletter: vi.fn(async () => ({cadence: NewsletterCadence.FORTNIGHTLY}))}
    });
    await instance.startPeriodEvents();
    expect(instance.newsletterStartPeriod).toEqual(NewsletterCadence.FORTNIGHTLY);
    expect(instance.createNewsletter).toHaveBeenCalled();
  });

  it("resets drafting state for a new email", () => {
    const instance = drafting({
      newsletterStartPeriod: NewsletterCadence.PROGRAMME,
      introDetail: NewsletterIntroDetail.MORE,
      newsletterFreeText: "until Christmas",
      previousNewsletter: {id: "old"},
      startPeriodFromPreviousApplied: true,
      lastAppliedNewsletterSubject: "What's coming up"
    });
    instance.resetForNewComposition();
    expect(instance.newsletterStartPeriod).toEqual(DEFAULT_NEWSLETTER_CADENCE);
    expect(instance.introDetail).toEqual(DEFAULT_NEWSLETTER_INTRO_DETAIL);
    expect(instance.newsletterFreeText).toEqual("");
    expect(instance.previousNewsletter).toEqual(null);
    expect(instance.lastAppliedNewsletterSubject).toEqual(null);
  });
});
