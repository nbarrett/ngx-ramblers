import net, { Server, Socket } from "net";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { imapListenPort } from "./mail-client-ports";
import { authenticateMailClient } from "./mail-client-credentials";
import { committeeRolesForMember, mailClientAccessEnabled } from "./mail-client-auth";
import {
  createMailboxFolder,
  listMailboxes,
  mailboxByName,
  mailboxMessageById,
  mailboxMessagesById,
  mailboxUidState,
  expungeImapMessage,
  markThreadSeen,
  messagesInMailbox,
  selectedRoleForUsername
} from "./mail-client-imap-mailbox";
import { appendMailClientRfc822 } from "./mail-client-imap-append";
import { imapEnvelopeFor, rfc822ForMessage } from "./mail-client-rfc822";
import { mailClientMimeForMessage, mailClientBodyFetches, mailClientBodyStructure } from "./mail-client-mime";
import { dateTimeFromMillis } from "../shared/dates";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { ImapSearchCriterion, ImapSequenceRange, ImapSession, MailClientImapAuth, MailClientImapCapability, MailClientImapCommand, MailClientImapMessage, MailClientMailboxAttribute } from "./mail-client-imap.model";

const debugLog = debug(envConfig.logNamespace("mail-client:imap"));
debugLog.enabled = true;

export function startMailClientImap(): Server {
  const port = imapListenPort();
  const server = net.createServer(socket => handleSocket(socket));
  server.listen(port, () => debugLog(`IMAP listening on ${port}`));
  server.on("error", error => debugLog("IMAP server error", (error as Error).message));
  return server;
}

function handleSocket(socket: Socket): void {
  debugLog("IMAP connect from", socket.remoteAddress, socket.remotePort);
  const session: ImapSession = {
    socket,
    incoming: Buffer.alloc(0),
    member: null,
    username: "",
    role: null,
    mailboxes: [],
    selected: null,
    messages: [],
    idleTag: null
  };
  write(session, "* OK NGX IMAP ready");
  socket.on("data", chunk => {
    session.incoming = Buffer.concat([Uint8Array.from(session.incoming), Uint8Array.from(chunk)]);
    session.pending = (session.pending ?? Promise.resolve()).then(() => processBuffer(session)).catch(error => {
      debugLog("IMAP handler error", (error as Error).message);
      write(session, "* BYE server error");
      socket.end();
    });
  });
  socket.on("close", () => stopIdle(session));
  socket.on("error", error => debugLog("IMAP socket error", (error as Error).message));
}

async function processBuffer(session: ImapSession): Promise<void> {
  if (session.literal && session.literal.remaining > 0) {
    debugLog("APPEND data", {tag: session.literal.tag, available: session.incoming.length, remaining: session.literal.remaining});
    const take = session.incoming.subarray(0, session.literal.remaining);
    session.literal.chunks.push(Buffer.from(Uint8Array.from(take)));
    session.literal.remaining -= take.length;
    session.incoming = session.incoming.subarray(take.length);
    if (session.literal.remaining === 0) {
      const literal = session.literal;
      session.literal = null;
      await finishAppend(session, literal.tag, literal.mailbox, Buffer.concat(literal.chunks.map(chunk => Uint8Array.from(chunk))));
      await processBuffer(session);
    }
  } else {
    const newline = session.incoming.indexOf(0x0a);
    if (newline < 0) {
      return;
    } else {
      const hasReturn = newline > 0 && session.incoming[newline - 1] === 0x0d;
      const line = session.incoming.subarray(0, hasReturn ? newline - 1 : newline).toString("utf8");
      session.incoming = session.incoming.subarray(newline + 1);
      const trimmed = line.trim();
      if (trimmed) {
        await handleLine(session, trimmed);
      }
      await processBuffer(session);
    }
  }
}

