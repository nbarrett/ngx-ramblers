import { describe, expect, it } from "vitest";
import { hiddenInboxFolders, InboxMessage, InboxMessageDirection, InboxReplyComposeResponse, InboxThread, InboxThreadFolder } from "../models/inbox.model";
import {
  collapseInboxSends,
  inboxMessageAt,
  inboxMessageMatchingId,
  inboxThreadHeaderFrom,
  inboxThreadHeaderTo,
  inboxThreadRowFrom,
  inboxThreadRowTo,
  inboxThreadId,
  inboxThreadMatchingSlug,
  aliasMailboxExtraCaption,
  aliasMailboxHeading,
  aliasMailboxLabel,
  deliveredToFromMessage,
  inboxThreadRoleLine,
  inboxThreadSlug,
  isInboxThreadMongoId,
  newestInboxMessage,
  replyAllRecipients
} from "./inbox-thread";

function thread(overrides: Partial<InboxThread> = {}): InboxThread {
  return {
    id: "thread-1",
    normalisedSubject: "Group area email project",
    subject: "Re: Group area email project",
    lastSeenAt: 1000,
    ...overrides
  } as InboxThread;
}

describe("inboxThreadSlug", () => {

  it("kebab cases the normalised subject so the URL stays readable", () => {
    expect(inboxThreadSlug(thread())).toEqual("group-area-email-project");
  });

  it("ignores the Re: prefix by preferring the normalised subject", () => {
    expect(inboxThreadSlug(thread({normalisedSubject: "Mailing list settings"}))).toEqual("mailing-list-settings");
  });

  it("falls back to the raw subject when there is no normalised subject", () => {
    expect(inboxThreadSlug(thread({normalisedSubject: undefined, subject: "Member Bulk Load"}))).toEqual("member-bulk-load");
  });

  it("returns an empty slug when the thread has no subject at all", () => {
    expect(inboxThreadSlug(thread({normalisedSubject: undefined, subject: undefined}))).toEqual("");
  });

  it("finds the thread whose slug matches", () => {
    const wanted = thread({id: "thread-2", normalisedSubject: "Walk import problems"});
    const found = inboxThreadMatchingSlug([thread(), wanted], "walk-import-problems");
    expect(found?.id).toEqual("thread-2");
  });

  it("prefers the most recently seen thread when subjects collide", () => {
    const older = thread({id: "older", lastSeenAt: 1000});
    const newer = thread({id: "newer", lastSeenAt: 2000});
    expect(inboxThreadMatchingSlug([older, newer], "group-area-email-project")?.id).toEqual("newer");
  });

  it("returns nothing when no thread matches", () => {
    expect(inboxThreadMatchingSlug([thread()], "no-such-thread")).toBeUndefined();
  });

});

describe("inboxThreadRoleLine", () => {

  it("uses the address the mail was sent from, not the mailbox the copy arrived in", () => {
    const sent = thread({
      lastDirection: InboxMessageDirection.OUTBOUND,
      sentFrom: {name: "Nick Barrett", email: "membership@other.example.org.uk"}
    });
    expect(inboxThreadRoleLine(sent, "chairman@other.example.org.uk"))
      .toEqual("from membership@other.example.org.uk");
  });

  it("falls back to the mailbox when an older outbound thread has no sentFrom", () => {
    const sent = thread({lastDirection: InboxMessageDirection.OUTBOUND});
    expect(inboxThreadRoleLine(sent, "chairman@other.example.org.uk"))
      .toEqual("from chairman@other.example.org.uk");
  });

  it("keeps inbound mail as delivered to the mailbox", () => {
    const incoming = thread({lastDirection: InboxMessageDirection.INBOUND});
    expect(inboxThreadRoleLine(incoming, "chairman@other.example.org.uk"))
      .toEqual("to chairman@other.example.org.uk");
  });

  it("uses the role address the inbound mail was sent to when the role has more than one", () => {
    const incoming = thread({
      lastDirection: InboxMessageDirection.INBOUND,
      deliveredTo: {name: null, email: "member.one@example.org.uk"}
    });
    expect(inboxThreadRoleLine(incoming, "system-administrator@example.org.uk"))
      .toEqual("to member.one@example.org.uk");
  });

});

