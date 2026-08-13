import { describe, expect, it } from "vitest";
import { RecipientDraftOutcomeKind } from "../models/email-composer.model";
import { capitalisePersonName, interpretRecipientDraft, isValidEmailAddress, looksLikePersonName, parseEmailAddress, parseEmailAddressList } from "./email-addresses";

describe("parseEmailAddress", () => {
  it("reads a display name in angle brackets", () => {
    expect(parseEmailAddress("Alex Rivera <alex.rivera@example.com>")).toEqual({
      name: "Alex Rivera",
      email: "alex.rivera@example.com"
    });
  });

  it("strips quotes around a display name", () => {
    expect(parseEmailAddress("\"Alex Rivera\" <alex.rivera@example.com>")).toEqual({
      name: "Alex Rivera",
      email: "alex.rivera@example.com"
    });
  });

  it("reads a bare address", () => {
    expect(parseEmailAddress("alex.rivera@example.com")).toEqual({
      name: "",
      email: "alex.rivera@example.com"
    });
  });

  it("returns null for empty or nameless junk", () => {
    expect(parseEmailAddress("")).toBeNull();
    expect(parseEmailAddress("Alex Rivera")).toBeNull();
  });
});

describe("parseEmailAddressList", () => {
  it("reads a single pasted mailbox", () => {
    expect(parseEmailAddressList("Alex Rivera <alex.rivera@example.com>")).toEqual([
      {name: "Alex Rivera", email: "alex.rivera@example.com"}
    ]);
  });

  it("reads two mailboxes even when they are only separated by spaces", () => {
    expect(parseEmailAddressList("Alex Rivera <alex.rivera@example.com>   Jane Doe <jane@example.com>")).toEqual([
      {name: "Alex Rivera", email: "alex.rivera@example.com"},
      {name: "Jane Doe", email: "jane@example.com"}
    ]);
  });

  it("reads two mailboxes even when they are only separated by semi colon", () => {
    expect(parseEmailAddressList("Alex Rivera <alex.rivera@example.com>;Jane Doe <jane@example.com>")).toEqual([
      {name: "Alex Rivera", email: "alex.rivera@example.com"},
      {name: "Jane Doe", email: "jane@example.com"}
    ]);
  });

  it("reads two mailboxes even when they are only separated by spaces", () => {
    expect(parseEmailAddressList("Alex Rivera <alex.rivera@example.com>,Jane Doe <jane@example.com>")).toEqual([
      {name: "Alex Rivera", email: "alex.rivera@example.com"},
      {name: "Jane Doe", email: "jane@example.com"}
    ]);
  });

  it("splits comma, semicolon and newline lists without breaking a name that contains a comma", () => {
    expect(parseEmailAddressList("\"Rivera, Alex\" <alex.rivera@example.com>, Jane Doe <jane@example.com>")).toEqual([
      {name: "Rivera, Alex", email: "alex.rivera@example.com"},
      {name: "Jane Doe", email: "jane@example.com"}
    ]);
    expect(parseEmailAddressList("a@example.com; b@example.com\nc@example.com")).toEqual([
      {name: "", email: "a@example.com"},
      {name: "", email: "b@example.com"},
      {name: "", email: "c@example.com"}
    ]);
  });

  it("reads a markdown mailto link", () => {
    expect(parseEmailAddressList("[Alex Rivera](mailto:alex.rivera@example.com)")).toEqual([
      {name: "Alex Rivera", email: "alex.rivera@example.com"}
    ]);
  });
});

describe("isValidEmailAddress", () => {
  it("accepts a normal address and rejects a mailbox string", () => {
    expect(isValidEmailAddress("alex.rivera@example.com")).toBe(true);
    expect(isValidEmailAddress("Alex Rivera <alex.rivera@example.com>")).toBe(false);
  });
});

describe("capitalisePersonName", () => {
  it("capitalises each word in a person name", () => {
    expect(capitalisePersonName("miles mace")).toEqual("Miles Mace");
    expect(capitalisePersonName("  MILES   MACE ")).toEqual("Miles Mace");
  });
});

describe("looksLikePersonName", () => {
  it("treats a pasted display name as a person", () => {
    expect(looksLikePersonName("Alex Rivera")).toBe(true);
    expect(looksLikePersonName("Alex")).toBe(true);
  });

  it("rejects emails and empty text", () => {
    expect(looksLikePersonName("alex.rivera@example.com")).toBe(false);
    expect(looksLikePersonName("Alex Rivera <alex.rivera@example.com>")).toBe(false);
    expect(looksLikePersonName("")).toBe(false);
    expect(looksLikePersonName("123")).toBe(false);
  });
});

describe("interpretRecipientDraft", () => {
  it("treats an empty draft as empty", () => {
    expect(interpretRecipientDraft("  ", [])).toEqual({kind: RecipientDraftOutcomeKind.EMPTY});
  });

  it("adds a pasted mailbox as a named guest", () => {
    expect(interpretRecipientDraft("Alex Rivera <alex.rivera@example.com>", [])).toEqual({
      kind: RecipientDraftOutcomeKind.ADD,
      mailboxes: [{name: "Alex Rivera", email: "alex.rivera@example.com"}]
    });
  });

  it("adds several pasted mailboxes in one go", () => {
    expect(interpretRecipientDraft("Alex Rivera <alex.rivera@example.com>; Jane Doe <jane@example.com>", [])).toEqual({
      kind: RecipientDraftOutcomeKind.ADD,
      mailboxes: [
        {name: "Alex Rivera", email: "alex.rivera@example.com"},
        {name: "Jane Doe", email: "jane@example.com"}
      ]
    });
  });

  it("adds space-separated mailboxes without treating the first as the name of the second", () => {
    expect(interpretRecipientDraft("Alex Rivera <alex.rivera@example.com> Jane Doe <jane@example.com>", [])).toEqual({
      kind: RecipientDraftOutcomeKind.ADD,
      mailboxes: [
        {name: "Alex Rivera", email: "alex.rivera@example.com"},
        {name: "Jane Doe", email: "jane@example.com"}
      ]
    });
  });

  it("opens a pending editor when only a name is pasted", () => {
    expect(interpretRecipientDraft("Alex Rivera", [])).toEqual({
      kind: RecipientDraftOutcomeKind.PENDING_NAME,
      name: "Alex Rivera",
      email: ""
    });
  });

  it("capitalises a typed person name", () => {
    expect(interpretRecipientDraft("miles mace", [])).toEqual({
      kind: RecipientDraftOutcomeKind.PENDING_NAME,
      name: "Miles Mace",
      email: ""
    });
  });

  it("prefills a unique saved email for a pasted name", () => {
    expect(interpretRecipientDraft("Alex Rivera", [
      {name: "Alex Rivera", email: "alex.rivera@example.com"}
    ])).toEqual({
      kind: RecipientDraftOutcomeKind.PENDING_NAME,
      name: "Alex Rivera",
      email: "alex.rivera@example.com"
    });
  });

  it("does not prefill when more than one saved contact shares the name", () => {
    expect(interpretRecipientDraft("Alex Rivera", [
      {name: "Alex Rivera", email: "alex.rivera@example.org"},
      {name: "Alex Rivera", email: "alex.rivera@example.com"}
    ])).toEqual({
      kind: RecipientDraftOutcomeKind.PENDING_NAME,
      name: "Alex Rivera",
      email: ""
    });
  });

  it("rejects a string that has an @ but is not a valid address", () => {
    expect(interpretRecipientDraft("Alex Rivera <foo@bar>", [])).toEqual({
      kind: RecipientDraftOutcomeKind.INVALID
    });
  });
});
