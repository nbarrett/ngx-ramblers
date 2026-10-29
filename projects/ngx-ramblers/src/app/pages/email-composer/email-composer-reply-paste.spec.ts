import {describe, expect, it, vi} from "vitest";
import {convertToParamMap} from "@angular/router";
import {StoredValue} from "../../models/ui-actions";
import {BrandingMode} from "../../models/mail.model";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {ComposerFragmentKind, EmailComposerState, RecipientMode, RecipientAddressMode} from "../../models/email-composer.model";
import {EmailComposerRecipientsService} from "../../services/email-composer/email-composer-recipients.service";
import {EmailComposerFragmentsService} from "../../services/email-composer/email-composer-fragments.service";
import {EmailComposer} from "./email-composer";

describe("composer reply paste", () => {
  function recipientReset(state: Partial<EmailComposerState>) {
    return {
      clearRecipientSelection: vi.fn(() => EmailComposerRecipientsService.prototype.clearRecipientSelection.call({
        session: {state, syncStateToUrl: vi.fn()},
        expandedRecipientListIds: new Set(), expandedRecipientFilterKeys: new Set(),
        pool: {recomputeCandidateMembers: vi.fn()},
        setRecipientMode: (mode: RecipientMode) => state.recipientMode = mode
      } as unknown as EmailComposerRecipientsService))
    };
  }

  it("leaves forwarded headers and body for normal insertion without changing the reply envelope", () => {
    const state = {
      brandingMode: BrandingMode.UNBRANDED,
      subject: "Re: Weekend plans",
      introMarkdown: "Existing reply text",
      externalRecipients: [{name: "Alex Reed", email: "alex.reed@example.com"}]
    };
    const context = {
      changeDetector: {detectChanges: vi.fn()},
      session: {state, inboxReplyContext: {}},
      subjectStillAutomatic: vi.fn(() => true),
      autoResolveTrackingUrls: vi.fn(() => Promise.resolve())
    };
    const originalState = structuredClone(state);
    const event = {
      text: "**From: Casey Green <casey.green@example.com>**\n**To: Alex Reed <alex.reed@example.com>**\n**Subject: Weekend plans**\n\nThanks for the details.\n\n**From:&#x20;**Jordan Lane <jordan.lane@example.com>\n**Subject:&#x20;**Re: Weekend plans\n\nSee you soon.",
      confirmed: true,
      consume: vi.fn()
    };
    EmailComposer.prototype["onIntroRawPaste"].call(context as unknown as EmailComposer, event);
    expect(event.consume).not.toHaveBeenCalled();
    expect(state).toEqual(originalState);
    expect(context.subjectStillAutomatic).not.toHaveBeenCalled();
    expect(context.autoResolveTrackingUrls).not.toHaveBeenCalled();
  });

  it("does not extract a title or headers until the user confirms", () => {
    const state = {brandingMode: BrandingMode.UNBRANDED, subject: "", introMarkdown: "", externalRecipients: [], ccRecipients: []};
    const context = {
      changeDetector: {detectChanges: vi.fn()},session: {state, inboxReplyContext: null}};
    const original = structuredClone(state);
    const event = {text: "To: Alex Reed <alex.reed@example.com>\nSubject: Proposed subject\n\nBody text", consume: vi.fn()};
    EmailComposer.prototype["onIntroRawPaste"].call(context as unknown as EmailComposer, event);
    expect(state).toEqual(original);
    expect(event.consume).not.toHaveBeenCalled();
  });

  it("still extracts recipients and subject when composing a new message", () => {
    const introEditor = {
      unwrapIfEnabled: vi.fn((text: string) => text),
      syncValue: vi.fn(),
      focusAtStart: vi.fn(),
      focusAtEnd: vi.fn()
    };
    const context = {
      changeDetector: {detectChanges: vi.fn()},
      session: {
        state: {
          brandingMode: BrandingMode.UNBRANDED,
          subject: "",
          introMarkdown: "",
          externalRecipients: [],
          ccRecipients: []
        },
        inboxReplyContext: null
      },
      sender: {nameFromEmail: vi.fn()},
      autoResolveTrackingUrls: vi.fn(() => Promise.resolve()),
      subjectStillAutomatic: vi.fn(() => false)
    };
    Object.assign(context, {recipients: recipientReset(context.session.state)});
    Object.defineProperty(context, "introEditor", {get: () => introEditor});
    const event = {
      text: "From: Casey Green <casey.green@example.com>\nTo: Alex Reed <alex.reed@example.com>\nSubject: Weekend plans\n\nThanks for the details.",
      confirmed: true,
      consume: vi.fn()
    };
    EmailComposer.prototype["onIntroRawPaste"].call(context as unknown as EmailComposer, event);
    expect(event.consume).toHaveBeenCalled();
    expect(context.session.state.subject).toBe("Weekend plans");
    expect(context.session.state.externalRecipients).toEqual([
      {name: "Alex Reed", email: "alex.reed@example.com", saveForReuse: true}
    ]);
    expect(context.session.state.ccRecipients).toEqual([]);
    expect(context.session.state.introMarkdown).toContain("Thanks for the details.");
    expect(introEditor.syncValue).toHaveBeenCalledWith(context.session.state.introMarkdown);
  });

  it("writes a pasted Outlook message into the focused compose editor", () => {
    const introEditor = {
      unwrapIfEnabled: vi.fn((text: string) => text),
      syncValue: vi.fn(),
      focusAtStart: vi.fn(),
      focusAtEnd: vi.fn()
    };
    const context = {
      changeDetector: {detectChanges: vi.fn()},
      session: {
        state: {
          brandingMode: BrandingMode.UNBRANDED,
          subject: "",
          introMarkdown: "",
          externalRecipients: [],
          ccRecipients: []
        },
        inboxReplyContext: null
      },
      sender: {nameFromEmail: vi.fn()},
      autoResolveTrackingUrls: vi.fn(() => Promise.resolve()),
      subjectStillAutomatic: vi.fn(() => false)
    };
    Object.assign(context, {recipients: recipientReset(context.session.state)});
    Object.defineProperty(context, "introEditor", {get: () => introEditor});
    const event = {
      text: [
        "From: Alex Reed <alex.reed@example.com>",
        "Date: Thursday, 22 October 2026 at 15:35",
        "To: Casey Green <casey.green@example.com>",
        "Cc: Jordan Lane <jordan.lane@example.com>",
        "Subject: Re: Would you help me test the walking app?",
        "",
        "Dear Casey,",
        "",
        "Thank you for asking. Please contact Jordan instead.",
        "",
        "Alex"
      ].join("\n"),
      confirmed: true,
      consume: vi.fn()
    };
    EmailComposer.prototype["onIntroRawPaste"].call(context as unknown as EmailComposer, event);
    expect(event.consume).toHaveBeenCalled();
    expect(context.session.state.subject).toBe("Re: Would you help me test the walking app?");
    expect(context.session.state.externalRecipients).toEqual([
      {name: "Casey Green", email: "casey.green@example.com", saveForReuse: true}
    ]);
    expect(context.session.state.ccRecipients).toEqual([
      {name: "Jordan Lane", email: "jordan.lane@example.com", saveForReuse: true}
    ]);
    expect(context.session.state.introMarkdown).toContain("Dear Casey,");
    expect(context.session.state.introMarkdown).toContain("Please contact Jordan instead.");
    expect(introEditor.syncValue).toHaveBeenCalledWith(context.session.state.introMarkdown);
  });

  it.each([
    {paste: "# Private planning note\n\nAudience: Alex. Status: DRAFT, not sent.\n\nComposer draft (not sent): https://group.example.org.uk/admin/email-composer\n\nFrom: Chair <chair@group.example.org.uk>\n\nTo: Alex Reed <alex.reed@example.com>\nCc: Casey Green <casey.green@example.com>\nSubject: Actual subject\n\n---\n\nHi Alex,\n\n- **Please review** [the guide](https://group.example.org.uk/guide)", subject: "Actual subject", toCount: 1},
    {paste: "To: Alex Reed <alex.reed@example.com>\nCc: Alex Reed <alex.reed@example.com>\n\n# Actual subject\n\n---\n\nHi Alex,\n\n- **Please review** [the guide](https://group.example.org.uk/guide)", subject: "Actual subject", toCount: 1},
    {paste: "**Subject: Actual subject**\n\nHi Alex,\n\n- **Please review** [the guide](https://group.example.org.uk/guide)", subject: "Actual subject", toCount: 0},
    {paste: "# Private planning note\n\nStatus: DRAFT, not sent.\n\nBackground notes about this draft.\n\nTo: Alex Reed\nCc: Casey Green\nSubject: Actual subject\n\n---\n\nHi Alex,\n\n- **Please review** [the guide](https://group.example.org.uk/guide)", subject: "Actual subject", toCount: 0}
  ])("replaces a bulk audience and imports the actual draft envelope: $paste", ({paste, subject, toCount}) => {
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.selectedListId = 42;
    state.narrowListId = 43;
    state.selectedMemberIds = ["old-member"];
    state.externalRecipients = [{email: "old-list@example.com", listId: 42}];
    state.bccRecipients = [{email: "old-bcc@example.com"}];
    const warning = vi.fn();
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      session: {state, inboxReplyContext: null, notify: {warning}},
      recipients: recipientReset(state),
      changeDetector: {detectChanges: vi.fn()}, sender: {nameFromEmail: vi.fn()}
    });
    const syncValue = vi.fn();
    Object.defineProperty(instance, "introEditor", {get: () => ({syncValue, focusAtEnd: vi.fn()})});
    instance.onIntroRawPaste({text: paste, confirmed: true, consume: vi.fn()});
    expect(state.subject).toBe(subject);
    expect(state.recipientMode).toBe(RecipientMode.SELECTED_MEMBERS);
    expect(state.selectedListId).toBeNull();
    expect(state.narrowListId).toBeNull();
    expect(state.selectedMemberIds).toEqual([]);
    expect(state.externalRecipients).toHaveLength(toCount);
    expect(state.bccRecipients).toEqual([]);
    expect(state.introMarkdown).toContain("- **Please review** [the guide](https://group.example.org.uk/guide)");
    expect(state.introMarkdown).not.toContain("Private planning note");
    expect(syncValue).toHaveBeenCalledWith(state.introMarkdown);
    if (paste.includes("To: Alex Reed\n")) {
      expect(warning).toHaveBeenCalledOnce();
    }
  });

  it("keeps the chosen audience when a formatted document has no email headers", () => {
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.selectedListId = 42;
    state.externalRecipients = [{email: "list@example.com", listId: 42}];
    const instance = Object.create(EmailComposer.prototype);
    const recipients = recipientReset(state);
    Object.assign(instance, {session: {state, inboxReplyContext: null}, recipients, changeDetector: {detectChanges: vi.fn()}});
    instance.onIntroRawPaste({text: "Please read [the guide](https://group.example.org.uk/guide).", confirmed: true, consume: vi.fn()});
    expect(recipients.clearRecipientSelection).not.toHaveBeenCalled();
    expect(state.selectedListId).toBe(42);
    expect(state.recipientMode).toBe(RecipientMode.ENTIRE_LIST);
  });

  it("does not use a pasted heading as the reply subject", () => {
    const context = {
      changeDetector: {detectChanges: vi.fn()},
      session: {state: {brandingMode: BrandingMode.UNBRANDED, subject: "Re: Weekend plans"}, inboxReplyContext: {}},
      subjectStillAutomatic: vi.fn(() => true)
    };
    const event = {text: "# Forwarded notes\n\nKeep the whole message.", confirmed: true,
      consume: vi.fn()};
    EmailComposer.prototype["onIntroRawPaste"].call(context as unknown as EmailComposer, event);
    expect(context.session.state.subject).toBe("Re: Weekend plans");
    expect(event.consume).not.toHaveBeenCalled();
  });
});

