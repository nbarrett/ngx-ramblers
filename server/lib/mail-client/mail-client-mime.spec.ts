import expect from "expect";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import { simpleParser } from "mailparser";
import * as aws from "../aws/aws-controllers";
import { InboxMessage, InboxMessageDirection, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { mailClientBodyFetches, mailClientBodySection, mailClientBodyStructure, mailClientMimeForMessage, mailClientMimeFromBuffer } from "./mail-client-mime";

describe("mail client MIME fetch", () => {
  const sandbox = sinon.createSandbox();
  const message: InboxMessage = {
    id: "507f1f77bcf86cd799439011",
    threadId: "thread-1",
    mailboxConnectionId: null,
    direction: InboxMessageDirection.OUTBOUND,
    messageId: "<abc@group.example.org.uk>",
    inReplyTo: "<previous@example.com>",
    references: ["<previous@example.com>"],
    from: {name: "Webmaster", email: "webmaster@group.example.org.uk"},
    to: [{name: "Alex Reed", email: "alex.reed@example.com"}],
    cc: [],
    subject: "Walk next week",
    bodyHtml: "<p>Hello<img src=\"cid:route-map\"></p>",
    bodyText: "Hello",
    receivedAt: null,
    sentAt: 1710000000000,
    externalSource: InboxReaderProvider.MAIL_CLIENT,
    externalId: null,
    attachments: [
      {filename: "route.png", contentType: "image/png", sizeBytes: 5, s3Key: "inbox-attachments/route.png", contentId: "<route-map>"},
      {filename: "notes.pdf", contentType: "application/pdf", sizeBytes: 6, s3Key: "inbox-attachments/notes.pdf"}
    ]
  };
  const png = Buffer.from([137, 80, 78, 71, 255]);
  const pdf = Buffer.from([37, 80, 68, 70, 0, 255]);

  afterEach(() => sandbox.restore());

  function downloads() {
    return sandbox.stub(aws, "objectBufferForKey").callsFake(async key => key.endsWith(".png") ? png : pdf);
  }

  it("constructs a complete MIME message with original document and inline image bytes", async () => {
    const download = downloads();
    const mime = await mailClientMimeForMessage(message);
    const parsed = await simpleParser(mime.raw);
    expect(download.callCount).toBe(2);
    expect(parsed.subject).toBe(message.subject);
    expect(parsed.from.value[0].address).toBe(message.from.email);
    expect(parsed.to).toEqual(expect.objectContaining({value: [{name: "Alex Reed", address: "alex.reed@example.com"}]}));
    expect(parsed.messageId).toBe(message.messageId);
    expect(parsed.inReplyTo).toBe(message.inReplyTo);
    expect(parsed.text).toBe("Hello");
    expect(parsed.attachments).toHaveLength(2);
    expect(parsed.attachments.find(attachment => attachment.filename === "notes.pdf")?.content).toEqual(pdf);
    expect(parsed.attachments.find(attachment => attachment.filename === "route.png")?.content).toEqual(png);
    expect(parsed.attachments.find(attachment => attachment.filename === "route.png")?.contentId).toBe("<route-map>");
    expect(parsed.attachments.find(attachment => attachment.filename === "route.png")?.contentDisposition).toBe("inline");
    expect(mime.raw.toString("utf8")).toContain("boundary=\"--_NmP-");
    expect(mime.raw.toString("utf8")).not.toContain("boundary*0=");
  });

  it("keeps MIME boundaries and bytes stable between repeated FETCH requests", async () => {
    downloads();
    const first = await mailClientMimeForMessage(message);
    const second = await mailClientMimeForMessage(message);
    expect(second.raw).toEqual(first.raw);
  });

  it("advertises nested alternative, related and mixed parts with encodings and byte sizes", async () => {
    downloads();
    const mime = await mailClientMimeForMessage(message);
    const structure = mailClientBodyStructure(mime);
    expect(mime.root.type).toBe("MULTIPART");
    expect(mime.root.subtype).toBe("MIXED");
    expect(structure).toContain("\"ALTERNATIVE\"");
    expect(structure).toContain("\"RELATED\"");
    expect(structure).toContain("\"MIXED\"");
    expect(structure).toContain("\"<route-map>\"");
    expect(structure).toContain("\"INLINE\"");
    expect(structure).toContain("\"ATTACHMENT\"");
    const attachment = mailClientBodySection(mime, "2");
    expect(structure).toContain(`\"APPLICATION\" \"PDF\" (\"NAME\" \"notes.pdf\") NIL NIL \"BASE64\" ${attachment.length}`);
    expect(Buffer.from(attachment.toString("ascii").trim(), "base64")).toEqual(pdf);
    expect(mailClientBodyStructure(mime, false)).not.toContain("\"ATTACHMENT\"");
  });

  it("fetches numbered bodies and MIME headers without exposing a different part", async () => {
    downloads();
    const mime = await mailClientMimeForMessage(message);
    expect(Buffer.from(mailClientBodySection(mime, "1.2.2").toString("ascii").trim(), "base64")).toEqual(png);
    expect(mailClientBodySection(mime, "2.MIME").toString("utf8")).toContain("Content-Type: application/pdf");
    expect(mailClientBodySection(mime, "2.MIME").toString("utf8")).toContain("Content-Disposition: attachment");
    expect(mailClientBodySection(mime, "2.MIME").toString("utf8")).not.toContain("Subject:");
    expect(mailClientBodySection(mime, "4")).toBeNull();
    expect(mailClientBodySection(mime, "2.1")).toBeNull();
    expect(mailClientBodySection(mime, "0")).toBeNull();
  });

  it("returns multiple requested sections and slices partial FETCH data by bytes", async () => {
    downloads();
    const mime = await mailClientMimeForMessage(message);
    const fetches = mailClientBodyFetches(mime, "(UID BODY.PEEK[2.MIME] BODY.PEEK[2]<2.4> BODY[9] RFC822.SIZE)");
    expect(fetches.map(fetch => fetch.label)).toEqual(["BODY[2.MIME]", "BODY[2]<2>", "BODY[9]"]);
    expect(fetches[1].content).toEqual(mailClientBodySection(mime, "2").subarray(2, 6));
    expect(fetches[2].content).toBeNull();
    expect(mailClientBodyFetches(mime, "BODY.PEEK[2]<9999.10>")[0].content).toHaveLength(0);
    expect(mailClientBodyFetches(mime, "RFC822")[0].content).toEqual(mime.raw);
    expect(mailClientBodyFetches(mime, "RFC822.TEXT")[0].content).toEqual(mime.root.body);
  });

  it("preserves folded selected headers and omits unrequested fields", () => {
    const raw = Buffer.from("From: chair@group.example.org.uk\r\nSubject: A long\r\n folded subject\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello\r\n", "utf8");
    const mime = mailClientMimeFromBuffer(raw);
    const selected = mailClientBodySection(mime, "HEADER.FIELDS (SUBJECT FROM)").toString("utf8");
    expect(selected).toContain("Subject: A long\r\n folded subject");
    expect(selected).not.toContain("Content-Type:");
    expect(mailClientBodySection(mime, "HEADER.FIELDS.NOT (SUBJECT)").toString("utf8")).not.toContain("folded subject");
    expect(mailClientBodySection(mime, "1")).toEqual(Buffer.from("Hello\r\n", "utf8"));
    expect(mailClientBodySection(mime, "1.TEXT")).toEqual(Buffer.from("Hello\r\n", "utf8"));
    expect(mailClientBodySection(mime, "1.HEADER").toString("utf8")).toContain("Content-Type: text/plain");
  });

  it("propagates attachment download failures instead of serving an incomplete message", async () => {
    sandbox.stub(aws, "objectBufferForKey").rejects(new Error("Storage unavailable"));
    await expect(mailClientMimeForMessage(message)).rejects.toThrow("Storage unavailable");
  });

  it("keeps non-ASCII attachment filenames and sender headers readable", async () => {
    downloads();
    const mime = await mailClientMimeForMessage({...message, from: {...message.from, name: "Alex Réed"}, subject: "Café walk", attachments: [{...message.attachments[1], filename: "café-notes.pdf"}]});
    const parsed = await simpleParser(mime.raw);
    expect(parsed.subject).toBe("Café walk");
    expect(parsed.from.value[0].name).toBe("Alex Réed");
    expect(parsed.attachments[0].filename).toBe("café-notes.pdf");
  });

  it("does not download storage when the message has no attachments", async () => {
    const download = downloads();
    const mime = await mailClientMimeForMessage({...message, attachments: []});
    expect(download.called).toBe(false);
    expect(mailClientBodySection(mime, "")).toEqual(mime.raw);
    expect(mailClientBodyStructure(mime)).toContain("\"TEXT\" \"HTML\"");
  });
  it("keeps historical messages readable when an attachment was never stored", async () => {
    const download = sandbox.stub(aws, "objectBufferForKey");
    const mime = await mailClientMimeForMessage({...message, attachments: [{filename: "meeting.ics", s3Key: null, sizeBytes: 0, contentType: "text/calendar"}]});
    const parsed = await simpleParser(mime.raw);
    expect(download.called).toBe(false);
    expect(parsed.subject).toBe(message.subject);
    expect(parsed.attachments[0].filename).toBe("meeting.ics.unavailable.txt");
    expect(parsed.attachments[0].content.toString("utf8")).toContain("has no stored content");
    expect(mailClientBodySection(mime, "HEADER.FIELDS (SUBJECT)").toString("utf8")).toContain(message.subject);
  });

  it("builds identical header metadata and byte sizes without downloading attachments", async () => {
    const download = downloads();
    const complete = await mailClientMimeForMessage(message);
    download.resetHistory();
    const metadata = await mailClientMimeForMessage(message, true);
    expect(download.called).toBe(false);
    expect(metadata.raw.length).toBe(complete.raw.length);
    expect(mailClientBodyStructure(metadata)).toBe(mailClientBodyStructure(complete));
    expect(mailClientBodySection(metadata, "HEADER")).toEqual(mailClientBodySection(complete, "HEADER"));
  });

});
