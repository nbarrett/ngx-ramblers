import expect from "expect";
import { describe, it } from "mocha";
import {
  InboxAddress,
  InboxMessage,
  InboxMessageDirection,
  InboxReaderProvider,
  InboxThreadFolder
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { autoReplyFromHeaders, isOwnSentCopy, outboundCopyFromInbound, resolveThreadExternalAddress, shouldRefreshUnreadForInbound, unreadAfterReclassify } from "./inbox-message-import";

function address(email: string, name: string | null = null): InboxAddress {
  return {email, name};
}

function message(overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: "id-1",
    threadId: "thread",
    mailboxConnectionId: "conn-1",
    messageId: "msg-1",
    inReplyTo: null,
    references: [],
    conversationKey: null,
    from: address("external@example.com", "External"),
    to: [address("walks@ekwg.co.uk")],
    cc: [],
    subject: "Hello",
    bodyText: "Hi",
    bodyHtml: null,
    attachments: [],
    receivedAt: 1,
    sentAt: null,
    direction: InboxMessageDirection.INBOUND,
    externalSource: InboxReaderProvider.GMAIL_API,
    externalId: "ext-1",
    ...overrides
  };
}

describe("resolveThreadExternalAddress", () => {
  const internalEmails = new Set(["walks@ekwg.co.uk", "eastkentwalkinggroup@gmail.com"]);

  it("uses external From for normal inbound mail", () => {
    const result = resolveThreadExternalAddress(message(), undefined, internalEmails);
    expect(result.email).toEqual("external@example.com");
  });

  it("uses explicit counterparty when provided", () => {
    const result = resolveThreadExternalAddress(
      message(),
      address("someone@example.com", "Someone"),
      internalEmails
    );
    expect(result.email).toEqual("someone@example.com");
  });

  it("picks first external To when From is an internal address", () => {
    const result = resolveThreadExternalAddress(message({
      from: address("eastkentwalkinggroup@gmail.com", "EKWG Gmail"),
      to: [address("walker@example.com", "Walker"), address("walks@ekwg.co.uk")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("walker@example.com");
    expect(result.name).toEqual("Walker");
  });

  it("uses Reply-To when an inbound contact-us email states the enquirer", () => {
    const result = resolveThreadExternalAddress(message({
      from: address("walks@ekwg.co.uk", "Contact Us"),
      replyTo: address("enquirer@example.com", "Enquirer"),
      to: [address("walks@ekwg.co.uk")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("enquirer@example.com");
    expect(result.name).toEqual("Enquirer");
  });

  it("ignores Reply-To on outbound mail", () => {
    const result = resolveThreadExternalAddress(message({
      direction: InboxMessageDirection.OUTBOUND,
      from: address("walks@ekwg.co.uk", "Walks"),
      replyTo: address("walks@ekwg.co.uk", "Walks"),
      to: [address("walker@example.com", "Walker")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("walker@example.com");
  });

  it("uses outbound To even when the recipient is also an internal identity", () => {
    const result = resolveThreadExternalAddress(message({
      direction: InboxMessageDirection.OUTBOUND,
      from: address("walks@ekwg.co.uk", "Walks"),
      to: [address("eastkentwalkinggroup@gmail.com", "Nick Barrett")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("eastkentwalkinggroup@gmail.com");
    expect(result.name).toEqual("Nick Barrett");
  });

  it("does not use the outbound From as counterparty when To is present", () => {
    const result = resolveThreadExternalAddress(message({
      direction: InboxMessageDirection.OUTBOUND,
      from: address("walks@ekwg.co.uk", "Walks"),
      to: [address("walker@example.com", "Walker")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("walker@example.com");
  });

  it("prefers internal To over internal From for group mail to a committee member", () => {
    const result = resolveThreadExternalAddress(message({
      from: address("membership@ekwg.co.uk", "Membership"),
      to: [address("nick.barrett@ekwg.co.uk", "Nick Barrett")]
    }), undefined, new Set(["membership@ekwg.co.uk", "nick.barrett@ekwg.co.uk", "chairman@ekwg.co.uk"]));
    expect(result.email).toEqual("nick.barrett@ekwg.co.uk");
    expect(result.name).toEqual("Nick Barrett");
  });

  it("falls back to internal From when there is no To address", () => {
    const result = resolveThreadExternalAddress(message({
      from: address("eastkentwalkinggroup@gmail.com"),
      to: []
    }), undefined, internalEmails);
    expect(result.email).toEqual("eastkentwalkinggroup@gmail.com");
  });

  it("uses a placeholder when no addresses are present", () => {
    const result = resolveThreadExternalAddress(message({
      from: address(""),
      to: []
    }), undefined, internalEmails);
    expect(result.email).toEqual("unknown@local");
  });
});

describe("autoReplyFromHeaders", () => {
  const headers = (values: Record<string, string>) => (name: string) => values[name] ?? null;

  it("detects an out of office from its Auto-Submitted header", () => {
    expect(autoReplyFromHeaders(headers({"auto-submitted": "auto-replied"}), "Website Enquiry")).toBe(true);
  });

  it("detects an out of office from its subject", () => {
    expect(autoReplyFromHeaders(headers({}), "Automatic reply: Website Enquiry")).toBe(true);
  });

  it("treats Auto-Submitted: no as an ordinary message", () => {
    expect(autoReplyFromHeaders(headers({"auto-submitted": "no"}), "Website Enquiry")).toBe(false);
  });

  it("treats mail from a person as an ordinary message", () => {
    expect(autoReplyFromHeaders(headers({precedence: "list"}), "Re: Website Enquiry")).toBe(false);
  });
});

describe("shouldRefreshUnreadForInbound", () => {
  it("does not refresh unread for junk", () => {
    expect(shouldRefreshUnreadForInbound(true, 200, 100)).toBe(false);
  });

  it("refreshes unread when the thread has no previous lastSeenAt", () => {
    expect(shouldRefreshUnreadForInbound(false, 100, null)).toBe(true);
    expect(shouldRefreshUnreadForInbound(false, 100, undefined)).toBe(true);
  });

  it("refreshes unread only when the inbound message is newer than the thread", () => {
    expect(shouldRefreshUnreadForInbound(false, 200, 100)).toBe(true);
    expect(shouldRefreshUnreadForInbound(false, 100, 100)).toBe(false);
    expect(shouldRefreshUnreadForInbound(false, 50, 100)).toBe(false);
  });
});

describe("unreadAfterReclassify", () => {
  it("preserves read state when a member has already read the thread", () => {
    expect(unreadAfterReclassify(InboxThreadFolder.INBOX, InboxMessageDirection.INBOUND, ["member-1"])).toBe(false);
  });

  it("marks an unread inbound thread with no readers as unread", () => {
    expect(unreadAfterReclassify(InboxThreadFolder.INBOX, InboxMessageDirection.INBOUND, [])).toBe(true);
    expect(unreadAfterReclassify(InboxThreadFolder.INBOX, InboxMessageDirection.INBOUND, undefined)).toBe(true);
  });

  it("never marks an outbound thread unread", () => {
    expect(unreadAfterReclassify(InboxThreadFolder.INBOX, InboxMessageDirection.OUTBOUND, [])).toBe(false);
  });

  it("never marks a junk thread unread", () => {
    expect(unreadAfterReclassify(InboxThreadFolder.JUNK, InboxMessageDirection.INBOUND, [])).toBe(false);
  });
});

describe("isOwnSentCopy", () => {
  const internalEmails = new Set([
    "membership@canterburyramblers.org.uk",
    "chairman@canterburyramblers.org.uk"
  ]);

  it("treats a BCC copy of a welcome email as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("membership@canterburyramblers.org.uk", "Nick Barrett"),
      to: [
        address("kirstywilliamson2025@gmail.com", "Kirsty Williamson"),
        address("chairman@canterburyramblers.org.uk")
      ]
    }), internalEmails)).toBe(true);
  });

  it("does not treat a Contact Us enquiry as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("contact-us@canterburyramblers.org.uk", "Contact Us"),
      replyTo: address("enquirer@example.com", "Enquirer"),
      to: [address("contact-us@canterburyramblers.org.uk")]
    }), internalEmails)).toBe(false);
  });

  it("does not treat a same-domain copy with no outside recipient as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("chairman@canterburyramblers.org.uk", "David Reekie"),
      to: [address("system@canterburyramblers.org.uk")]
    }), internalEmails)).toBe(false);
  });

  it("does not treat mail from a member as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("kirstywilliamson2025@gmail.com", "Kirsty Williamson"),
      to: [address("chairman@canterburyramblers.org.uk")]
    }), internalEmails)).toBe(false);
  });

  it("does not treat an automatic reply from a role address as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("membership@canterburyramblers.org.uk"),
      to: [address("kirstywilliamson2025@gmail.com")],
      autoReply: true,
      subject: "Automatic reply: Welcome"
    }), internalEmails)).toBe(false);
  });

  it("does not classify without a set of internal addresses", () => {
    expect(isOwnSentCopy(message({
      from: address("membership@canterburyramblers.org.uk"),
      to: [address("kirstywilliamson2025@gmail.com")]
    }))).toBe(false);
  });
});

describe("outboundCopyFromInbound", () => {
  const internalEmails = new Set([
    "membership@canterburyramblers.org.uk",
    "chairman@canterburyramblers.org.uk"
  ]);

  it("keeps only the outside recipient and records the message as sent", () => {
    const outbound = outboundCopyFromInbound(message({
      from: address("membership@canterburyramblers.org.uk", "Nick Barrett"),
      to: [
        address("kirstywilliamson2025@gmail.com", "Kirsty Williamson"),
        address("chairman@canterburyramblers.org.uk")
      ],
      receivedAt: 1786269442000,
      sentAt: null
    }), internalEmails);
    expect(outbound.direction).toEqual(InboxMessageDirection.OUTBOUND);
    expect(outbound.to).toEqual([address("kirstywilliamson2025@gmail.com", "Kirsty Williamson")]);
    expect(outbound.cc).toEqual([]);
    expect(outbound.sentAt).toEqual(1786269442000);
    expect(outbound.receivedAt).toBeNull();
  });
});