export async function handleLine(session: ImapSession, line: string): Promise<void> {
  try {
    if (session.authenticationTag) {
      const tag = session.authenticationTag;
      session.authenticationTag = null;
      await authenticatePlain(session, tag, line);
    } else if (session.idleTag) {
      if (line.toUpperCase() === MailClientImapCommand.DONE) {
        write(session, `${session.idleTag} OK IDLE completed`);
        stopIdle(session);
      } else {
        write(session, `${session.idleTag} OK IDLE completed`);
        stopIdle(session);
        const parsedWhileIdle = parseTagged(line);
        if (parsedWhileIdle) {
          await handleMailClientImapCommand(session, parsedWhileIdle.tag, parsedWhileIdle.command, parsedWhileIdle.args);
        }
      }
    } else {
      const parsed = parseTagged(line);
      if (!parsed) {
        write(session, "* BAD empty command");
      } else {
        await handleMailClientImapCommand(session, parsed.tag, parsed.command, parsed.args);
      }
    }
  } catch (error) {
    debugLog("IMAP command failed", (error as Error).message, line);
    const parsed = parseTagged(line);
    if (parsed) {
      write(session, `${parsed.tag} NO ${(error as Error).message}`);
    }
  }
}

export async function handleMailClientImapCommand(session: ImapSession, tag: string, command: string, args: string): Promise<void> {
  const upper = command.toUpperCase();
  debugLog("IMAP command", {connection: session.socket.remotePort, tag, command: upper});
  if (upper === MailClientImapCommand.CAPABILITY) {
    write(session, `* CAPABILITY ${MailClientImapCapability.IMAP4REV1} AUTH=${MailClientImapAuth.PLAIN} ${MailClientImapCommand.IDLE} ${MailClientImapCapability.UIDPLUS} ${MailClientImapCapability.SPECIAL_USE}`);
    write(session, `${tag} OK ${MailClientImapCommand.CAPABILITY} completed`);
  } else if (upper === MailClientImapCommand.NOOP) {
    await refreshSelectedMailbox(session);
    write(session, `${tag} OK ${MailClientImapCommand.NOOP} completed`);
  } else if (upper === MailClientImapCommand.LOGOUT) {
    stopIdle(session);
    write(session, "* BYE NGX IMAP logging out");
    write(session, `${tag} OK ${MailClientImapCommand.LOGOUT} completed`);
    session.socket.end();
  } else if (upper === MailClientImapCommand.LOGIN) {
    await login(session, tag, args);
  } else if (upper === MailClientImapCommand.AUTHENTICATE && args.toUpperCase().startsWith(MailClientImapAuth.PLAIN)) {
    const encoded = args.split(/\s+/)[1];
    if (encoded) {
      await authenticatePlain(session, tag, encoded);
    } else {
      session.authenticationTag = tag;
      write(session, "+");
    }
  } else if (!session.member) {
    write(session, `${tag} NO authenticate first`);
  } else if (upper === MailClientImapCommand.NAMESPACE) {
    write(session, "* NAMESPACE ((\"\" \"/\")) NIL NIL");
    write(session, `${tag} OK ${MailClientImapCommand.NAMESPACE} completed`);
  } else if (upper === MailClientImapCommand.LIST || upper === MailClientImapCommand.LSUB) {
    await list(session, tag, upper, args);
  } else if (upper === MailClientImapCommand.SELECT || upper === MailClientImapCommand.EXAMINE) {
    await selectMailbox(session, tag, unquote(args), upper === MailClientImapCommand.EXAMINE);
  } else if (upper === MailClientImapCommand.CREATE) {
    await createMailbox(session, tag, unquote(args));
  } else if (upper === MailClientImapCommand.SUBSCRIBE || upper === MailClientImapCommand.UNSUBSCRIBE) {
    write(session, `${tag} OK ${upper} completed`);
  } else if (upper === MailClientImapCommand.ID) {
    write(session, `* ID NIL`);
    write(session, `${tag} OK ${upper} completed`);
  } else if (upper === MailClientImapCommand.APPEND) {
    await beginAppend(session, tag, args);
  } else if (upper === MailClientImapCommand.STATUS) {
    await statusMailbox(session, tag, args);
  } else if (upper === MailClientImapCommand.IDLE) {
    await refreshSelectedMailbox(session);
    session.idleTag = tag;
    session.idleTimer = setInterval(() => {
      session.pending = (session.pending ?? Promise.resolve()).then(() => refreshSelectedMailbox(session)).catch(error => {
        debugLog("IMAP synchronisation failed", error);
        stopIdle(session);
        write(session, "* BYE synchronisation failed");
        session.socket.end();
      });
    }, 5000);
    session.idleTimer.unref();
    write(session, "+ idling");
  } else if (!session.selected) {
    write(session, `${tag} NO select a mailbox first`);
  } else if (upper === MailClientImapCommand.FETCH) {
    await fetchMessages(session, tag, args, false);
  } else if (upper === MailClientImapCommand.UID && args.toUpperCase().startsWith(MailClientImapCommand.FETCH)) {
    await fetchMessages(session, tag, args.slice(MailClientImapCommand.FETCH.length).trim(), true);
  } else if (upper === MailClientImapCommand.STORE) {
    await storeFlags(session, tag, args, false);
  } else if (upper === MailClientImapCommand.UID && args.toUpperCase().startsWith(MailClientImapCommand.STORE)) {
    await storeFlags(session, tag, args.slice(MailClientImapCommand.STORE.length).trim(), true);
  } else if (upper === MailClientImapCommand.COPY || (upper === MailClientImapCommand.UID && args.toUpperCase().startsWith(MailClientImapCommand.COPY))) {
    await copyMessages(session, tag, upper === MailClientImapCommand.UID ? args.slice(MailClientImapCommand.COPY.length).trim() : args, upper === MailClientImapCommand.UID);
  } else if (upper === MailClientImapCommand.SEARCH || (upper === MailClientImapCommand.UID && args.toUpperCase().startsWith(MailClientImapCommand.SEARCH))) {
    search(session, tag, upper === MailClientImapCommand.UID ? args.slice(MailClientImapCommand.SEARCH.length).trim() : args, upper === MailClientImapCommand.UID);
  } else if (upper === MailClientImapCommand.EXPUNGE || upper === MailClientImapCommand.CLOSE) {
    await expungeMessages(session);
    write(session, `${tag} OK ${upper} completed`);
    if (upper === MailClientImapCommand.CLOSE) {
      session.selected = null;
      session.messages = [];
    }
  } else {
    write(session, `${tag} BAD ${upper} is not supported`);
  }
}

