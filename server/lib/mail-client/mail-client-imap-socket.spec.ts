import { simpleParser } from "mailparser";
import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import net, { AddressInfo, Server, Socket } from "net";
import { once } from "events";
import * as ports from "./mail-client-ports";
import * as credentials from "./mail-client-credentials";
import * as access from "./mail-client-auth";
import * as mailboxSource from "./mail-client-imap-mailbox";
import * as appendSource from "./mail-client-imap-append";
import * as aws from "../aws/aws-controllers";
import { startMailClientImap } from "./mail-client-imap";
import { MailClientImapMessage, MailClientMailbox } from "./mail-client-imap.model";
import { InboxMessage, InboxMessageDirection, InboxReaderProvider, InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

class ImapSocketProbe {
  private received = Buffer.alloc(0);
  private readonly socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
    socket.on("data", chunk => this.received = Buffer.concat([Uint8Array.from(this.received), Uint8Array.from(chunk)]));
  }

  async through(pattern: RegExp): Promise<Buffer> {
    if (pattern.test(this.received.toString("latin1"))) {
      return this.received;
    } else {
      return new Promise<Buffer>((resolve, reject) => {
        const cleanUp = () => {
          this.socket.off("data", inspect);
          this.socket.off("error", failed);
          this.socket.off("close", closed);
        };
        const inspect = () => {
          if (pattern.test(this.received.toString("latin1"))) {
            cleanUp();
            resolve(this.received);
          }
        };
        const failed = (error: Error) => {
          cleanUp();
          reject(error);
        };
        const closed = () => failed(new Error(`IMAP connection closed before ${pattern}: ${this.received.toString("latin1")}`));
        this.socket.on("data", inspect);
        this.socket.once("error", failed);
        this.socket.once("close", closed);
        inspect();
      });
    }
  }

  response(tag: string): Promise<Buffer> {
    return this.through(new RegExp(`(?:^|\\r\\n)${tag} (?:OK|NO|BAD)[^\\r\\n]*\\r\\n`));
  }
}

