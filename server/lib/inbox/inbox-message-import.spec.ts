import expect from "expect";
import { describe, it } from "mocha";
import {
  InboxAddress,
  InboxMessage,
  InboxMessageDirection,
  InboxReaderProvider,
  InboxThreadFolder
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { autoReplyFromHeaders, folderAfterOwnSentReclassify, isOwnSentCopy, outboundCopyFromInbound, replyTargetExcludingViewer, resolveThreadExternalAddress, shouldRefreshUnreadForInbound, unreadAfterReclassify } from "./inbox-message-import";

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
    to: [address("walks@example.co.uk")],
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
  const internalEmails = new Set(["walks@example.co.uk", "group.inbox@provider.example"]);

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
      from: address("group.inbox@provider.example", "Group Inbox"),
      to: [address("walker@example.com", "Walker"), address("walks@example.co.uk")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("walker@example.com");
    expect(result.name).toEqual("Walker");
  });

  it("uses Reply-To when an inbound contact-us email states the enquirer", () => {
    const result = resolveThreadExternalAddress(message({
      from: address("walks@example.co.uk", "Contact Us"),
      replyTo: address("enquirer@example.com", "Enquirer"),
      to: [address("walks@example.co.uk")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("enquirer@example.com");
    expect(result.name).toEqual("Enquirer");
  });

  it("ignores Reply-To on outbound mail", () => {
    const result = resolveThreadExternalAddress(message({
      direction: InboxMessageDirection.OUTBOUND,
      from: address("walks@example.co.uk", "Walks"),
      replyTo: address("walks@example.co.uk", "Walks"),
      to: [address("walker@example.com", "Walker")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("walker@example.com");
  });

  it("uses outbound To even when the recipient is also an internal identity", () => {
    const result = resolveThreadExternalAddress(message({
      direction: InboxMessageDirection.OUTBOUND,
      from: address("walks@example.co.uk", "Walks"),
      to: [address("group.inbox@provider.example", "Internal Member")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("group.inbox@provider.example");
    expect(result.name).toEqual("Internal Member");
  });

  it("does not use the outbound From as counterparty when To is present", () => {
    const result = resolveThreadExternalAddress(message({
      direction: InboxMessageDirection.OUTBOUND,
      from: address("walks@example.co.uk", "Walks"),
      to: [address("walker@example.com", "Walker")]
    }), undefined, internalEmails);
    expect(result.email).toEqual("walker@example.com");
  });

  it("prefers internal To over internal From for group mail to a committee member", () => {
    const result = resolveThreadExternalAddress(message({
      from: address("membership@example.co.uk", "Membership"),
      to: [address("member.one@example.co.uk", "Internal Member")]
    }), undefined, new Set(["membership@example.co.uk", "member.one@example.co.uk", "chairman@example.co.uk"]));
    expect(result.email).toEqual("member.one@example.co.uk");
    expect(result.name).toEqual("Internal Member");
  });

  it("falls back to internal From when there is no To address", () => {
    const result = resolveThreadExternalAddress(message({
      from: address("group.inbox@provider.example"),
      to: []
    }), undefined, internalEmails);
    expect(result.email).toEqual("group.inbox@provider.example");
  });

  it("uses a placeholder when no addresses are present", () => {
    const result = resolveThreadExternalAddress(message({
      from: address(""),
      to: []
    }), undefined, internalEmails);
    expect(result.email).toEqual("unknown@local");
  });
});

describe("replyTargetExcludingViewer", () => {

  it("falls back to the message sender when the resolved candidate is the viewer's own address", () => {
    const result = replyTargetExcludingViewer(
      address("viewer@group.example", "Viewing Member"),
      address("sender@group.example", "Message Sender"),
      "viewer@group.example"
    );
    expect(result.email).toEqual("sender@group.example");
    expect(result.name).toEqual("Message Sender");
  });

  it("leaves a genuine external candidate untouched", () => {
    const result = replyTargetExcludingViewer(
      address("member@example.com", "A Member"),
      address("sender@group.example", "Message Sender"),
      "viewer@group.example"
    );
    expect(result.email).toEqual("member@example.com");
  });

  it("keeps the candidate when the sender is also the viewer, since there is no better option", () => {
    const result = replyTargetExcludingViewer(
      address("viewer@group.example", "Viewing Member"),
      address("viewer@group.example", "Viewing Member"),
      "viewer@group.example"
    );
    expect(result.email).toEqual("viewer@group.example");
  });

  it("leaves the candidate untouched when no viewer email is known", () => {
    const result = replyTargetExcludingViewer(
      address("viewer@group.example", "Viewing Member"),
      address("sender@group.example", "Message Sender"),
      null
    );
    expect(result.email).toEqual("viewer@group.example");
  });

  it("matches regardless of address case", () => {
    const result = replyTargetExcludingViewer(
      address("Viewer@Group.Example", "Viewing Member"),
      address("sender@group.example", "Message Sender"),
      "viewer@group.example"
    );
    expect(result.email).toEqual("sender@group.example");
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

describe("folderAfterOwnSentReclassify", () => {
  it("moves an outbound-only Inbox thread to Sent", () => {
    expect(folderAfterOwnSentReclassify(InboxThreadFolder.INBOX, InboxMessageDirection.OUTBOUND, false))
      .toEqual(InboxThreadFolder.SENT);
    expect(folderAfterOwnSentReclassify(undefined, InboxMessageDirection.OUTBOUND, false))
      .toEqual(InboxThreadFolder.SENT);
  });

  it("keeps conversations with inbound mail in Inbox", () => {
    expect(folderAfterOwnSentReclassify(InboxThreadFolder.INBOX, InboxMessageDirection.OUTBOUND, true))
      .toEqual(InboxThreadFolder.INBOX);
  });

  it("does not move deleted or junk threads", () => {
    expect(folderAfterOwnSentReclassify(InboxThreadFolder.DELETED, InboxMessageDirection.OUTBOUND, false))
      .toEqual(InboxThreadFolder.DELETED);
    expect(folderAfterOwnSentReclassify(InboxThreadFolder.JUNK, InboxMessageDirection.OUTBOUND, false))
      .toEqual(InboxThreadFolder.JUNK);
  });
});

describe("isOwnSentCopy", () => {
  const internalEmails = new Set([
    "membership@other.example.org.uk",
    "chairman@other.example.org.uk"
  ]);

  it("treats a BCC copy of a welcome email as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("membership@other.example.org.uk", "Internal Member"),
      to: [
        address("new.member@provider.example", "New Member"),
        address("chairman@other.example.org.uk")
      ]
    }), internalEmails)).toBe(true);
  });

  it("does not treat a Contact Us enquiry as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("contact-us@other.example.org.uk", "Contact Us"),
      replyTo: address("enquirer@example.com", "Enquirer"),
      to: [address("contact-us@other.example.org.uk")]
    }), internalEmails)).toBe(false);
  });

  it("does not treat a same-domain copy with no outside recipient as mail we sent", () => {
    const allInternalEmails = new Set([...internalEmails, "system@other.example.org.uk"]);
    expect(isOwnSentCopy(message({
      from: address("chairman@other.example.org.uk", "Committee Member"),
      to: [address("system@other.example.org.uk")]
    }), allInternalEmails)).toBe(false);
  });

  it("does not treat mail from a member as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("external.member@provider.example", "External Member"),
      to: [address("chairman@other.example.org.uk")]
    }), internalEmails)).toBe(false);
  });

  it("does not treat an external sender sharing an internal provider domain as mail we sent", () => {
    const providerEmails = new Set([
      "internal.sender@shared-provider.example",
      "role@group.example"
    ]);
    expect(isOwnSentCopy(message({
      from: address("external.sender@shared-provider.example", "External Sender"),
      to: [address("role@group.example", "Role Recipient")]
    }), providerEmails)).toBe(false);
  });

  it("does not treat an automatic reply from a role address as mail we sent", () => {
    expect(isOwnSentCopy(message({
      from: address("membership@other.example.org.uk"),
      to: [address("external.member@provider.example")],
      autoReply: true,
      subject: "Automatic reply: Welcome"
    }), internalEmails)).toBe(false);
  });

  it("does not classify without a set of internal addresses", () => {
    expect(isOwnSentCopy(message({
      from: address("membership@other.example.org.uk"),
      to: [address("external.member@provider.example")]
    }))).toBe(false);
  });
});

describe("outboundCopyFromInbound", () => {
  const internalEmails = new Set([
    "membership@other.example.org.uk",
    "chairman@other.example.org.uk"
  ]);

  it("keeps only the outside recipient and records the message as sent", () => {
    const outbound = outboundCopyFromInbound(message({
      from: address("membership@other.example.org.uk", "Internal Member"),
      to: [
        address("new.member@provider.example", "New Member"),
        address("chairman@other.example.org.uk")
      ],
      receivedAt: 1786269442000,
      sentAt: null
    }), internalEmails);
    expect(outbound.direction).toEqual(InboxMessageDirection.OUTBOUND);
    expect(outbound.to).toEqual([address("new.member@provider.example", "New Member")]);
    expect(outbound.cc).toEqual([]);
    expect(outbound.sentAt).toEqual(1786269442000);
    expect(outbound.receivedAt).toBeNull();
  });
});