function stopIdle(session: ImapSession): void {
  if (session.idleTimer) {
    clearInterval(session.idleTimer);
  }
  session.idleTimer = null;
  session.idleTag = null;
}

async function authenticatePlain(session: ImapSession, tag: string, encoded: string): Promise<void> {
  const parts = Buffer.from(encoded, "base64").toString("utf8").split("\0");
  if (parts.length !== 3 || !parts[1] || !parts[2]) {
    write(session, `${tag} NO invalid authentication`);
  } else {
    await login(session, tag, quotePair(parts[1], parts[2]));
  }
}

async function refreshSelectedMailbox(session: ImapSession): Promise<void> {
  if (session.selected && session.role && session.member) {
    const fresh = await messagesInMailbox(session.role, session.selected, session.member);
    const previous = new Map(session.messages.map(message => [message.uid, message]));
    const previousCount = session.messages.length;
    const freshUids = new Set(fresh.map(message => message.uid));
    session.messages.filter(message => !freshUids.has(message.uid)).reverse().forEach(message => write(session, `* ${message.seq} EXPUNGE`));
    const flags = new Map(session.messages.map(message => [message.uid, message.deleted]));
    session.messages = fresh.map((message, index) => ({...message, seq: index + 1, deleted: flags.get(message.uid) ?? false}));
    if (previousCount !== session.messages.length || session.messages.some(message => !previous.has(message.uid))) {
      write(session, `* ${session.messages.length} EXISTS`);
    }
    session.messages.filter(message => !previous.has(message.uid) || previous.get(message.uid).seen !== message.seen || previous.get(message.uid).deleted !== message.deleted).forEach(message => write(session, `* ${message.seq} FETCH (UID ${message.uid} FLAGS (${[message.seen ? "\\Seen" : null, message.deleted ? "\\Deleted" : null].filter(Boolean).join(" ")}))`));
  }
}