describe("mail application IMAP loopback protocol", function () {
  this.timeout(20000);
  const sandbox = sinon.createSandbox();
  const sockets = {server: null as Server, client: null as Socket, accepted: null as Socket, probe: null as ImapSocketProbe};
  const mailbox: MailClientMailbox = {name: "INBOX", folder: InboxThreadFolder.INBOX, userFolderId: null};
  const member = {id: "member-1"} as Member;
  const role = {type: "chair"} as CommitteeMember;
  const attachment = Buffer.from([37, 80, 68, 70, 0, 255, 1, 128]);
  const message: InboxMessage = {
    id: "message-1",
    threadId: "thread-1",
    mailboxConnectionId: null,
    direction: InboxMessageDirection.INBOUND,
    messageId: "<message-1@group.example.org.uk>",
    inReplyTo: null,
    references: [],
    from: {name: "Alex Reed", email: "alex.reed@example.com"},
    to: [{name: "Chair", email: "chair@group.example.org.uk"}],
    cc: [],
    subject: "Walk route notes",
    bodyHtml: "<p>Meet at Hillside Park.</p>",
    bodyText: "Meet at Hillside Park.",
    receivedAt: 1710000000000,
    sentAt: null,
    externalSource: InboxReaderProvider.MAIL_CLIENT,
    externalId: null,
    attachments: [{filename: "route-notes.pdf", contentType: "application/pdf", sizeBytes: attachment.length, s3Key: "inbox-attachments/route-notes.pdf"}]
  };
  const initial: MailClientImapMessage = {uid: 101, seq: 1, message, thread: {id: "thread-1"} as InboxThread, seen: false, deleted: false};

  beforeEach(async () => {
    sandbox.stub(ports, "imapListenPort").returns(0);
    sandbox.stub(access, "mailClientAccessEnabled").resolves(true);
    sandbox.stub(access, "committeeRolesForMember").resolves([role]);
    sandbox.stub(credentials, "authenticateMailClient").resolves(member);
    sandbox.stub(mailboxSource, "selectedRoleForUsername").returns(role);
    sandbox.stub(mailboxSource, "listMailboxes").resolves([mailbox]);
    sandbox.stub(mailboxSource, "mailboxByName").returns(mailbox);
    sandbox.stub(mailboxSource, "mailboxUidState").resolves({uidValidity: 44, uidNext: 206});
    sandbox.stub(mailboxSource, "messagesInMailbox").resolves([{...initial}]);
    sandbox.stub(mailboxSource, "markThreadSeen").resolves();
    sandbox.stub(aws, "objectBufferForKey").resolves(attachment);
    sockets.server = startMailClientImap();
    await once(sockets.server, "listening");
    const accepted = once(sockets.server, "connection");
    sockets.client = net.connect({host: "::1", port: (sockets.server.address() as AddressInfo).port});
    sockets.probe = new ImapSocketProbe(sockets.client);
    const connected = once(sockets.client, "connect");
    sockets.accepted = (await accepted)[0] as Socket;
    await connected;
    await sockets.probe.through(/^\* OK NGX IMAP ready\r\n/);
  });

  afterEach(async () => {
    sockets.client?.destroy();
    sockets.accepted?.destroy();
    if (sockets.server?.listening) {
      await new Promise<void>((resolve, reject) => sockets.server.close(error => error ? reject(error) : resolve()));
    }
    sandbox.restore();
  });

  async function chunkReceived(chunk: string | Uint8Array): Promise<void> {
    const received = once(sockets.accepted, "data");
    sockets.client.write(chunk);
    await received;
  }

  async function authenticateAndSelect(): Promise<Buffer> {
    const encoded = Buffer.from("\0chair@group.example.org.uk\0fictional-test-password", "utf8").toString("base64");
    await chunkReceived("a1 AUTHEN");
    await chunkReceived("TICATE PLAIN\r\n");
    await sockets.probe.through(/\r\n\+\r\n/);
    await chunkReceived(encoded.slice(0, 7));
    sockets.client.write(encoded.slice(7) + "\r\na2 SELECT INBOX\r\n");
    return sockets.probe.response("a2");
  }

  it("accepts segmented AUTH PLAIN continuation and a pipelined SELECT in order", async () => {
    const response = (await authenticateAndSelect()).toString("latin1");
    expect(response).toContain("a1 OK LOGIN completed\r\n");
    expect(response).toContain("* 1 EXISTS\r\n");
    expect(response).toContain("[UIDVALIDITY 44]");
    expect(response).toContain("[UIDNEXT 206]");
    expect(response).toContain("a2 OK [READ-WRITE] SELECT completed\r\n");
    expect(response.indexOf("a1 OK")).toBeLessThan(response.indexOf("a2 OK"));
    expect(response).not.toContain(" BAD ");
    expect((credentials.authenticateMailClient as sinon.SinonStub).calledOnceWithExactly("chair@group.example.org.uk", "fictional-test-password")).toBe(true);
  });

  for (const attached of [false, true]) {
    it(`keeps listing headers and size consistent with downloaded Unicode mail with attachments=${attached}`, async () => {
      const source = {...message, subject: "Café walk – route notes", from: {...message.from, name: "Alex Réed"}, attachments: attached ? message.attachments : []};
      (mailboxSource.messagesInMailbox as sinon.SinonStub).resolves([{...initial, message: {...source, bodyHtml: null, bodyText: null, bodySizeBytes: Buffer.byteLength(source.bodyHtml), bodyLines: 1}}]);
      const load = sandbox.stub(mailboxSource, "mailboxMessagesById").resolves([source]);
      await authenticateAndSelect();
      sockets.client.write("a3 UID FETCH 101 (UID FLAGS RFC822.SIZE ENVELOPE BODY.PEEK[HEADER])\r\n");
      const listing = await sockets.probe.response("a3");
      sockets.client.write("a4 UID FETCH 101 (RFC822.SIZE BODYSTRUCTURE BODY.PEEK[])\r\n");
      const response = await sockets.probe.response("a4");
      const text = response.toString("latin1");
      const literal = text.match(/BODY\[\] \{(\d+)\}\r\n/);
      expect(literal).not.toBeNull();
      const start = literal.index + literal[0].length;
      const raw = response.subarray(start, start + Number(literal[1]));
      const parsed = await simpleParser(raw);
      const sizes = Array.from(text.matchAll(/RFC822.SIZE (\d+)/g)).map(match => Number(match[1]));
      expect(sizes).toEqual([raw.length, raw.length]);
      const header = listing.toString("latin1").match(/BODY\[HEADER\] \{(\d+)\}\r\n/);
      const headerStart = header.index + header[0].length;
      const headerBytes = listing.subarray(headerStart, headerStart + Number(header[1]));
      expect(headerBytes).toEqual(raw.subarray(0, raw.indexOf("\r\n\r\n") + 4));
      expect(headerBytes.toString("latin1")).not.toMatch(/[\u0080-\uffff]/);
      expect(parsed.subject).toBe(source.subject);
      expect(parsed.from.value[0].name).toBe(source.from.name);
      expect(parsed.attachments).toHaveLength(attached ? 1 : 0);
      sockets.client.write("a5 UID FETCH 101 (RFC822.SIZE BODY.PEEK[HEADER.FIELDS (MESSAGE-ID)])\r\n");
      const partial = (await sockets.probe.response("a5")).toString("latin1");
      expect(Array.from(partial.matchAll(/RFC822.SIZE (\d+)/g)).map(match => Number(match[1]))).toEqual([raw.length, raw.length, raw.length]);
      expect(load.args.map(args => args[1])).toEqual(attached ? [true, false, true] : [false]);
      expect((mailboxSource.markThreadSeen as sinon.SinonStub).called).toBe(false);
    });
  }

  it("accepts an APPEND literal and following command in the same packet", async () => {
    await authenticateAndSelect();
    const append = sandbox.stub(appendSource, "appendMailClientRfc822").resolves({uidValidity: 44, uid: 301});
    const raw = "From: alex.reed@example.com\r\nSubject: Local check\r\n\r\nDraft body\r\n";
    sockets.client.write(`a3 APPEND Drafts {${Buffer.byteLength(raw)}+}\r\n${raw}\r\na4 NOOP\r\n`);
    expect((await sockets.probe.response("a3")).toString("utf8")).toContain("a3 OK");
    expect((await sockets.probe.response("a4")).toString("utf8")).toContain("a4 OK");
    expect(append.firstCall.args[2]).toEqual(Buffer.from(raw));
  });

  it("acknowledges a redirected APPEND without inventing a mailbox UID", async () => {
    await authenticateAndSelect();
    sandbox.stub(appendSource, "appendMailClientRfc822").resolves({uidValidity: 44, uid: null});
    const raw = "From: chair@group.example.org.uk\r\nSubject: Local check\r\n\r\nSent body\r\n";
    sockets.client.write(`a3 APPEND INBOX {${Buffer.byteLength(raw)}+}\r\n${raw}\r\n`);
    const response = (await sockets.probe.response("a3")).toString("utf8");
    expect(response).toContain("a3 OK APPEND completed");
    expect(response).not.toContain("APPENDUID");
  });

  it("returns multipart attachment literals and stores APPEND over the real socket", async () => {
    await authenticateAndSelect();
    sandbox.stub(appendSource, "appendMailClientRfc822").resolves({uidValidity: 44, uid: 301});
    sockets.client.write("a3 UID FETCH 101 (BODYSTRUCTURE BODY.PEEK[2.MIME] BODY.PEEK[2] BODY.PEEK[9])\r\na4 APPEND Drafts {20}\r\n");
    await sockets.probe.through(/\+ Ready for literal data/);
    sockets.client.write("AAAAAAAAAAAAAAAAAAAA");
    const response = await sockets.probe.response("a4");
    const text = response.toString("latin1");
    expect(text).toContain("BODYSTRUCTURE");
    expect(text).toContain("\"MIXED\"");
    expect(text).toContain("\"ALTERNATIVE\"");
    expect(text).toContain("BODY[2.MIME] {");
    expect(text).toContain("Content-Type: application/pdf");
    expect(text).toContain("BODY[9] NIL");
    const literal = text.match(/BODY\[2\] \{(\d+)\}\r\n/);
    expect(literal).not.toBeNull();
    const start = literal.index + literal[0].length;
    const bytes = response.subarray(start, start + Number(literal[1]));
    expect(Buffer.from(bytes.toString("ascii"), "base64")).toEqual(attachment);
    expect(response.subarray(start + bytes.length, start + bytes.length + 15).toString("ascii")).toBe(" BODY[9] NIL)\r\n");
    expect(text).toContain("a3 OK FETCH completed\r\n");
    expect(text).toContain("a4 OK [APPENDUID 44 301] APPEND completed\r\n");
    expect((mailboxSource.markThreadSeen as sinon.SinonStub).called).toBe(false);
  });

  it("reports mailbox removals and arrivals on NOOP before the next pipelined UID FETCH", async () => {
    await authenticateAndSelect();
    (mailboxSource.messagesInMailbox as sinon.SinonStub).resolves([{...initial, uid: 205, seen: true, message: {...message, id: "message-2", messageId: "<message-2@group.example.org.uk>"}}]);
    sockets.client.write("a3 NOOP\r\na4 UID FETCH 205 (FLAGS)\r\n");
    const response = (await sockets.probe.response("a4")).toString("latin1");
    expect(response).toContain("* 1 EXPUNGE\r\n");
    expect(response).toContain("* 1 FETCH (UID 205 FLAGS (\\Seen))\r\n");
    expect(response).toContain("a3 OK NOOP completed\r\n");
    expect(response).toContain("UID 205 FLAGS (\\Seen)");
    expect(response.indexOf("a3 OK")).toBeLessThan(response.indexOf("a4 OK"));
    expect(response).not.toContain("* BYE server error");
  });
  it("preserves UTF-8 APPEND octets split inside a multibyte character and the following command", async () => {
    await authenticateAndSelect();
    const append = sandbox.stub(appendSource, "appendMailClientRfc822").resolves({uidValidity: 44, uid: 301});
    const raw = Buffer.from("From: chair@group.example.org.uk\r\nTo: alex.reed@example.com\r\nMessage-ID: <utf8@example.com>\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Café costs £5 🌳</p>", "utf8");
    expect(raw.length).toBeGreaterThan(raw.toString("utf8").length);
    sockets.client.write(`a3 APPEND "Sent" (\\Seen) "29-Oct-2026 20:45:00 +0000" {${raw.length}}\r\n`);
    await sockets.probe.through(/\+ Ready for literal data/);
    const split = raw.indexOf("é") + 1;
    await chunkReceived(Uint8Array.from(raw.subarray(0, split)));
    sockets.client.write(Uint8Array.from(raw.subarray(split)));
    sockets.client.write("\r\na4 NOOP\r\n");
    const response = (await sockets.probe.response("a4")).toString("utf8");
    expect(append.calledOnce).toBe(true);
    expect(append.firstCall.args[2]).toEqual(raw);
    expect(response).toContain("a3 OK [APPENDUID 44 301]");
    expect(response).toContain("a4 OK NOOP completed");
    expect(response).not.toContain("BAD");
  });

});
