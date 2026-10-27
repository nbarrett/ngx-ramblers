import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Socket } from "net";
import { handleLine, handleMailClientImapCommand } from "./mail-client-imap";
import * as credentials from "./mail-client-credentials";
import * as access from "./mail-client-auth";
import * as mailboxSource from "./mail-client-imap-mailbox";
import { ImapSession, MailClientMailbox } from "./mail-client-imap.model";
import { InboxMessage, InboxMessageDirection, InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { rfc822ForMessage } from "./mail-client-rfc822";

const mailboxes: MailClientMailbox[] = [
  {name: "INBOX", folder: InboxThreadFolder.INBOX, userFolderId: null},
  {name: "Sent", folder: InboxThreadFolder.SENT, userFolderId: null},
  {name: "Deleted", folder: InboxThreadFolder.DELETED, userFolderId: null},
  {name: "Walk planning", folder: null, userFolderId: "folder-1"}
];
const message = {
  id: "message-1",
  messageId: "<message-1@group.example.org.uk>",
  direction: InboxMessageDirection.INBOUND,
  from: {name: "Alex Reed", email: "alex.reed@example.com"},
  to: [],
  cc: [],
  subject: "Next walk",
  bodyHtml: "<p>Meet at Hillside Park.</p>",
  receivedAt: 1710000000000
} as InboxMessage;

function sessionFor(write: sinon.SinonSpy): ImapSession {
  return {
    socket: {write} as unknown as Socket,
    buffer: "",
    member: {id: "member-1"} as Member,
    username: "chair@group.example.org.uk",
    role: {type: "chair"} as CommitteeMember,
    mailboxes: [],
    selected: mailboxes[0],
    messages: [101, 205].map((uid, index) => ({uid, seq: index + 1, message, thread: {} as InboxThread, seen: false, deleted: false})),
    idleTag: null
  };
}

function outputOf(write: sinon.SinonSpy): string {
  return write.args.map(args => args[0] instanceof Uint8Array ? Buffer.from(args[0]).toString("utf8") : args[0]).join("");
}

describe("mail application IMAP commands", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(() => sandbox.stub(mailboxSource, "mailboxUidState").resolves({uidValidity: 2, uidNext: 301}));
  afterEach(() => sandbox.restore());

  it("identifies Sent and Deleted and returns subscribed folder names for LSUB", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "LSUB", "\"\" \"*\"");
    expect(outputOf(write)).toContain("* LSUB (\\HasNoChildren \\Sent) \"/\" \"Sent\"");
    expect(outputOf(write)).toContain("* LSUB (\\HasNoChildren \\Trash) \"/\" \"Deleted\"");
    expect(outputOf(write)).toContain("\"Walk planning\"");
    expect(outputOf(write)).toContain("a1 OK LSUB completed");
  });

  it("honours folder discovery patterns", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "LIST", "\"\" \"Walk%\"");
    expect(outputOf(write)).toContain("\"Walk planning\"");
    expect(outputOf(write)).not.toContain("\"Sent\"");
  });

  it("refreshes folder discovery and opens folders containing spaces", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const contents = sandbox.stub(mailboxSource, "messagesInMailbox").resolves([]);
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "SELECT", "\"Walk planning\"");
    await handleMailClientImapCommand(sessionFor(write), "a2", "STATUS", "\"Walk planning\" (MESSAGES UNSEEN)");
    expect(contents.firstCall.args[1]).toEqual(mailboxes[3]);
    expect(contents.secondCall.args[1]).toEqual(mailboxes[3]);
    expect(outputOf(write)).toContain("* STATUS \"Walk planning\" (MESSAGES 0 UNSEEN 0)");
  });

  it("fetches all message UIDs even when they exceed the message count", async () => {
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "UID", "FETCH 1:* (FLAGS RFC822.SIZE)");
    expect(outputOf(write)).toContain("UID 101");
    expect(outputOf(write)).toContain("UID 205");
    expect(outputOf(write)).not.toContain("RFC822 {");
    expect(outputOf(write)).not.toContain("Meet at Hillside Park");
  });

  it("fetches just the final message for a star sequence", async () => {
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "FETCH", "* (FLAGS)");
    expect(outputOf(write)).toContain("UID 205");
    expect(outputOf(write)).not.toContain("UID 101");
  });

  it("returns requested headers with the BODY section label and leaves the body unread", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 101 (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])");
    expect(outputOf(write)).toContain("BODY[HEADER.FIELDS (FROM SUBJECT)] {");
    expect(outputOf(write)).toContain("Subject: Next walk");
    expect(outputOf(write)).not.toContain("Message-ID:");
    expect(outputOf(write)).not.toContain("Meet at Hillside Park");
    expect(session.messages[0].seen).toBe(false);
  });

  it("returns readable full message content with an exact literal byte count", async () => {
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "FETCH", "1 BODY.PEEK[]");
    const body = rfc822ForMessage(message);
    expect(outputOf(write)).toContain(`BODY[] {${Buffer.byteLength(body, "utf8")}}\r\n${body})`);
    expect(body.indexOf("Subject: Next walk")).toBeLessThan(body.indexOf("\r\n\r\n"));
  });

  it("provides the envelope and body structure used to display the message list and content", async () => {
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "FETCH", "1 (ENVELOPE INTERNALDATE BODYSTRUCTURE)");
    expect(outputOf(write)).toContain("\"Next walk\"");
    expect(outputOf(write)).toContain("BODYSTRUCTURE (\"TEXT\" \"HTML\"");
    expect(outputOf(write)).toContain("INTERNALDATE");
    expect(outputOf(write)).not.toContain("RFC822 {");
  });
  it("refuses unsupported writes instead of claiming they were saved", async () => {
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "APPEND", "Drafts {20}");
    expect(outputOf(write)).toContain("a1 BAD APPEND is not supported");
    expect(outputOf(write)).not.toContain("a1 OK");
  });

  it("removes a deletion flag without filing or deleting a conversation", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.messages[0].deleted = true;
    const deleted = sandbox.stub(mailboxSource, "markThreadDeleted");
    await handleMailClientImapCommand(session, "a1", "STORE", "1 -FLAGS (\\Deleted)");
    expect(session.messages[0].deleted).toBe(false);
    expect(deleted.called).toBe(false);
  });

  it("does not change persistent read state in an examined mailbox", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.readOnly = true;
    const seen = sandbox.stub(mailboxSource, "markThreadSeen");
    await handleMailClientImapCommand(session, "a1", "STORE", "1 +FLAGS (\\Seen)");
    expect(seen.called).toBe(false);
    expect(outputOf(write)).toContain("a1 NO mailbox is read-only");
  });

  it("refreshes arrivals and removals on NOOP", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    sandbox.stub(mailboxSource, "messagesInMailbox").resolves([
      session.messages[1], {...session.messages[1], uid: 300, seen: true}
    ]);
    await handleMailClientImapCommand(session, "a1", "NOOP", "");
    expect(session.messages.map(entry => entry.uid)).toEqual([205, 300]);
    expect(outputOf(write)).toContain("* 1 EXPUNGE");
    expect(outputOf(write)).toContain("UID 300 FLAGS (\\Seen)");
  });

  it("updates an idling client when a message arrives and stops polling after DONE", async () => {
    const clock = sandbox.useFakeTimers();
    const write = sandbox.spy();
    const session = sessionFor(write);
    const contents = sandbox.stub(mailboxSource, "messagesInMailbox").resolves(session.messages);
    await handleMailClientImapCommand(session, "a1", "IDLE", "");
    contents.resolves([...session.messages, {...session.messages[0], uid: 300}]);
    clock.tick(5000);
    await session.pending;
    expect(outputOf(write)).toContain("* 3 EXISTS");
    expect(outputOf(write)).toContain("UID 300");
    await handleLine(session, "DONE");
    expect(session.idleTimer).toBe(null);
    expect(outputOf(write)).toContain("a1 OK IDLE completed");
    const calls = contents.callCount;
    clock.tick(10000);
    expect(contents.callCount).toBe(calls);
  });

  it("authenticates a PLAIN continuation without parsing it as a tagged command", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.member = null;
    const authenticate = sandbox.stub(credentials, "authenticateMailClient").resolves({id: "member-1"} as Member);
    sandbox.stub(access, "mailClientAccessEnabled").resolves(true);
    sandbox.stub(access, "committeeRolesForMember").resolves([{type: "chair", email: "chair@group.example.org.uk"} as CommitteeMember]);
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    await handleLine(session, "a1 AUTHENTICATE PLAIN");
    expect(session.authenticationTag).toBe("a1");
    await handleLine(session, Buffer.from("\0chair@group.example.org.uk\0application-password").toString("base64"));
    expect(authenticate.firstCall.args).toEqual(["chair@group.example.org.uk", "application-password"]);
    expect(outputOf(write)).toContain("a1 OK LOGIN completed");
    expect(outputOf(write)).not.toContain("BAD");
  });

  it("marks a full body read but preserves unread state for BODY.PEEK", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    const seen = sandbox.stub(mailboxSource, "markThreadSeen").resolves();
    await handleMailClientImapCommand(session, "a1", "FETCH", "1 BODY.PEEK[]");
    expect(seen.called).toBe(false);
    await handleMailClientImapCommand(session, "a2", "FETCH", "1 BODY[]");
    expect(seen.calledOnce).toBe(true);
    expect(session.messages[0].seen).toBe(true);
  });

});