async function expungeMessages(session: ImapSession): Promise<void> {
  if (!session.readOnly && session.role && session.selected) {
    const deleted = session.messages.filter(message => message.deleted);
    for (const message of deleted) {
      await expungeImapMessage(session.role, session.selected, message.message, message.thread);
    }
    await refreshSelectedMailbox(session);
  }
}

async function login(session: ImapSession, tag: string, args: string): Promise<void> {
  if (!(await mailClientAccessEnabled())) {
    write(session, `${tag} NO Mail application access is switched off`);
  } else {
    const [username, password] = splitQuoted(args);
    debugLog("IMAP LOGIN user", username);
    const member = await authenticateMailClient(username, password);
    if (!member) {
      debugLog("IMAP LOGIN failed", username);
      write(session, `${tag} NO LOGIN failed`);
    } else {
      const roles = await committeeRolesForMember(member);
      const role = selectedRoleForUsername(roles, username);
      if (!role) {
        debugLog("IMAP LOGIN no role mailbox", username);
        write(session, `${tag} NO no committee role mailbox for this account`);
      } else {
        debugLog("IMAP LOGIN ok", username, role.type);
        session.member = member;
        session.username = username;
        session.role = role;
        session.mailboxes = await listMailboxes();
        write(session, `${tag} OK LOGIN completed`);
      }
    }
  }
}

async function list(session: ImapSession, tag: string, command: string, args: string): Promise<void> {
  session.mailboxes = await listMailboxes();
  const [reference, pattern] = splitQuoted(args);
  if (!pattern) {
    write(session, `* ${command} (\\Noselect) "/" ""`);
  } else {
    const wanted = reference + pattern;
    const expression = new RegExp(`^${wanted.split("").map(character => {
      if (character === "*") {
        return ".*";
      } else if (character === "%") {
        return "[^/]*";
      } else {
        return character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
    }).join("")}$`, "i");
    const attributes = new Map([
      [InboxThreadFolder.SENT, MailClientMailboxAttribute.SENT],
      [InboxThreadFolder.DRAFTS, MailClientMailboxAttribute.DRAFTS],
      [InboxThreadFolder.JUNK, MailClientMailboxAttribute.JUNK],
      [InboxThreadFolder.DELETED, MailClientMailboxAttribute.TRASH]
    ]);
    session.mailboxes.filter(mailbox => expression.test(mailbox.name)).forEach(mailbox => {
      const specialUse = attributes.get(mailbox.folder);
      write(session, `* ${command} (\\HasNoChildren${specialUse ? ` ${specialUse}` : ""}) "/" "${escapeQuoted(mailbox.name)}"`);
    });
  }
  write(session, `${tag} OK ${command} completed`);
}

async function selectMailbox(session: ImapSession, tag: string, name: string, readOnly: boolean): Promise<void> {
  session.mailboxes = await listMailboxes();
  const mailbox = mailboxByName(session.mailboxes, name);
  if (!mailbox || !session.role || !session.member) {
    write(session, `${tag} NO mailbox does not exist`);
  } else {
    session.readOnly = readOnly;
    session.selected = mailbox;
    session.messages = await messagesInMailbox(session.role, mailbox, session.member);
    const unseen = session.messages.find(message => !message.seen);
    write(session, `* ${session.messages.length} EXISTS`);
    write(session, "* 0 RECENT");
    const state = await mailboxUidState(session.role, mailbox);
    write(session, `* OK [UIDVALIDITY ${state.uidValidity}] UIDs valid`);
    write(session, `* OK [UIDNEXT ${state.uidNext}] next UID`);
    write(session, `* FLAGS (\\Seen \\Deleted)`);
    write(session, `* OK [PERMANENTFLAGS (\\Seen)]`);
    if (unseen) {
      write(session, `* OK [UNSEEN ${unseen.seq}]`);
    }
    write(session, `${tag} OK [READ-${readOnly ? "ONLY" : "WRITE"}] SELECT completed`);
  }
}

