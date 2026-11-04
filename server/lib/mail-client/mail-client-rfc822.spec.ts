import { simpleParser } from "mailparser";
import expect from "expect";
import { describe, it } from "mocha";
import { imapEnvelopeFor, imapUidFor, rfc822ForMessage } from "./mail-client-rfc822";
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

  it("builds a readable message for IMAP FETCH", async () => {
    const rfc822 = rfc822ForMessage(message);
    expect(rfc822).toContain("From: \"Webmaster\" <webmaster@group.example.org.uk>");
    expect(rfc822).toContain("To: \"Alex Reed\" <alex.reed@example.com>");
    expect(rfc822).toContain("Subject: Walk next week");
    expect((await simpleParser(rfc822)).html).toBe(message.bodyHtml);
  });

  it("encodes long Unicode bodies and mixed line endings as bounded CRLF MIME lines", async () => {
    const body = `<p>${"Café route notes ".repeat(100)}</p>\n<p>Next line</p>\r\n`;
    const raw = rfc822ForMessage({...message, bodyHtml: body});
    const parsed = await simpleParser(raw);
    expect(raw).not.toMatch(/(?<!\r)\n/);
    expect(raw.endsWith("\r\n")).toBe(true);
    expect(raw.split("\r\n").every(line => Buffer.byteLength(line) <= 998)).toBe(true);
    expect(raw).toContain("Content-Transfer-Encoding: base64");
    expect(parsed.html).toBe(body.replace(/\r\n/g, "\n"));
  });

  it("still produces From, Date and Message-ID when the listing row is incomplete", () => {
    const rfc822 = rfc822ForMessage({
      ...message,
      from: null as unknown as InboxMessage["from"],
      messageId: null,
      subject: null
    });
    expect(rfc822).toContain("From: unknown@localhost");
    expect(rfc822).toContain("Message-ID: <507f1f77bcf86cd799439011@localhost>");
    expect(rfc822).toContain("Date:");
  });

  it("encodes Unicode headers and envelope strings without losing their display text", async () => {
    const source = {...message, subject: "Café walk – route notes", from: {...message.from, name: "Alex Réed"}};
    const raw = rfc822ForMessage(source);
    const parsed = await simpleParser(raw);
    const envelope = imapEnvelopeFor(source);
    expect(parsed.subject).toBe(source.subject);
    expect(parsed.from.value[0].name).toBe(source.from.name);
    expect(raw.split("\r\n\r\n")[0]).not.toMatch(/[\u0080-\uffff]/);
    expect(envelope).not.toMatch(/[\u0080-\uffff]/);
    expect(envelope).toContain("=?UTF-8?Q?");
  });

  it("derives a stable positive UID from the message id", () => {
    expect(imapUidFor(message)).toBeGreaterThan(0);
    expect(imapUidFor(message)).toEqual(imapUidFor(message));
  });
});