describe("aliasMailboxLabel", () => {

  it("names a role mailbox by its primary address", () => {
    expect(aliasMailboxLabel({roleType: "chairman", roleEmail: "chairman@example.co.uk", additionalEmails: []}))
      .toEqual("chairman@example.co.uk");
  });

  it("notes extra addresses on the same role mailbox", () => {
    expect(aliasMailboxLabel({
      roleType: "system-administrator",
      roleEmail: "ngx-project-lead@ngx-ramblers.org.uk",
      additionalEmails: ["member.one@ngx-ramblers.org.uk"]
    })).toEqual("ngx-project-lead@ngx-ramblers.org.uk + 1 more");
  });

  it("keeps the catch-all mailbox as Other inbox mail", () => {
    expect(aliasMailboxHeading({roleType: "_general_conn-1", roleEmail: "catchall@example.co.uk"}))
      .toEqual("Other inbox mail");
    expect(aliasMailboxLabel({roleType: "_general_conn-1", roleEmail: "catchall@example.co.uk", additionalEmails: ["extra@example.co.uk"]}))
      .toEqual("Other inbox mail");
  });

  it("lists extra addresses for the viewing banner", () => {
    expect(aliasMailboxExtraCaption({
      roleType: "chairman",
      roleEmail: "chairman@example.co.uk",
      additionalEmails: ["member.one@example.co.uk", "walks@example.co.uk"]
    })).toEqual("member.one@example.co.uk and walks@example.co.uk");
  });

});

describe("deliveredToFromMessage", () => {

  it("picks the matching extra role address from the inbound To list", () => {
    const message = {
      to: [{name: null, email: "Member.One@ngx-ramblers.org.uk"}],
      cc: []
    } as InboxMessage;
    expect(deliveredToFromMessage(message, {
      roleEmail: "ngx-project-lead@ngx-ramblers.org.uk",
      additionalEmails: ["member.one@ngx-ramblers.org.uk"]
    })?.email).toEqual("Member.One@ngx-ramblers.org.uk");
  });

  it("picks a matching extra address from Cc when To is someone else", () => {
    const message = {
      to: [{name: null, email: "someone@example.org"}],
      cc: [{name: null, email: "member.one@ngx-ramblers.org.uk"}]
    } as InboxMessage;
    expect(deliveredToFromMessage(message, {
      roleEmail: "ngx-project-lead@ngx-ramblers.org.uk",
      additionalEmails: ["member.one@ngx-ramblers.org.uk"]
    })?.email).toEqual("member.one@ngx-ramblers.org.uk");
  });

  it("falls back to the primary role address when none of the headers match", () => {
    const message = {
      to: [{name: null, email: "someone@example.org"}],
      cc: []
    } as InboxMessage;
    expect(deliveredToFromMessage(message, {
      roleEmail: "ngx-project-lead@ngx-ramblers.org.uk",
      additionalEmails: ["member.one@ngx-ramblers.org.uk"]
    })).toEqual({name: null, email: "ngx-project-lead@ngx-ramblers.org.uk"});
  });

});

describe("inboxThreadId", () => {

  it("uses id when the thread has been mapped", () => {
    expect(inboxThreadId(thread({id: "thread-7"}))).toEqual("thread-7");
  });

  it("falls back to _id, because the threads endpoint returns lean documents", () => {
    const lean = {normalisedSubject: "Anything", _id: {toString: () => "6a61e92bbad5cb240142f17a"}} as unknown as InboxThread;
    expect(inboxThreadId(lean)).toEqual("6a61e92bbad5cb240142f17a");
  });

  it("returns an empty string rather than undefined when neither is present", () => {
    expect(inboxThreadId({} as InboxThread)).toEqual("");
  });

});

describe("isInboxThreadMongoId", () => {

  it("accepts a 24-character hex id", () => {
    expect(isInboxThreadMongoId("6a984fd06d0af36088dc720d")).toEqual(true);
  });

  it("rejects the subject slug used in inbox URLs", () => {
    expect(isInboxThreadMongoId("api-queries-and-actions")).toEqual(false);
  });

});

describe("newestInboxMessage", () => {

  it("picks by receivedAt or sentAt, not array order", () => {
    const olderInbound = {messageId: "older", receivedAt: 1000, sentAt: null} as InboxMessage;
    const newerOutbound = {messageId: "newer", receivedAt: null, sentAt: 2000} as InboxMessage;
    expect(newestInboxMessage([olderInbound, newerOutbound])?.messageId).toEqual("newer");
    expect(newestInboxMessage([newerOutbound, olderInbound])?.messageId).toEqual("newer");
  });

  it("returns null for an empty list", () => {
    expect(newestInboxMessage([])).toBeNull();
  });

});