async function statusMailbox(session: ImapSession, tag: string, args: string): Promise<void> {
  const [name] = splitQuoted(args);
  session.mailboxes = await listMailboxes();
  const mailbox = mailboxByName(session.mailboxes, name);
  if (!mailbox || !session.role || !session.member) {
    write(session, `${tag} NO mailbox does not exist`);
  } else {
    const messages = await messagesInMailbox(session.role, mailbox, session.member);
    const unseen = messages.filter(message => !message.seen).length;
    const state = await mailboxUidState(session.role, mailbox);
    const requested = args.slice(args.indexOf("(") + 1).replace(/\)\s*$/, "").toUpperCase().split(/\s+/);
    const status = [
      requested.includes("MESSAGES") ? `MESSAGES ${messages.length}` : null,
      requested.includes("UNSEEN") ? `UNSEEN ${unseen}` : null,
      requested.includes("RECENT") ? "RECENT 0" : null,
      requested.includes("UIDVALIDITY") ? `UIDVALIDITY ${state.uidValidity}` : null,
      requested.includes("UIDNEXT") ? `UIDNEXT ${state.uidNext}` : null
    ].filter(Boolean).join(" ");
    write(session, `* STATUS "${escapeQuoted(mailbox.name)}" (${status})`);
    write(session, `${tag} OK STATUS completed`);
  }
}

async function beginAppend(session: ImapSession, tag: string, args: string): Promise<void> {
  const parsed = parseAppendArgs(args);
  if (!parsed || !session.role || !session.member) {
    debugLog("APPEND rejected", args);
    write(session, `${tag} BAD APPEND needs a mailbox and a message`);
  } else {
    session.literal = {
      tag,
      mailbox: parsed.mailbox,
      flags: parsed.flags,
      remaining: parsed.size,
      chunks: [],
      plus: parsed.plus
    };
    debugLog("APPEND literal", {tag, mailbox: parsed.mailbox, octets: parsed.size, nonSynchronising: parsed.plus});
    if (!parsed.plus) {
      write(session, "+ Ready for literal data");
    }
  }
}

function parseAppendArgs(args: string): {mailbox: string; flags: string[]; size: number; plus: boolean} | null {
  const sizeMatch = args.match(/\{(\d+)(\+?)\}\s*$/);
  if (!sizeMatch) {
    return null;
  } else {
    const rest = args.slice(0, args.length - sizeMatch[0].length).trim();
    const mailboxMatch = rest.match(/^("(?:[^"\\]|\\.)*"|[^\s(]+)/);
    if (!mailboxMatch) {
      return null;
    } else {
      const afterMailbox = rest.slice(mailboxMatch[0].length).trim();
      const flagsMatch = afterMailbox.match(/^\(([^)]*)\)/);
      return {
        mailbox: unquote(mailboxMatch[1]),
        flags: flagsMatch ? flagsMatch[1].split(/\s+/).filter(Boolean) : [],
        size: Number(sizeMatch[1]),
        plus: sizeMatch[2] === "+"
      };
    }
  }
}

async function finishAppend(session: ImapSession, tag: string, mailboxName: string, raw: Buffer): Promise<void> {
  try {
    debugLog("APPEND storing", {tag, mailbox: mailboxName, octets: raw.length});
    session.mailboxes = await listMailboxes();
    const mailbox = mailboxByName(session.mailboxes, mailboxName);
    if (!mailbox || !session.role || !session.member) {
      write(session, `${tag} NO mailbox does not exist`);
    } else {
      const appended = await appendMailClientRfc822(session.role, mailbox, raw, session.member);
      write(session, `${tag} OK [APPENDUID ${appended.uidValidity} ${appended.uid}] APPEND completed`);
      debugLog("APPEND completed", {tag, mailbox: mailboxName, octets: raw.length, uid: appended.uid});
    }
  } catch (error) {
    debugLog("APPEND failed", {tag, mailbox: mailboxName, octets: raw.length}, error);
    write(session, `${tag} NO APPEND failed: ${(error as Error).message.replace(/[\r\n]/g, " ")}`);
  }
}

