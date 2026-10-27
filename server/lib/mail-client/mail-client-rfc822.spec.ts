import expect from "expect";
import { describe, it } from "mocha";
import { imapUidFor, rfc822ForMessage } from "./mail-client-rfc822";
import { InboxMessage, InboxMessageDirection, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

describe("mail client rfc822", () => {
  const message: InboxMessage = {
    id: "507f1f77bcf86cd799439011",
    threadId: "thread-1",
    mailboxConnectionId: null,
    direction: InboxMessageDirection.OUTBOUND,
    messageId: "<abc@group.example.org.uk>",
    inReplyTo: null,
    references: [],
    from: {name: "Webmaster", email: "webmaster@group.example.org.uk"},
    to: [{name: "Alex Reed", email: "alex.reed@example.com"}],
    cc: [],
    subject: "Walk next week",
    bodyHtml: "<p>Hello</p>",
    bodyText: "Hello",
    receivedAt: null,
    sentAt: 1710000000000,
    externalSource: InboxReaderProvider.MAIL_CLIENT,
    externalId: null,
    attachments: []
  };

  it("builds a readable message for IMAP FETCH", () => {
    const rfc822 = rfc822ForMessage(message);
    expect(rfc822).toContain("From: \"Webmaster\" <webmaster@group.example.org.uk>");
    expect(rfc822).toContain("To: \"Alex Reed\" <alex.reed@example.com>");
    expect(rfc822).toContain("Subject: Walk next week");
    expect(rfc822).toContain("<p>Hello</p>");
  });

  it("derives a stable positive UID from the message id", () => {
    expect(imapUidFor(message)).toBeGreaterThan(0);
    expect(imapUidFor(message)).toEqual(imapUidFor(message));
  });
});