describe("composer reply recipients", () => {
  const correspondent = {name: "Morgan Lane", email: "morgan@example.com"};
  const copyRecipient = {name: "Casey Green", email: "casey.green@example.com"};

  function composer() {
    const instance = Object.create(EmailComposer.prototype);
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.selectedMemberIds = ["unrelated-member"];
    state.selectedListId = 17;
    state.narrowListId = 18;
    state.externalRecipients = [{email: "previous@example.com"}];
    state.ccRecipients = [{email: "previous-cc@example.com"}];
    state.bccRecipients = [{email: "previous-bcc@example.com"}];
    Object.assign(instance, {
      session: {state, inboxReplyContext: null},
      recipients: {replyCcSuggestion: [], recipientAddressModeTouched: false, syncRecipientAddressMode: vi.fn()},
      logger: {info: vi.fn()},
      htmlToReplyMarkdown: vi.fn(() => "Quoted message"),
      applyForwardedAttachments: vi.fn(),
      introEditorRef: null,
      fragmentEditor: Object.assign(Object.create(EmailComposerFragmentsService.prototype), {expandedFragmentIds: new Set<string>()}),
      changeDetector: {markForCheck: vi.fn()},
      inboxReplyLoading: false,
      pendingDraftLoad: false,
      mailMessagingReady: true,
      membersLoaded: false,
      route: {snapshot: {queryParamMap: convertToParamMap({})}}
    });
    return instance;
  }

  function reply() {
    return {to: correspondent, cc: [copyRecipient], subject: "Re: Weekend plans", quotedHtml: "<p>Original message</p>", inboxMessageId: "message-1", threadId: "thread-1", attachments: []};
  }

  it("replaces previous recipients and offers Cc separately for a reply", () => {
    const instance = composer();
    instance.applyInboxReply(reply());
    expect(instance.session.state.fragmentOrder.some((fragment: {kind: ComposerFragmentKind}) => fragment.kind === ComposerFragmentKind.INTRO)).toBe(true);
    expect(instance.fragmentEditor.expandedFragmentIds.has("intro")).toBe(true);
    expect(instance.session.state.introMarkdown).toContain("Quoted message");
    expect(instance.session.state.externalRecipients).toEqual([{...correspondent, saveForReuse: false}]);
    expect(instance.session.state.recipientAddressMode).toBe(RecipientAddressMode.PERSONAL);
    expect(instance.recipients.recipientAddressModeTouched).toBe(true);
    expect(instance.session.state.selectedMemberIds).toEqual([]);
    expect(instance.session.state.selectedListId).toBe(null);
    expect(instance.session.state.narrowListId).toBe(null);
    expect(instance.session.state.ccRecipients).toEqual([]);
    expect(instance.session.state.bccRecipients).toEqual([]);
    expect(instance.recipients.replyCcSuggestion).toEqual([{...copyRecipient, saveForReuse: false}]);
  });

  it("uses only the selected message Cc recipients for Reply all", () => {
    const instance = composer();
    instance.applyInboxReply({...reply(), replyAll: true});
    expect(instance.session.state.ccRecipients).toEqual([{...copyRecipient, saveForReuse: false}]);
    expect(instance.session.state.bccRecipients).toEqual([]);
    expect(instance.recipients.replyCcSuggestion).toEqual([]);
  });

  it("starts a forward without any recipients from the earlier composition", () => {
    const instance = composer();
    instance.applyInboxReply({...reply(), forward: true});
    expect(instance.session.state.externalRecipients).toEqual([]);
    expect(instance.session.state.ccRecipients).toEqual([]);
    expect(instance.session.state.bccRecipients).toEqual([]);
    expect(instance.session.state.selectedMemberIds).toEqual([]);
    expect(instance.recipients.replyCcSuggestion).toEqual([]);
    expect(instance.applyForwardedAttachments).toHaveBeenCalledWith([]);
  });

  it("opens compose for an inbox reply before the member list has loaded", () => {
    const instance = composer();
    instance.applyInboxReply(reply());
    expect(instance.composerHydrating()).toBe(false);
  });

  it("still waits for members when this is not an inbox reply", () => {
    const instance = composer();
    expect(instance.composerHydrating()).toBe(true);
  });
});