async function createMailbox(session: ImapSession, tag: string, name: string): Promise<void> {
  const existing = mailboxByName(session.mailboxes.length ? session.mailboxes : await listMailboxes(), name);
  if (existing) {
    write(session, `${tag} OK CREATE completed`);
  } else if (!session.member?.id) {
    write(session, `${tag} NO authenticate first`);
  } else {
    await createMailboxFolder(name, session.member.id);
    session.mailboxes = await listMailboxes();
    write(session, `${tag} OK CREATE completed`);
  }
}

async function copyMessages(session: ImapSession, tag: string, args: string, byUid: boolean): Promise<void> {
  const [setText, mailboxName] = splitSetAndItems(args);
  session.mailboxes = await listMailboxes();
  const mailbox = mailboxByName(session.mailboxes, unquote(mailboxName));
  if (!mailbox || !session.role || !session.member) {
    write(session, `${tag} NO mailbox does not exist`);
  } else {
    const selected = messagesForSet(session.messages, setText, byUid);
    const role = session.role;
    const member = session.member;
    const copied = await selected.reduce<Promise<{source: number; destination: number}[]>>(async (previous, entry) => {
      const soFar = await previous;
      const full = await mailboxMessageById(entry.message.id ?? "") ?? entry.message;
      const appended = await appendMailClientRfc822(role, mailbox, Buffer.from(rfc822ForMessage(full), "utf8"), member);
      return [...soFar, {source: entry.uid, destination: appended.uid}];
    }, Promise.resolve([]));
    const state = await mailboxUidState(role, mailbox);
    const copyUid = copied.length
      ? ` [COPYUID ${state.uidValidity} ${copied.map(item => item.source).join(",")} ${copied.map(item => item.destination).join(",")}]`
      : "";
    write(session, `${tag} OK${copyUid} COPY completed`);
  }
}

async function fetchMessages(session: ImapSession, tag: string, args: string, byUid: boolean): Promise<void> {
  const [setText, itemsText] = splitSetAndItems(args);
  const selected = messagesForSet(session.messages, setText, byUid);
  const needsMime = /BODY|RFC822|\bALL\b|\bFAST\b|\bFULL\b/i.test(itemsText);
  const needsContent = needsMime || /\bENVELOPE\b/i.test(itemsText);
  const missingIds = needsContent ? selected.filter(entry => !entry.message.bodyHtml && !entry.message.bodyText).map(entry => entry.message.id).filter(Boolean) : [];
  const loaded = missingIds.length ? await mailboxMessagesById(missingIds) : [];
  const fullMessages = new Map(loaded.map(message => [message.id, message]));
  for (const entry of selected) {
    entry.message = fullMessages.get(entry.message.id) ?? entry.message;
    const metadataOnly = !/BODY(?:\.PEEK)?\[(?!HEADER\b|[0-9.]+\.MIME\])|\bRFC822(?:\.TEXT)?(?=[ )]|$)/i.test(itemsText);
    const mime = needsMime ? await mailClientMimeForMessage(entry.message, metadataOnly) : null;
    const bodies = mime ? mailClientBodyFetches(mime, itemsText) : [];
    if (!session.readOnly && session.member?.id && /BODY\[(?!HEADER)|\bRFC822(?:\.TEXT)?(?=[ )]|$)/i.test(itemsText)) {
      await markThreadSeen(entry.thread, session.member.id, true);
      entry.seen = true;
    }
    const flags = [entry.seen ? "\\Seen" : null, entry.deleted ? "\\Deleted" : null].filter(Boolean).join(" ");
    const attributes = [`UID ${entry.uid}`, `FLAGS (${flags})`, ...(mime ? [`RFC822.SIZE ${mime.raw.length}`] : [])];
    if (/\bENVELOPE\b|\bALL\b|\bFULL\b/i.test(itemsText)) {
      attributes.push(`ENVELOPE ${imapEnvelopeFor(entry.message)}`);
    }
    if (/\bINTERNALDATE\b|\bALL\b|\bFAST\b|\bFULL\b/i.test(itemsText)) {
      const date = dateTimeFromMillis(entry.message.sentAt ?? entry.message.receivedAt ?? 0).toUTC().setLocale("en");
      attributes.push(`INTERNALDATE "${date.toFormat(UIDateFormat.MAIL_CLIENT_INTERNAL_DATE).replace(/([+-]\d{2}):(\d{2})$/, "$1$2")}"`);
    }
    if (mime && /\bBODYSTRUCTURE\b|\bFULL\b|\bBODY(?![.\[])/i.test(itemsText)) {
      const extended = /\bBODYSTRUCTURE\b/i.test(itemsText);
      attributes.push(`${extended ? "BODYSTRUCTURE" : "BODY"} ${mailClientBodyStructure(mime, extended)}`);
    }
    session.socket.write(`* ${entry.seq} FETCH (${attributes.join(" ")}`);
    bodies.forEach(body => {
      if (body.content === null) {
        session.socket.write(` ${body.label} NIL`);
      } else {
        session.socket.write(` ${body.label} {${body.content.length}}\r\n`);
        session.socket.write(Uint8Array.from(body.content));
      }
    });
    session.socket.write(")\r\n");
  }
  write(session, `${tag} OK FETCH completed`);
}

