import { describe, expect, it } from "vitest";
import { InboxMessage, InboxReplyComposeResponse, InboxThread } from "../models/inbox.model";
import {
  inboxMessageAt,
  inboxMessageMatchingId,
  inboxThreadId,
  inboxThreadMatchingSlug,
  inboxThreadSlug,
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