describe("rebuilding an inbox reply from its link", () => {
  function composer() {
    const instance = Object.create(EmailComposer.prototype);
    Object.assign(instance, {
      session: {inboxReplyContext: null},
      inboxService: {
        getThread: vi.fn().mockResolvedValue({thread: {id: "inbound-thread"}, messages: [{threadId: "inbound-thread", messageId: "original-message", receivedAt: 1}, {threadId: "inbound-thread", messageId: "later-reply", receivedAt: 2}]}),
        composeReply: vi.fn().mockResolvedValue({threadId: "inbound-thread"})
      },
      applyInboxReply: vi.fn(),
      logger: {error: vi.fn()}
    });
    return instance;
  }

  it("restores the original selected message even when a newer reply exists", async () => {
    const instance = composer();
    await instance.rebuildInboxReplyFromRoute(convertToParamMap({[StoredValue.THREAD]: "inbound-thread", [StoredValue.MESSAGE]: "original-message"}));
    expect(instance.inboxService.composeReply).toHaveBeenCalledWith("inbound-thread", {threadId: "inbound-thread", messageId: "original-message", forward: false});
    expect(instance.applyInboxReply).toHaveBeenCalled();
    expect(instance.inboxService.getThread).not.toHaveBeenCalled();
  });

  it("passes the selected Message-ID to the reply endpoint for normalisation", async () => {
    const instance = composer();
    instance.inboxService.getThread.mockResolvedValue({
      thread: {id: "inbound-thread"},
      messages: [{threadId: "inbound-thread", messageId: "abc@mail.example.com"}]
    });
    await instance.rebuildInboxReplyFromRoute(convertToParamMap({[StoredValue.THREAD]: "inbound-thread", [StoredValue.MESSAGE]: "<abc@mail.example.com>"}));
    expect(instance.inboxService.composeReply).toHaveBeenCalledWith("inbound-thread", {threadId: "inbound-thread", messageId: "<abc@mail.example.com>", forward: false});
    expect(instance.applyInboxReply).toHaveBeenCalled();
  });

  it("prepares a selected forward without loading the whole conversation", async () => {
    const instance = composer();
    await instance.rebuildInboxReplyFromRoute(convertToParamMap({[StoredValue.THREAD]: "inbound-thread", [StoredValue.MESSAGE]: "original-message", [StoredValue.FORWARD]: "true"}));
    expect(instance.inboxService.getThread).not.toHaveBeenCalled();
    expect(instance.inboxService.composeReply).toHaveBeenCalledWith("inbound-thread", {threadId: "inbound-thread", messageId: "original-message", forward: true});
    expect(instance.applyInboxReply).toHaveBeenCalledWith(expect.objectContaining({forward: true}), true);
  });

  it("loads messages when an older link does not identify the message", async () => {
    const instance = composer();
    await instance.rebuildInboxReplyFromRoute(convertToParamMap({[StoredValue.THREAD]: "inbound-thread"}));
    expect(instance.inboxService.getThread).toHaveBeenCalledWith("inbound-thread");
    expect(instance.inboxService.composeReply).toHaveBeenCalledWith("inbound-thread", {threadId: "inbound-thread", messageId: "later-reply", forward: false});
  });

  it("does not silently replace a missing selected message with a newer reply", async () => {
    const instance = composer();
    instance.inboxService.composeReply.mockRejectedValue(new Error("No message found on this thread"));
    await instance.rebuildInboxReplyFromRoute(convertToParamMap({[StoredValue.THREAD]: "inbound-thread", [StoredValue.MESSAGE]: "missing-message"}));
    expect(instance.inboxService.composeReply).toHaveBeenCalledWith("inbound-thread", {threadId: "inbound-thread", messageId: "missing-message", forward: false});
    expect(instance.applyInboxReply).not.toHaveBeenCalled();
    expect(instance.inboxReplyLoading).toBe(false);
  });
});