describe("inboxThreadHeaderFrom and inboxThreadHeaderTo", () => {

  it("follows the message From and To, not the conversation partner", () => {
    const welcome = {
      messageId: "welcome",
      direction: InboxMessageDirection.INBOUND,
      from: {name: "Nick Barrett", email: "member.one@staging-lite.ngx-ramblers.org.uk"},
      to: [{name: "Zoe Young", email: "zoe.young184@staging-lite.ngx-ramblers.org.uk"}],
      receivedAt: 2000,
      sentAt: null
    } as InboxMessage;
    expect(inboxThreadHeaderFrom([welcome])?.email).toEqual("member.one@staging-lite.ngx-ramblers.org.uk");
    expect(inboxThreadHeaderTo([welcome]).map(address => address.email)).toEqual(["zoe.young184@staging-lite.ngx-ramblers.org.uk"]);
  });

  it("uses the newest message when the conversation has more than one", () => {
    const earlier = {
      messageId: "earlier",
      from: {name: "Nick Barrett", email: "member.one@example.org"},
      to: [{name: "Zoe Young", email: "zoe@example.org"}],
      receivedAt: 1000,
      sentAt: null
    } as InboxMessage;
    const reply = {
      messageId: "reply",
      from: {name: "Zoe Young", email: "zoe@example.org"},
      to: [{name: "Nick Barrett", email: "member.one@example.org"}],
      receivedAt: 2000,
      sentAt: null
    } as InboxMessage;
    expect(inboxThreadHeaderFrom([earlier, reply])?.email).toEqual("zoe@example.org");
    expect(inboxThreadHeaderTo([earlier, reply]).map(address => address.email)).toEqual(["member.one@example.org"]);
  });

  it("returns nothing when there are no messages yet", () => {
    expect(inboxThreadHeaderFrom([])).toBeNull();
    expect(inboxThreadHeaderTo([])).toEqual([]);
  });

});

describe("inboxMessageMatchingId", () => {

  it("finds the message with the given id", () => {
    const messages = [
      {messageId: "a", receivedAt: 1} as InboxMessage,
      {messageId: "b", receivedAt: 2} as InboxMessage
    ];
    expect(inboxMessageMatchingId(messages, "b")?.messageId).toEqual("b");
  });

  it("returns null when the id is missing or unknown", () => {
    expect(inboxMessageMatchingId([{messageId: "a"} as InboxMessage], null)).toBeNull();
    expect(inboxMessageMatchingId([{messageId: "a"} as InboxMessage], "missing")).toBeNull();
  });

});

describe("inboxMessageAt", () => {

  it("prefers receivedAt and falls back to sentAt", () => {
    expect(inboxMessageAt({receivedAt: 5, sentAt: 9} as InboxMessage)).toEqual(5);
    expect(inboxMessageAt({receivedAt: null, sentAt: 9} as InboxMessage)).toEqual(9);
  });

});

describe("replyAllRecipients", () => {

  const reply = {
    to: {email: "gary.atkin@ramblers.org.uk", name: "Gary Atkin"},
    cc: [{email: "ciaran.evans@ramblers.org.uk", name: "Ciaran Evans"}]
  } as InboxReplyComposeResponse;

  const target = {
    to: [{email: "support@ngx-ramblers.org.uk", name: "Support"}, {email: "gary.atkin@ramblers.org.uk", name: "Gary Atkin"}],
    cc: [{email: "james.kears@ramblers.org.uk", name: "James Kears"}]
  } as InboxMessage;

  it("gathers cc plus the original to and cc", () => {
    const emails = replyAllRecipients(reply, target, []).map(address => address.email);
    expect(emails).toContain("ciaran.evans@ramblers.org.uk");
    expect(emails).toContain("james.kears@ramblers.org.uk");
  });

  it("excludes the person being replied to, so they are not also cc'd", () => {
    const emails = replyAllRecipients(reply, target, []).map(address => address.email);
    expect(emails).not.toContain("gary.atkin@ramblers.org.uk");
  });

  it("excludes our own role addresses", () => {
    const emails = replyAllRecipients(reply, target, ["support@ngx-ramblers.org.uk"]).map(address => address.email);
    expect(emails).not.toContain("support@ngx-ramblers.org.uk");
  });

  it("de-duplicates addresses appearing in more than one header", () => {
    const duplicated = {to: [{email: "ciaran.evans@ramblers.org.uk"}], cc: [{email: "ciaran.evans@ramblers.org.uk"}]} as InboxMessage;
    expect(replyAllRecipients(reply, duplicated, []).filter(address => address.email === "ciaran.evans@ramblers.org.uk").length).toEqual(1);
  });

  it("copes with a message that has no to or cc", () => {
    expect(replyAllRecipients(reply, {} as InboxMessage, []).map(address => address.email)).toEqual(["ciaran.evans@ramblers.org.uk"]);
  });

});

