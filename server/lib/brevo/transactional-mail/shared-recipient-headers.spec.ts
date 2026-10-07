import expect from "expect";
import { describe, it } from "mocha";
import { sharedRecipientHeaders } from "./shared-recipient-headers";

describe("sharedRecipientHeaders", () => {
  const members = [
    {name: "Alex Member", email: "alex.member@example.org"},
    {name: "Casey Member", email: "casey.member@example.org"}
  ];
  const sender = [{name: "Group Secretary", email: "secretary@group.example"}];
  const existingBcc = [{name: "Audit Mailbox", email: "audit@group.example"}];

  it("puts deliberately selected members on To for a visible group message", () => {
    expect(sharedRecipientHeaders({
      memberRecipients: members,
      externalToRecipients: sender,
      existingBccRecipients: existingBcc,
      memberRecipientsAsBcc: false
    })).toEqual({
      to: [...members, ...sender],
      bcc: existingBcc
    });
  });

  it("protects a non-committee mailing list by putting members on Bcc", () => {
    expect(sharedRecipientHeaders({
      memberRecipients: members,
      externalToRecipients: sender,
      existingBccRecipients: existingBcc,
      memberRecipientsAsBcc: true
    })).toEqual({
      to: sender,
      bcc: [...existingBcc, ...members]
    });
  });

});
