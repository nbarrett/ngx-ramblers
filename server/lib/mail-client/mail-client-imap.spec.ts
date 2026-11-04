import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Socket } from "net";
import { handleLine, handleMailClientImapCommand } from "./mail-client-imap";
import * as mimeSource from "./mail-client-mime";
import * as credentials from "./mail-client-credentials";
import * as access from "./mail-client-auth";
import * as mailboxSource from "./mail-client-imap-mailbox";
import { ImapSession, MailClientMailbox } from "./mail-client-imap.model";
import { InboxMessage, InboxMessageDirection, InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { rfc822ForMessage } from "./mail-client-rfc822";
import { dateTimeFromObject } from "../shared/dates";

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
    incoming: Buffer.alloc(0),
    member: {id: "member-1"} as Member,
    username: "chair@group.example.org.uk",
    role: {type: "chair"} as CommitteeMember,
    mailboxes: [],
    selected: mailboxes[0],
    messages: [101, 205].map((uid, index) => ({uid, seq: index + 1, message, thread: {} as InboxThread, seen: false, deleted: false})),
    idleTag: null,
    commands: []
  };
}

function outputOf(write: sinon.SinonSpy): string {
  return write.args.map(args => args[0] instanceof Uint8Array ? Buffer.from(args[0]).toString("utf8") : args[0]).join("");
}

function dateMillis(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return dateTimeFromObject({year, month, day}).toMillis();
}