describe("collapseInboxSends", () => {

  function outbound(overrides: Partial<InboxMessage>): InboxMessage {
    return {
      direction: InboxMessageDirection.OUTBOUND,
      from: {email: "member.one@ngx-ramblers.org.uk", name: "Nick Barrett"},
      subject: "Re: Group & Area Email Project",
      to: [{email: "ciaran.evans@ramblers.org.uk", name: "Ciaran Evans"}],
      cc: [],
      receivedAt: null,
      ...overrides
    } as InboxMessage;
  }

  it("keeps a follow-up with a different body sent a few minutes later on the same subject", () => {
    const first = outbound({
      messageId: "<first@mail>",
      sentAt: 1_787_066_134_596,
      bodyHtml: "<p>Hi Ciaran,</p><p>Just checking in on the meeting.</p>"
    });
    const followUp = outbound({
      messageId: "<follow-up@mail>",
      sentAt: 1_787_066_374_642,
      bodyHtml: "<p>Sorry, those weekdays were a day out.</p>"
    });
    const collapsed = collapseInboxSends([first, followUp]);
    expect(collapsed.map(message => message.messageId)).toEqual(["<first@mail>", "<follow-up@mail>"]);
  });

  it("still folds identical copies of one send, including extra recipients", () => {
    const first = outbound({
      messageId: "<send-a@mail>",
      sentAt: 1000,
      bodyHtml: "<p>Welcome to The Group</p>",
      to: [{email: "one@example.com", name: "One"}]
    });
    const copy = outbound({
      messageId: "<send-b@mail>",
      sentAt: 2000,
      bodyHtml: "<p>Welcome to The Group</p>",
      to: [{email: "two@example.com", name: "Two"}]
    });
    const collapsed = collapseInboxSends([first, copy]);
    expect(collapsed.length).toEqual(1);
    expect(collapsed[0].to.map(address => address.email)).toEqual(["one@example.com", "two@example.com"]);
  });

  it("fills an empty stub from the later copy of the same send", () => {
    const stub = outbound({messageId: "<stub@mail>", sentAt: 1000, bodyHtml: "", bodyText: ""});
    const full = outbound({messageId: "<full@mail>", sentAt: 2000, bodyHtml: "<p>Welcome</p>"});
    const collapsed = collapseInboxSends([stub, full]);
    expect(collapsed.length).toEqual(1);
    expect(collapsed[0].bodyHtml).toEqual("<p>Welcome</p>");
  });

  it("does not fold two matching bodies once they are more than five minutes apart", () => {
    const first = outbound({messageId: "<early@mail>", sentAt: 0, bodyHtml: "<p>Same</p>"});
    const later = outbound({messageId: "<late@mail>", sentAt: 5 * 60 * 1000 + 1, bodyHtml: "<p>Same</p>"});
    expect(collapseInboxSends([first, later]).map(message => message.messageId)).toEqual(["<early@mail>", "<late@mail>"]);
  });

});

describe("hiddenInboxFolders", () => {

  it("keeps junk and deleted out of the live inbox", () => {
    expect(hiddenInboxFolders()).toEqual([InboxThreadFolder.JUNK, InboxThreadFolder.DELETED]);
  });

});

describe("inboxThreadRowFrom and inboxThreadRowTo", () => {
  const inbound = {
    lastDirection: InboxMessageDirection.INBOUND,
    externalAddress: {name: "Jane Member", email: "jane@example.com"},
    deliveredTo: {name: "Treasurer", email: "treasurer@group.org.uk"}
  } as InboxThread;
  const outbound = {
    lastDirection: InboxMessageDirection.OUTBOUND,
    externalAddress: {name: "Jane Member", email: "jane@example.com"},
    sentFrom: {name: "Treasurer", email: "treasurer@group.org.uk"}
  } as InboxThread;

  it("shows the correspondent as From and our address as To for an inbound thread", () => {
    expect(inboxThreadRowFrom(inbound, "treasurer@group.org.uk")).toBe("Jane Member");
    expect(inboxThreadRowTo(inbound, "treasurer@group.org.uk")).toBe("treasurer@group.org.uk");
  });

  it("shows our address as From and the correspondent as To for an outbound thread", () => {
    expect(inboxThreadRowFrom(outbound, null)).toBe("Treasurer");
    expect(inboxThreadRowTo(outbound, null)).toBe("Jane Member");
  });

  it("falls back to the role email when the outbound sender is missing", () => {
    const bare = {lastDirection: InboxMessageDirection.OUTBOUND, externalAddress: {name: "", email: "jane@example.com"}} as InboxThread;
    expect(inboxThreadRowFrom(bare, "treasurer@group.org.uk")).toBe("treasurer@group.org.uk");
    expect(inboxThreadRowTo(bare, null)).toBe("jane@example.com");
  });
});
