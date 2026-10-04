import {describe, expect, it, vi} from "vitest";
import {BrandingMode} from "../../models/mail.model";
import {EmailComposer} from "./email-composer";

describe("composer reply paste", () => {
  it("leaves forwarded headers and body for normal insertion without changing the reply envelope", () => {
    const state = {
      brandingMode: BrandingMode.UNBRANDED,
      subject: "Re: Weekend plans",
      introMarkdown: "Existing reply text",
      externalRecipients: [{name: "Alex Reed", email: "alex.reed@example.com"}]
    };
    const context = {
      session: {state, inboxReplyContext: {}},
      subjectStillAutomatic: vi.fn(() => true),
      autoResolveTrackingUrls: vi.fn(() => Promise.resolve())
    };
    const originalState = structuredClone(state);
    const event = {
      text: "**From: Casey Green <casey.green@example.com>**\n**To: Alex Reed <alex.reed@example.com>**\n**Subject: Weekend plans**\n\nThanks for the details.\n\n**From:&#x20;**Jordan Lane <jordan.lane@example.com>\n**Subject:&#x20;**Re: Weekend plans\n\nSee you soon.",
      consume: vi.fn()
    };
    EmailComposer.prototype["onIntroRawPaste"].call(context as unknown as EmailComposer, event);
    expect(event.consume).not.toHaveBeenCalled();
    expect(state).toEqual(originalState);
    expect(context.subjectStillAutomatic).not.toHaveBeenCalled();
    expect(context.autoResolveTrackingUrls).not.toHaveBeenCalled();
  });

  it("still extracts recipients and subject when composing a new message", () => {
    const context = {
      session: {
        state: {
          brandingMode: BrandingMode.UNBRANDED,
          subject: "",
          introMarkdown: "",
          externalRecipients: []
        },
        inboxReplyContext: null
      },
      sender: {nameFromEmail: vi.fn()},
      autoResolveTrackingUrls: vi.fn(() => Promise.resolve()),
      subjectStillAutomatic: vi.fn(() => false)
    };
    const event = {
      text: "From: Casey Green <casey.green@example.com>\nTo: Alex Reed <alex.reed@example.com>\nSubject: Weekend plans\n\nThanks for the details.",
      consume: vi.fn()
    };
    EmailComposer.prototype["onIntroRawPaste"].call(context as unknown as EmailComposer, event);
    expect(event.consume).toHaveBeenCalled();
    expect(context.session.state.subject).toBe("Weekend plans");
    expect(context.session.state.externalRecipients).toEqual([
      {name: "Alex Reed", email: "alex.reed@example.com", saveForReuse: true},
      {name: "Casey Green", email: "casey.green@example.com", saveForReuse: true}
    ]);
    expect(context.session.state.introMarkdown).toContain("Thanks for the details.");
  });

  it("does not use a pasted heading as the reply subject", () => {
    const context = {
      session: {state: {brandingMode: BrandingMode.UNBRANDED, subject: "Re: Weekend plans"}, inboxReplyContext: {}},
      subjectStillAutomatic: vi.fn(() => true)
    };
    const event = {text: "# Forwarded notes\n\nKeep the whole message.", consume: vi.fn()};
    EmailComposer.prototype["onIntroRawPaste"].call(context as unknown as EmailComposer, event);
    expect(context.session.state.subject).toBe("Re: Weekend plans");
    expect(event.consume).not.toHaveBeenCalled();
  });
});