async function storeFlags(session: ImapSession, tag: string, args: string, byUid: boolean): Promise<void> {
  if (session.readOnly) {
    write(session, `${tag} NO mailbox is read-only`);
  } else {
    const [setText, rest] = splitSetAndItems(args);
    const selected = messagesForSet(session.messages, setText, byUid);
    const replacing = /^FLAGS(?:\.SILENT)?\s/i.test(rest);
    const addSeen = /\\Seen/i.test(rest) && !/-\s*FLAGS/i.test(rest);
    const removeSeen = (/\\Seen/i.test(rest) && /-\s*FLAGS/i.test(rest)) || (replacing && !/\\Seen/i.test(rest));
    const addDeleted = /\\Deleted/i.test(rest) && !/-\s*FLAGS/i.test(rest);
    const removeDeleted = (/\\Deleted/i.test(rest) && /-\s*FLAGS/i.test(rest)) || (replacing && !/\\Deleted/i.test(rest));
    await selected.reduce<Promise<void>>(async (previous, entry) => {
      await previous;
      if (session.member?.id && (addSeen || removeSeen)) {
        await markThreadSeen(entry.thread, session.member.id, addSeen);
        entry.seen = addSeen;
      }
      if (addDeleted) {
        entry.deleted = true;
      } else if (removeDeleted) {
        entry.deleted = false;
      }
      const flags = [entry.seen ? "\\Seen" : null, entry.deleted ? "\\Deleted" : null].filter(Boolean).join(" ");
      if (!/FLAGS\.SILENT/i.test(rest)) {
        write(session, `* ${entry.seq} FETCH (FLAGS (${flags}))`);
      }
    }, Promise.resolve());
    write(session, `${tag} OK STORE completed`);
  }
}

function search(session: ImapSession, tag: string, args: string, byUid: boolean): void {
  const tokens = searchTokens(args);
  const messages = session.messages.filter(message => searchAnd(message, tokens, 0).ok);
  write(session, `* SEARCH ${messages.map(message => byUid ? message.uid : message.seq).join(" ")}`.trim());
  write(session, `${tag} OK SEARCH completed`);
}

function searchTokens(args: string): string[] {
  return (args.toUpperCase().trim().replace(/^CHARSET\s+\S+\s+/, "").match(/\(|\)|[^\s()]+/g) ?? []).filter(Boolean);
}