describe("mail application IMAP commands", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(() => sandbox.stub(mailboxSource, "mailboxUidState").resolves({uidValidity: 2, uidNext: 301}));
  afterEach(() => sandbox.restore());

  it("treats CHECK as a mailbox checkpoint like NOOP", async () => {
    const write = sandbox.spy();
    const contents = sandbox.stub(mailboxSource, "messagesInMailbox").resolves([]);
    await handleMailClientImapCommand(sessionFor(write), "a1", "CHECK", "");
    expect(contents.calledOnce).toBe(true);
    expect(outputOf(write)).toContain("a1 OK CHECK completed");
    expect(outputOf(write)).not.toContain("BAD");
  });

  it("lists messages for Outlook UID SEARCH NOT DELETED instead of rejecting the search", async () => {
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "UID", "SEARCH NOT DELETED");
    expect(outputOf(write)).toContain("* SEARCH 101 205");
    expect(outputOf(write)).toContain("a1 OK SEARCH completed");
    expect(outputOf(write)).not.toContain("BAD");
  });

  it("limits Apple Mail UID SEARCH SINCE to messages on or after that day", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.messages = [
      {...session.messages[0], uid: 101, seq: 1, message: {...message, receivedAt: dateMillis("2026-10-01")}},
      {...session.messages[1], uid: 205, seq: 2, message: {...message, receivedAt: dateMillis("2026-11-03")}}
    ];
    await handleMailClientImapCommand(session, "a1", "UID", "SEARCH 1:* SINCE 02-Nov-2026");
    expect(outputOf(write)).toContain("* SEARCH 205");
    expect(outputOf(write)).not.toContain("101");
    expect(outputOf(write)).toContain("a1 OK SEARCH completed");
  });

  it("answers the UID SEARCH RETURN form Apple Mail on iPhone uses to list existing mail", async () => {
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "1.123", "UID", "SEARCH RETURN (ALL) 1:*");
    expect(outputOf(write)).toContain("* ESEARCH (TAG \"1.123\") UID ALL 101,205");
    expect(outputOf(write)).toContain("1.123 OK SEARCH completed");
    expect(outputOf(write)).not.toContain("* SEARCH");
  });

  it("returns the readable messages and reports failure when a historical message cannot be rendered", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    sandbox.stub(mimeSource, "mailClientMimeForMessage")
      .onFirstCall().rejects(new Error("broken historical message"))
      .onSecondCall().resolves({raw: Buffer.from("Subject: Next walk\r\n\r\n"), size: 20, root: {raw: Buffer.alloc(0), body: Buffer.alloc(0), headers: [], type: "TEXT", subtype: "PLAIN", parameters: {}, children: []}});
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 1:* (UID RFC822.SIZE FLAGS BODY.PEEK[])");
    expect(outputOf(write)).toContain("UID 205");
    expect(outputOf(write)).toContain("RFC822.SIZE 0");
    expect(outputOf(write)).toContain("a1 OK FETCH completed");
    expect(outputOf(write)).not.toContain("a1 NO FETCH");
  });

  it("downloads an opened message before finishing a listing FETCH", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.commands = ["a2 UID FETCH 205 (UID RFC822.SIZE FLAGS BODY.PEEK[])"];
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 1:* (UID RFC822.SIZE FLAGS BODY.PEEK[HEADER.FIELDS (Message-ID)])");
    const output = outputOf(write);
    expect(output.indexOf("a2 OK FETCH completed")).toBeGreaterThan(-1);
    expect(output.indexOf("a2 OK FETCH completed")).toBeLessThan(output.indexOf("a1 OK FETCH completed"));
    expect(output).toContain("BODY[] {");
  });

  it("answers a pipelined later body window after the first window", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.commands = ["b UID FETCH 205 (UID BODY.PEEK[]<393216.393216>)"];
    await handleMailClientImapCommand(session, "a", "UID", "FETCH 205 (UID BODY.PEEK[]<0.393216>)");
    const output = outputOf(write);
    expect(output).toContain("a OK FETCH completed");
    expect(output).not.toContain("b OK FETCH completed");
    expect(session.commands).toEqual(["b UID FETCH 205 (UID BODY.PEEK[]<393216.393216>)"]);
  });

  it("answers the iPhone body window without unsolicited message metadata", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 205 (UID BODY.PEEK[]<0.393216>)");
    const output = outputOf(write);
    const raw = Buffer.from(rfc822ForMessage(message));
    expect(output).not.toContain("RFC822.SIZE");
    expect(output).not.toContain("FLAGS (");
    expect(output).toContain(`BODY[]<0> {${raw.length}}`);
    expect(output).not.toContain(`BODY[] {${raw.length}}`);
    expect(output).toContain("a1 OK FETCH completed");
    expect(raw.length).toBeLessThan(393216);
  });

  it("includes message size and flags when requested alongside the body window", async () => {
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "UID", "FETCH 205 (UID FLAGS RFC822.SIZE BODY.PEEK[]<0.393216>)");
    expect(outputOf(write)).toContain(`RFC822.SIZE ${Buffer.byteLength(rfc822ForMessage(message))}`);
    expect(outputOf(write)).toContain("FLAGS (");
  });

  it("reports the Seen flag when a non-PEEK body fetch changes read state", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    const seen = sandbox.stub(mailboxSource, "markThreadSeen").resolves();
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 205 (UID BODY[])");
    expect(outputOf(write)).toContain("FLAGS (\\Seen)");
    expect(outputOf(write)).not.toContain("RFC822.SIZE");
    expect(session.messages.find(entry => entry.uid === 205).seen).toBe(true);
    expect(seen.calledOnce).toBe(true);
  });

  it("does not store Outlook's own Archive folder", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const created = sandbox.stub(mailboxSource, "createMailboxFolder");
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "CREATE", "\"Archive\"");
    expect(created.called).toBe(false);
    expect(outputOf(write)).toContain("a1 NO mailbox name is not allowed");
  });

  it("stores a website folder when Outlook creates one", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const created = sandbox.stub(mailboxSource, "createMailboxFolder").resolves({name: "Mongo", folder: null, userFolderId: "folder-2"});
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "CREATE", "\"INBOX/Mongo/\"");
    expect(created.calledOnce).toBe(true);
    expect(created.firstCall.args).toEqual(["Mongo", "member-1"]);
    expect(outputOf(write)).toContain("a1 OK CREATE completed");
  });

  it("renames a website folder and keeps it selected", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const renamed = sandbox.stub(mailboxSource, "renameMailboxFolder").resolves({name: "Route planning", folder: null, userFolderId: "folder-1"});
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.selected = mailboxes[3];
    await handleMailClientImapCommand(session, "a1", "RENAME", "\"Walk planning\" \"Route planning\"");
    expect(renamed.firstCall.args).toEqual(["Walk planning", "Route planning"]);
    expect(session.selected?.name).toEqual("Route planning");
    expect(outputOf(write)).toContain("a1 OK RENAME completed");
  });

  it("files a Thunderbird trash rename in Deleted and removes the folder", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes.concat({name: "Mongo2", folder: null, userFolderId: "folder-2"}));
    const removed = sandbox.stub(mailboxSource, "deleteMailboxFolder").resolves();
    const renamed = sandbox.stub(mailboxSource, "renameMailboxFolder").resolves({name: "Deleted/Mongo2", folder: null, userFolderId: "folder-2"});
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "RENAME", "\"Mongo2\" \"Deleted/Mongo2\"");
    expect(removed.firstCall.args).toEqual(["Mongo2"]);
    expect(renamed.called).toBe(false);
    expect(outputOf(write)).toContain("a1 OK RENAME completed");
  });

  it("deletes a website folder and closes it when selected", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const deleted = sandbox.stub(mailboxSource, "deleteMailboxFolder").resolves();
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.selected = mailboxes[3];
    await handleMailClientImapCommand(session, "a1", "DELETE", "\"Walk planning\"");
    expect(deleted.firstCall.args).toEqual(["Walk planning"]);
    expect(session.selected).toEqual(null);
    expect(outputOf(write)).toContain("a1 OK DELETE completed");
  });

  it("asks Outlook to create a mailbox it tried to open", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "SELECT", "\"Mongo\"");
    expect(outputOf(write)).toContain("a1 NO [TRYCREATE] mailbox does not exist");
  });

  it("accepts Outlook folder names for Deleted Items and Junk Email", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const contents = sandbox.stub(mailboxSource, "messagesInMailbox").resolves([]);
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "SELECT", "\"Deleted Items\"");
    expect(contents.calledOnce).toBe(true);
    expect(contents.firstCall.args[1].name).toEqual("Deleted");
    expect(outputOf(write)).toContain("a1 OK [READ-WRITE] SELECT completed");
    expect(outputOf(write)).toContain("* OK [PERMANENTFLAGS (\\Seen \\Deleted \\Draft \\*)]");
  });

  it("identifies Sent and Deleted and returns subscribed folder names for LSUB", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "LSUB", "\"\" \"*\"");
    expect(outputOf(write)).toContain("* LSUB (\\HasNoChildren \\Sent) \"/\" \"Sent\"");
    expect(outputOf(write)).toContain("* LSUB (\\HasNoChildren \\Trash) \"/\" \"Deleted\"");
    expect(outputOf(write)).toContain("\"Walk planning\"");
    expect(outputOf(write)).toContain("a1 OK LSUB completed");
  });

  it("lists Inbox for the folder command Apple Mail on iPhone sends", async () => {
    sandbox.stub(mailboxSource, "listMailboxes").resolves(mailboxes);
    const write = sandbox.spy();
    await handleMailClientImapCommand(sessionFor(write), "a1", "LIST", "(SPECIAL-USE) \"\" \"*\"");
    expect(outputOf(write)).toContain("* LIST (\\HasNoChildren \\Inbox) \"/\" \"INBOX\"");
    expect(outputOf(write)).toContain("* LIST (\\HasNoChildren \\Sent) \"/\" \"Sent\"");
    expect(outputOf(write)).not.toContain("(\\Noselect)");
    expect(outputOf(write)).toContain("a1 OK LIST completed");
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
    expect(outputOf(write)).toMatch(/INTERNALDATE "\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2} [+-]\d{4}"/);
    expect(outputOf(write)).not.toContain("UTC");
    expect(outputOf(write)).not.toContain("RFC822 {");
  });
  it("accepts an APPEND literal instead of claiming the write was ignored", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    await handleMailClientImapCommand(session, "a1", "APPEND", "Drafts {20}");
    expect(outputOf(write)).toContain("+ Ready for literal data");
    expect(session.literal?.remaining).toBe(20);
    expect(session.literal?.mailbox).toBe("Drafts");
  });

  it("accepts Thunderbird Sent copies with flags and an internal date", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    await handleMailClientImapCommand(session, "a1", "APPEND", "\"Sent\" (\\Seen) \"29-Oct-2026 20:45:00 +0000\" {412}");
    expect(outputOf(write)).toContain("+ Ready for literal data");
    expect(session.literal?.mailbox).toBe("Sent");
    expect(session.literal?.remaining).toBe(412);
    expect(session.literal?.plus).toBe(false);
  });

  it("accepts a non-synchronising APPEND literal without a continuation prompt", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    await handleMailClientImapCommand(session, "a1", "APPEND", "Sent (\\Seen) {20+}");
    expect(outputOf(write)).not.toContain("+ Ready for literal data");
    expect(session.literal?.remaining).toBe(20);
    expect(session.literal?.plus).toBe(true);
  });

  it("finishes IDLE when the next tagged command arrives without DONE", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    sandbox.stub(mailboxSource, "messagesInMailbox").resolves(session.messages);
    await handleMailClientImapCommand(session, "a1", "IDLE", "");
    await handleLine(session, "a2 APPEND \"Sent\" (\\Seen) {20}");
    expect(session.idleTag).toBe(null);
    expect(outputOf(write)).toContain("a1 OK IDLE completed");
    expect(outputOf(write)).toContain("+ Ready for literal data");
    expect(session.literal?.mailbox).toBe("Sent");
  });

  it("expunges a flagged message without deleting the rest of the conversation", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.messages[0].deleted = true;
    session.messages[0].message = {...message, id: "message-1"};
    session.messages[1].message = {...message, id: "message-2"};
    const expunge = sandbox.stub(mailboxSource, "expungeImapMessage");
    sandbox.stub(mailboxSource, "messagesInMailbox").resolves([session.messages[1]]);
    await handleMailClientImapCommand(session, "a1", "EXPUNGE", "");
    expect(expunge.calledOnce).toBe(true);
    expect(expunge.firstCall.args[2].id).toEqual("message-1");
    expect(outputOf(write)).toContain("EXPUNGE");
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

  it("keeps only one background refresh pending while an idle mailbox is slow", async () => {
    const clock = sandbox.useFakeTimers();
    const session = sessionFor(sandbox.spy());
    const contents = sandbox.stub(mailboxSource, "messagesInMailbox").resolves(session.messages);
    await handleMailClientImapCommand(session, "a1", "IDLE", "");
    const completion = {finish: null as ((messages: typeof session.messages) => void) | null};
    const refresh = new Promise<typeof session.messages>(resolve => completion.finish = resolve);
    contents.callsFake(() => refresh);
    clock.tick(5000);
    await Promise.resolve();
    const pending = session.pending;
    clock.tick(30000);
    expect(session.pending).toBe(pending);
    expect(contents.callCount).toBe(2);
    completion.finish(session.messages);
    await session.pending;
    await handleLine(session, "DONE");
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

  it("lists flags without loading message bodies or unavailable historical attachments", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.messages[0].message = {...session.messages[0].message, attachments: [{filename: "meeting.ics", s3Key: null, contentType: "text/calendar", sizeBytes: 0}]};
    const render = sandbox.stub(mimeSource, "mailClientMimeForMessage").rejects(new Error("Attachment content is unavailable"));
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 1:* (FLAGS)");
    expect(render.called).toBe(false);
    expect(outputOf(write)).toContain("a1 OK FETCH completed");
    expect(outputOf(write)).not.toContain("RFC822.SIZE");
  });

  it("loads header source messages in one batch for a folder refresh", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.messages = session.messages.map((entry, index) => ({...entry, message: {id: `message-${index}`, threadId: "thread-1", sentAt: 1710000000000, receivedAt: 1710000000000, bodyHtml: null, bodyText: null} as InboxMessage}));
    const load = sandbox.stub(mailboxSource, "mailboxMessagesById").resolves(session.messages.map(entry => ({...message, id: entry.message.id})));
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 1:* (UID RFC822.SIZE FLAGS BODY.PEEK[HEADER.FIELDS (SUBJECT)])");
    expect(load.calledOnceWithExactly(["message-0", "message-1"], true)).toBe(true);
    expect(outputOf(write)).toContain("Subject: Next walk");
    expect(outputOf(write)).toContain("a1 OK FETCH completed");
  });

  it("answers a header FETCH from listing fields without a second message load", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    session.messages = session.messages.map(entry => ({...entry, message: {...entry.message, bodyHtml: null, bodyText: null, bodySizeBytes: Buffer.byteLength(message.bodyHtml), bodyLines: 1}}));
    const load = sandbox.stub(mailboxSource, "mailboxMessagesById").rejects(new Error("listing already has headers"));
    const render = sandbox.stub(mimeSource, "mailClientMimeForMessage").rejects(new Error("listing must not build MIME"));
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 1:* (UID RFC822.SIZE FLAGS BODY.PEEK[HEADER.FIELDS (date subject from to cc message-id)])");
    expect(load.called).toBe(false);
    expect(render.called).toBe(false);
    expect(outputOf(write)).toContain("Subject: Next walk");
    expect(outputOf(write)).toContain(`RFC822.SIZE ${Buffer.byteLength(rfc822ForMessage(message))}`);
    expect(outputOf(write)).toContain("ENVELOPE");
    expect(outputOf(write)).toContain("INTERNALDATE");
    expect(outputOf(write)).toContain("a1 OK FETCH completed");
  });

  it("streams a large folder in bounded database reads without retaining full bodies in the session", async () => {
    const write = sandbox.spy();
    const session = sessionFor(write);
    const template = session.messages[0];
    session.messages = Array.from({length: 45}, (_unused, index) => ({...template, uid: index + 1, seq: index + 1, message: {id: `message-${index}`, threadId: "thread-1", sentAt: 1710000000000, receivedAt: 1710000000000, bodyHtml: null, bodyText: null} as InboxMessage}));
    const load = sandbox.stub(mailboxSource, "mailboxMessagesById").callsFake(async ids => {
      if (ids[0] === "message-20") {
        expect(outputOf(write)).toContain("* 20 FETCH");
        expect(outputOf(write)).not.toContain("a1 OK FETCH completed");
      }
      return ids.map(id => ({...message, id, bodyHtml: "<p>Fictional message body</p>"}));
    });
    await handleMailClientImapCommand(session, "a1", "UID", "FETCH 1:* (UID RFC822.SIZE FLAGS BODY.PEEK[HEADER.FIELDS (SUBJECT)])");
    expect(load.args.map(args => args[0].length)).toEqual([20, 20, 5]);
    expect(outputOf(write)).toContain("* 45 FETCH");
    expect(outputOf(write)).toContain("a1 OK FETCH completed");
    expect(session.messages.every(entry => entry.message.bodyHtml === null)).toBe(true);
  });

});