function searchAnd(message: MailClientImapMessage, tokens: string[], index: number): {ok: boolean; next: number} {
  if (index >= tokens.length || tokens[index] === ")") {
    return {ok: true, next: index};
  } else {
    const part = searchTerm(message, tokens, index);
    const rest = searchAnd(message, tokens, part.next);
    return {ok: part.ok && rest.ok, next: rest.next};
  }
}

function searchTerm(message: MailClientImapMessage, tokens: string[], index: number): {ok: boolean; next: number} {
  const token = tokens[index];
  if (token === "NOT") {
    const inner = searchTerm(message, tokens, index + 1);
    return {ok: !inner.ok, next: inner.next};
  } else if (token === "OR") {
    const left = searchTerm(message, tokens, index + 1);
    const right = searchTerm(message, tokens, left.next);
    return {ok: left.ok || right.ok, next: right.next};
  } else if (token === "(") {
    const inner = searchAnd(message, tokens, index + 1);
    return {ok: inner.ok, next: tokens[inner.next] === ")" ? inner.next + 1 : inner.next};
  } else if (token === ImapSearchCriterion.SEEN) {
    return {ok: message.seen, next: index + 1};
  } else if (token === ImapSearchCriterion.UNSEEN) {
    return {ok: !message.seen, next: index + 1};
  } else if (token === ImapSearchCriterion.DELETED) {
    return {ok: message.deleted, next: index + 1};
  } else if (token === ImapSearchCriterion.UNDELETED) {
    return {ok: !message.deleted, next: index + 1};
  } else {
    return {ok: true, next: index + 1};
  }
}

function messagesForSet(messages: MailClientImapMessage[], setText: string, byUid: boolean): MailClientImapMessage[] {
  const wanted = parseSequenceSet(setText);
  const max = byUid ? Math.max(0, ...messages.map(message => message.uid)) : messages.length;
  return messages.filter(message => sequenceMatches(byUid ? message.uid : message.seq, wanted, max));
}

function parseSequenceSet(setText: string): ImapSequenceRange[] {
  return setText.split(",").map(part => {
    if (part === "*") {
      return {from: null, to: null};
    } else if (part.includes(":")) {
      const [start, end] = part.split(":");
      return {from: start === "*" ? null : Number(start), to: end === "*" ? null : Number(end)};
    } else {
      return {from: Number(part), to: Number(part)};
    }
  });
}

function sequenceMatches(value: number, ranges: ImapSequenceRange[], max: number): boolean {
  return ranges.some(range => {
    const to = range.to == null ? max : range.to;
    const from = range.from ?? max;
    return value >= Math.min(from, to) && value <= Math.max(from, to);
  });
}

function parseTagged(line: string): {tag: string; command: string; args: string} | null {
  const match = line.match(/^(\S+)\s+(\S+)(?:\s+(.*))?$/);
  return match ? {tag: match[1], command: match[2], args: match[3] || ""} : null;
}

function splitQuoted(args: string): [string, string] {
  const tokens = args.match(/"(?:\\.|[^"\\])*"|[^\s]+/g) ?? [];
  return [unquote(tokens[0] || ""), unquote(tokens[1] || "")];
}

function quotePair(username: string, password: string): string {
  return `"${username.replace(/"/g, "")}" "${password.replace(/"/g, "")}"`;
}

function unquote(value: string): string {
  return value.trim().replace(/^"/, "").replace(/"$/, "").replace(/\\(["\\])/g, "$1");
}

function escapeQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function splitSetAndItems(args: string): [string, string] {
  const trimmed = args.trim();
  const space = trimmed.indexOf(" ");
  if (space < 0) {
    return [trimmed, ""];
  } else {
    return [trimmed.slice(0, space), trimmed.slice(space + 1)];
  }
}

function write(session: ImapSession, line: string): void {
  if (/^[^\s*+]+\s(?:OK|NO|BAD)\b/.test(line)) {
    debugLog("IMAP response", {connection: session.socket.remotePort, response: line});
  }
  session.socket.write(line + "\r\n");
}
