import { MailClientMessageMetadata, MailClientMimeMessage } from "./mail-client-mime.model";
import net, { Server, Socket } from "net";
import tls, { SecureContextOptions } from "tls";
import { randomUUID } from "crypto";
import debug from "debug";
import { chunk, isNumber, values } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { imapListenPort } from "./mail-client-ports";
import { authenticateMailClient } from "./mail-client-credentials";
import { committeeRolesForMember, mailClientAccessEnabled } from "./mail-client-auth";
import {
  createMailboxFolder,
  renameMailboxFolder,
  deleteMailboxFolder,
  clientOnlyMailboxName,
  renamedIntoDeleted,
  listMailboxes,
  mailboxByName,
  normalisedMailboxName,
  mailboxMessageById,
  mailboxMessagesById,
  mailboxUidState,
  expungeImapMessage,
  markThreadSeen,
  messagesInMailbox,
  selectedRoleForUsername
} from "./mail-client-imap-mailbox";
import { appendMailClientRfc822, copyMailClientMessage } from "./mail-client-imap-append";
import { imapEnvelopeFor } from "./mail-client-rfc822";
import { mailClientMimeForMessage, mailClientListingMime, mailClientMimeFromBuffer, mailClientBodyFetches, mailClientBodyStructure } from "./mail-client-mime";
import { dateTimeFromMillis, dateTimeFromObject } from "../shared/dates";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { ImapSearchCriterion, ImapSearchReturnOption, ImapSequenceRange, ImapSession, MailClientImapAuth, MailClientImapCapability, MailClientImapCommand, MailClientImapMessage, MailClientMailbox, MailClientMailboxAttribute } from "./mail-client-imap.model";

const debugLog = debug(envConfig.logNamespace("mail-client:imap"));
debugLog.enabled = true;

export function startMailClientImap(options: SecureContextOptions | null = null): Server {
  const port = imapListenPort();
  const server = options
    ? tls.createServer({...options, ALPNProtocols: ["imap"]}, socket => handleSocket(socket))
    : net.createServer(socket => handleSocket(socket));
  server.listen(port, () => debugLog(`IMAP listening on ${port}`));
  server.on("error", error => debugLog("IMAP server error", (error as Error).message));
  if (server instanceof tls.Server) {
    server.on("tlsClientError", error => debugLog("IMAP TLS handshake failed", error.message));
  }
  return server;
}

function handleSocket(socket: Socket): void {
  socket.setNoDelay(true);
  const session: ImapSession = {
    socket,
    id: randomUUID(),
    incoming: Buffer.alloc(0),
    member: null,
    username: "",
    role: null,
    mailboxes: [],
    selected: null,
    messages: [],
    idleTag: null,
    commands: []
  };
  sessionLog(session, "connected");
  write(session, "* OK NGX IMAP ready");
  socket.on("data", chunk => {
    session.incoming = Buffer.concat([Uint8Array.from(session.incoming), Uint8Array.from(chunk)]);
    session.pending = (session.pending ?? Promise.resolve()).then(() => processBuffer(session)).catch(error => {
      sessionLog(session, "IMAP handler error", (error as Error).message);
      write(session, "* BYE server error");
      socket.end();
    });
  });
  socket.on("close", () => {
    sessionLog(session, "closed");
    stopIdle(session);
  });
  socket.on("error", error => sessionLog(session, "IMAP socket error", (error as Error).message));
}

async function processBuffer(session: ImapSession): Promise<void> {
  if (session.commandLiteral && session.commandLiteral.remaining > 0) {
    if (session.incoming.length === 0) {
      return;
    } else {
      const take = session.incoming.subarray(0, session.commandLiteral.remaining);
      session.commandLiteral.chunks.push(Buffer.from(Uint8Array.from(take)));
      session.commandLiteral.remaining -= take.length;
      session.incoming = session.incoming.subarray(take.length);
      if (session.commandLiteral.remaining === 0) {
        const literal = session.commandLiteral;
        session.commandLiteral = null;
        const text = Buffer.concat(literal.chunks.map(chunk => Uint8Array.from(chunk))).toString("utf8");
        session.incoming = Buffer.concat([Uint8Array.from(Buffer.from(`${literal.line}${text}\r\n`)), Uint8Array.from(session.incoming)]);
      }
      await processBuffer(session);
    }
  } else if (session.literal && session.literal.remaining > 0) {
    sessionLog(session, "APPEND data", {tag: session.literal.tag, available: session.incoming.length, remaining: session.literal.remaining});
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
    enqueueCompleteLines(session);
    await drainCommands(session);
    if (session.incoming.length > 0 && (session.literal || session.commandLiteral)) {
      await processBuffer(session);
    }
  }
}

function enqueueCompleteLines(session: ImapSession): void {
  session.commands = session.commands ?? [];
  const appendQueued = session.commands.some(line => parseTagged(line)?.command.toUpperCase() === MailClientImapCommand.APPEND && /\{\d+\+?\}\s*$/.test(line));
  if (appendQueued || session.commandLiteral || (session.literal && session.literal.remaining > 0)) {
  } else {
    const newline = session.incoming.indexOf(0x0a);
    if (newline < 0) {
    } else {
      const hasReturn = newline > 0 && session.incoming[newline - 1] === 0x0d;
      const line = session.incoming.subarray(0, hasReturn ? newline - 1 : newline).toString("utf8");
      session.incoming = session.incoming.subarray(newline + 1);
      const trimmed = line.trim();
      const commandLiteral = trimmed.match(/^(.*)\{(\d+)(\+?)\}\s*$/);
      const parsedLiteral = commandLiteral ? parseTagged(`${commandLiteral[1]} X`) : null;
      if (commandLiteral && parsedLiteral && parsedLiteral.command.toUpperCase() !== MailClientImapCommand.APPEND) {
        session.commandLiteral = {line: commandLiteral[1], remaining: Number(commandLiteral[2]), chunks: [], plus: commandLiteral[3] === "+"};
        if (!session.commandLiteral.plus) {
          write(session, "+ Ready for literal data");
        }
      } else if (trimmed) {
        session.commands.push(trimmed);
      }
      if (parsedLiteral?.command.toUpperCase() !== MailClientImapCommand.APPEND) {
        enqueueCompleteLines(session);
      }
    }
  }
}

function isCommandBarrier(line: string): boolean {
  const parsed = parseTagged(line);
  const command = parsed?.command.toUpperCase();
  return command === MailClientImapCommand.SELECT || command === MailClientImapCommand.EXAMINE || command === MailClientImapCommand.CLOSE
    || command === MailClientImapCommand.LOGIN || command === MailClientImapCommand.LOGOUT || command === MailClientImapCommand.AUTHENTICATE
    || command === MailClientImapCommand.APPEND || command === MailClientImapCommand.IDLE || command === MailClientImapCommand.CREATE
    || command === MailClientImapCommand.DELETE || command === MailClientImapCommand.RENAME;
}

function isInteractiveFetch(line: string): boolean {
  const parsed = parseTagged(line);
  if (!parsed) {
    return false;
  } else {
    const command = parsed.command.toUpperCase();
    const text = `${command} ${parsed.args}`.toUpperCase();
    const fetch = command === MailClientImapCommand.FETCH || (command === MailClientImapCommand.UID && /\bFETCH\b/.test(text));
    return fetch && (/BODY(?:\.PEEK)?\[(?!HEADER)/.test(text) || /\bRFC822(?!\.(SIZE|HEADER))/.test(text));
  }
}

function nextCommand(session: ImapSession): string {
  const commands = session.commands ?? [];
  const barrier = commands.findIndex(line => isCommandBarrier(line));
  const limit = barrier < 0 ? commands.length : barrier;
  const interactive = commands.slice(0, limit).findIndex(line => isInteractiveFetch(line));
  if (interactive >= 0) {
    return commands.splice(interactive, 1)[0];
  } else {
    return commands.shift() ?? "";
  }
}

async function drainQueuedCommands(session: ImapSession): Promise<void> {
  if ((session.commands ?? []).length) {
    await handleLine(session, nextCommand(session));
    await drainQueuedCommands(session);
  }
}

async function drainCommands(session: ImapSession): Promise<void> {
  session.commands = session.commands ?? [];
  if (session.commandBusy) {
  } else {
    session.commandBusy = true;
    try {
      await drainQueuedCommands(session);
    } finally {
      session.commandBusy = false;
    }
  }
}

async function drainPriorityFetches(session: ImapSession): Promise<void> {
  enqueueCompleteLines(session);
  session.commands = session.commands ?? [];
  const interactive = (session.commands ?? []).some((line, index) => isInteractiveFetch(line) && !(session.commands ?? []).slice(0, index).some(isCommandBarrier));
  if (interactive) {
    const line = nextCommand(session);
    if (isInteractiveFetch(line)) {
      await handleLine(session, line);
      await drainPriorityFetches(session);
    } else {
      session.commands.unshift(line);
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
    sessionLog(session, `IMAP command failed ${(error as Error).message} ${loggedImapLine(line)}`);
    const parsed = parseTagged(line);
    if (parsed) {
      write(session, `${parsed.tag} NO ${(error as Error).message}`);
    }
  }
}

export async function handleMailClientImapCommand(session: ImapSession, tag: string, command: string, args: string): Promise<void> {
  const upper = command.toUpperCase();
  sessionLog(session, `IMAP ${upper} ${tag} ${loggedImapArgs(upper, args) ?? ""}`.trim());
  if (upper === MailClientImapCommand.CAPABILITY) {
    write(session, `* CAPABILITY ${imapCapabilities()}`);
    write(session, `${tag} OK ${MailClientImapCommand.CAPABILITY} completed`);
  } else if (upper === MailClientImapCommand.NOOP || upper === MailClientImapCommand.CHECK) {
    await refreshSelectedMailbox(session);
    write(session, `${tag} OK ${upper} completed`);
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
    const [name] = splitQuoted(args);
    await createMailbox(session, tag, name);
  } else if (upper === MailClientImapCommand.RENAME) {
    await renameMailbox(session, tag, args);
  } else if (upper === MailClientImapCommand.DELETE) {
    await deleteMailbox(session, tag, args);
  } else if (upper === MailClientImapCommand.SUBSCRIBE || upper === MailClientImapCommand.UNSUBSCRIBE) {
    write(session, `${tag} OK ${upper} completed`);
  } else if (upper === MailClientImapCommand.ID) {
    write(session, `* ID NIL`);
    write(session, `${tag} OK ${upper} completed`);
  } else if (upper === MailClientImapCommand.ENABLE) {
    write(session, `${tag} OK ${upper} completed`);
  } else if (upper === MailClientImapCommand.APPEND) {
    await beginAppend(session, tag, args);
  } else if (upper === MailClientImapCommand.STATUS) {
    await statusMailbox(session, tag, args);
  } else if (upper === MailClientImapCommand.IDLE) {
    await refreshSelectedMailbox(session);
    session.idleTag = tag;
    session.idleTimer = setInterval(() => {
      if (!session.idleRefreshPending && session.idleTag) {
        session.idleRefreshPending = true;
        session.pending = (session.pending ?? Promise.resolve()).then(() => session.idleTag ? refreshSelectedMailbox(session) : null).catch(error => {
          sessionLog(session, "IMAP synchronisation failed", error);
          stopIdle(session);
          write(session, "* BYE synchronisation failed");
          session.socket.end();
        }).finally(() => session.idleRefreshPending = false);
      }
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
  } else if (upper === MailClientImapCommand.COPY || upper === MailClientImapCommand.MOVE || (upper === MailClientImapCommand.UID && (args.toUpperCase().startsWith(MailClientImapCommand.COPY) || args.toUpperCase().startsWith(MailClientImapCommand.MOVE)))) {
    const move = upper === MailClientImapCommand.MOVE || args.toUpperCase().startsWith(MailClientImapCommand.MOVE);
    const command = move ? MailClientImapCommand.MOVE : MailClientImapCommand.COPY;
    await transferMessages(session, tag, upper === MailClientImapCommand.UID ? args.slice(command.length).trim() : args, upper === MailClientImapCommand.UID, move);
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
    sessionLog(session, "IMAP LOGIN user", username);
    const member = await authenticateMailClient(username, password);
    if (!member) {
      sessionLog(session, "IMAP LOGIN failed", username);
      write(session, `${tag} NO LOGIN failed`);
    } else {
      const roles = await committeeRolesForMember(member);
      const role = selectedRoleForUsername(roles, username);
      if (!role) {
        sessionLog(session, "IMAP LOGIN no role mailbox", username);
        write(session, `${tag} NO no committee role mailbox for this account`);
      } else {
        sessionLog(session, "IMAP LOGIN ok", username, role.type);
        session.member = member;
        session.username = username;
        session.role = role;
        session.mailboxes = await listMailboxes();
        write(session, `* CAPABILITY ${imapCapabilities()}`);
        write(session, `${tag} OK LOGIN completed`);
      }
    }
  }
}

async function list(session: ImapSession, tag: string, command: string, args: string): Promise<void> {
  session.mailboxes = await listMailboxes();
  const {reference, pattern} = listMailboxQuery(args);
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
      [InboxThreadFolder.INBOX, MailClientMailboxAttribute.INBOX],
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
    write(session, `${tag} NO [TRYCREATE] mailbox does not exist`);
  } else {
    session.readOnly = readOnly;
    session.selected = mailbox;
    session.messages = await messagesInMailbox(session.role, mailbox, session.member);
    sessionLog(session, `IMAP SELECT ${mailbox.name} exists=${session.messages.length}`);
    const unseen = session.messages.find(message => !message.seen);
    write(session, `* ${session.messages.length} EXISTS`);
    write(session, "* 0 RECENT");
    const state = await mailboxUidState(session.role, mailbox);
    write(session, `* OK [UIDVALIDITY ${state.uidValidity}] UIDs valid`);
    write(session, `* OK [UIDNEXT ${state.uidNext}] next UID`);
    write(session, `* FLAGS (\\Seen \\Deleted \\Draft)`);
    write(session, `* OK [PERMANENTFLAGS (\\Seen \\Deleted \\Draft \\*)]`);
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
    write(session, `${tag} NO [TRYCREATE] mailbox does not exist`);
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
    sessionLog(session, "APPEND rejected", args);
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
    sessionLog(session, "APPEND literal", {tag, mailbox: parsed.mailbox, octets: parsed.size, nonSynchronising: parsed.plus});
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
    sessionLog(session, "APPEND storing", {tag, mailbox: mailboxName, octets: raw.length});
    const mailbox = await mailboxForWrite(session, mailboxName);
    if (!mailbox || !session.role || !session.member) {
      write(session, `${tag} NO [TRYCREATE] mailbox does not exist`);
    } else {
      const appended = await appendMailClientRfc822(session.role, mailbox, raw, session.member);
      write(session, `${tag} OK [APPENDUID ${appended.uidValidity} ${appended.uid}] APPEND completed`);
      sessionLog(session, "APPEND completed", {tag, mailbox: mailboxName, octets: raw.length, uid: appended.uid});
    }
  } catch (error) {
    sessionLog(session, "APPEND failed", {tag, mailbox: mailboxName, octets: raw.length}, error);
    write(session, `${tag} NO APPEND failed: ${(error as Error).message.replace(/[\r\n]/g, " ")}`);
  }
}

async function mailboxForWrite(session: ImapSession, name: string): Promise<MailClientMailbox | null> {
  const wanted = normalisedMailboxName(name);
  session.mailboxes = await listMailboxes();
  const existing = mailboxByName(session.mailboxes, wanted);
  if (existing || !wanted || !session.member?.id || clientOnlyMailboxName(wanted)) {
    return existing;
  } else {
    await createMailboxFolder(wanted, session.member.id);
    session.mailboxes = await listMailboxes();
    return mailboxByName(session.mailboxes, wanted);
  }
}

async function deleteMailbox(session: ImapSession, tag: string, args: string): Promise<void> {
  const [name] = splitQuoted(args);
  await deleteMailboxFolder(name);
  session.mailboxes = await listMailboxes();
  if (session.selected && normalisedMailboxName(session.selected.name).toLowerCase() === normalisedMailboxName(name).toLowerCase()) {
    session.selected = null;
    session.messages = [];
  }
  write(session, `${tag} OK DELETE completed`);
}

async function renameMailbox(session: ImapSession, tag: string, args: string): Promise<void> {
  const [fromName, toName] = splitQuoted(args);
  if (renamedIntoDeleted(toName)) {
    await deleteMailboxFolder(fromName);
    session.mailboxes = await listMailboxes();
    if (session.selected && normalisedMailboxName(session.selected.name).toLowerCase() === normalisedMailboxName(fromName).toLowerCase()) {
      session.selected = null;
      session.messages = [];
    }
  } else {
    const renamed = await renameMailboxFolder(fromName, toName);
    session.mailboxes = await listMailboxes();
    if (session.selected && normalisedMailboxName(session.selected.name).toLowerCase() === normalisedMailboxName(fromName).toLowerCase()) {
      session.selected = renamed;
    }
  }
  write(session, `${tag} OK RENAME completed`);
}

async function createMailbox(session: ImapSession, tag: string, name: string): Promise<void> {
  const wanted = normalisedMailboxName(name);
  session.mailboxes = await listMailboxes();
  const existing = mailboxByName(session.mailboxes, wanted);
  if (!wanted || clientOnlyMailboxName(wanted)) {
    write(session, `${tag} NO mailbox name is not allowed`);
  } else if (existing) {
    write(session, `${tag} OK CREATE completed`);
  } else if (!session.member?.id) {
    write(session, `${tag} NO authenticate first`);
  } else {
    await createMailboxFolder(wanted, session.member.id);
    session.mailboxes = await listMailboxes();
    write(session, `${tag} OK CREATE completed`);
  }
}

async function transferMessages(session: ImapSession, tag: string, args: string, byUid: boolean, move: boolean): Promise<void> {
  const [setText, mailboxName] = splitSetAndItems(args);
  const mailbox = await mailboxForWrite(session, unquote(mailboxName));
  if (!mailbox || !session.role || !session.member) {
    write(session, `${tag} NO [TRYCREATE] mailbox does not exist`);
  } else {
    const selected = messagesForSet(session.messages, setText, byUid);
    const role = session.role;
    const copied = await selected.reduce<Promise<{source: number; destination: number}[]>>(async (previous, entry) => {
      const soFar = await previous;
      const full = await mailboxMessageById(entry.message.id ?? "") ?? entry.message;
      const appended = await copyMailClientMessage(role, mailbox, full);
      return [...soFar, {source: entry.uid, destination: appended.uid}];
    }, Promise.resolve([]));
    const state = await mailboxUidState(role, mailbox);
    const copyUid = copied.length
      ? ` [COPYUID ${state.uidValidity} ${copied.map(item => item.source).join(",")} ${copied.map(item => item.destination).join(",")}]`
      : "";
    if (move) {
      await refreshSelectedMailbox(session);
    }
    write(session, `${tag} OK${copyUid} ${move ? "MOVE" : "COPY"} completed`);
  }
}

async function fetchMessages(session: ImapSession, tag: string, args: string, byUid: boolean): Promise<void> {
  const [setText, itemsText] = splitSetAndItems(args);
  const selected = messagesForSet(session.messages, setText, byUid);
  sessionLog(session, `IMAP FETCH count=${selected.length} ${itemsText}`);
  for (const batch of chunk(selected, 20)) {
    await fetchMessageBatch(session, tag, batch, itemsText);
  }
  write(session, `${tag} OK FETCH completed`);
}

function fetchLogSample(content: Buffer | null | undefined): string {
  if (!content) {
    return "flags-only";
  } else {
    const text = content.toString("utf8");
    const messageId = text.match(/^Message-ID:\s*.+$/im)?.[0]?.trim();
    if (messageId) {
      return messageId;
    } else {
      return `bytes=${content.length}`;
    }
  }
}

function listingHasHeaders(message: MailClientMessageMetadata): boolean {
  return !!(message.from?.email && message.messageId);
}

function hasMimeSource(message: MailClientMessageMetadata, metadataOnly: boolean): boolean {
  return !!(message.bodyHtml || message.bodyText) || (metadataOnly && isNumber(message.bodySizeBytes) && !message.attachments?.length);
}

async function listingOrFullMime(message: MailClientMessageMetadata, itemsText: string, listFetch: boolean, metadataOnly: boolean): Promise<MailClientMimeMessage | null> {
  if (listFetch && !(message.attachments ?? []).length) {
    return mailClientListingMime(message);
  } else if (/BODY|RFC822|\bALL\b|\bFAST\b|\bFULL\b/i.test(itemsText)) {
    return mailClientMimeForMessage(message, metadataOnly);
  } else {
    return null;
  }
}

async function fetchMessageBatch(session: ImapSession, tag: string, selected: MailClientImapMessage[], itemsText: string): Promise<boolean> {
  const needsMime = /BODY|RFC822|\bALL\b|\bFAST\b|\bFULL\b/i.test(itemsText);
  const needsContent = needsMime || /\bENVELOPE\b/i.test(itemsText);
  const metadataOnly = !/BODY(?:\.PEEK)?\[(?!HEADER\b|[0-9.]+\.MIME\])|\bRFC822(?:\.TEXT)?(?=[ )]|$)/i.test(itemsText);
  const needsStructure = /\bBODYSTRUCTURE\b|\bFULL\b|\bBODY(?![.\[])/i.test(itemsText);
  const requestedFlags = /\bFLAGS\b|\bALL\b|\bFAST\b|\bFULL\b/i.test(itemsText);
  const requestedSize = /\bRFC822\.SIZE\b|\bALL\b|\bFAST\b|\bFULL\b/i.test(itemsText);
  const marksSeen = !session.readOnly && !!session.member?.id && /BODY\[(?!HEADER)|\bRFC822(?:\.TEXT)?(?=[ )]|$)/i.test(itemsText);
  const listFetch = needsMime && metadataOnly && !needsStructure && /HEADER\.FIELDS/i.test(itemsText) && !/BODY(?:\.PEEK)?\[\d/.test(itemsText);
  const missingIds = needsContent ? selected.filter(entry => {
    if (listFetch && !(entry.message.attachments ?? []).length) {
      return !listingHasHeaders(entry.message);
    } else if (needsMime) {
      return !hasMimeSource(entry.message, metadataOnly);
    } else {
      return !listingHasHeaders(entry.message);
    }
  }).map(entry => entry.message.id).filter(Boolean) : [];
  const loaded = missingIds.length ? await mailboxMessagesById(missingIds, metadataOnly) : [];
  const fullMessages = new Map(loaded.map(message => [message.id, message]));
  const emptyMime = mailClientMimeFromBuffer(Buffer.from("\r\n\r\n"));
  const rendered: {entry: MailClientImapMessage; attributes: string[]; bodies: ReturnType<typeof mailClientBodyFetches>}[] = [];
  const bodyFetch = /BODY(?:\.PEEK)?\[(?!HEADER)/.test(itemsText) || /\bRFC822(?!\.(SIZE|HEADER))/.test(itemsText);
  for (const entry of selected) {
    if (!bodyFetch) {
      await drainPriorityFetches(session);
    }
    try {
      const message = fullMessages.get(entry.message.id) ?? entry.message;
      const mime = await listingOrFullMime(message, itemsText, listFetch, metadataOnly);
      const bodies = mime ? mailClientBodyFetches(mime, itemsText) : [];
      if (marksSeen) {
        await markThreadSeen(entry.thread, session.member.id, true);
        entry.seen = true;
      }
      const flags = [entry.seen ? "\\Seen" : null, entry.deleted ? "\\Deleted" : null].filter(Boolean).join(" ");
      const advertisedSize = mime ? (metadataOnly ? mime.size ?? mime.raw.length : mime.raw.length) : null;
      const attributes = [`UID ${entry.uid}`, ...(requestedFlags || marksSeen ? [`FLAGS (${flags})`] : []), ...(requestedSize && advertisedSize !== null ? [`RFC822.SIZE ${advertisedSize}`] : [])];
      if (listFetch || /\bENVELOPE\b|\bALL\b|\bFULL\b/i.test(itemsText)) {
        attributes.push(`ENVELOPE ${imapEnvelopeFor(message)}`);
      }
      const dateMillis = message.sentAt ?? message.receivedAt ?? 0;
      if (dateMillis && (listFetch || /\bINTERNALDATE\b|\bALL\b|\bFAST\b|\bFULL\b/i.test(itemsText))) {
        const date = dateTimeFromMillis(dateMillis).toUTC().setLocale("en");
        attributes.push(`INTERNALDATE "${date.toFormat(UIDateFormat.MAIL_CLIENT_INTERNAL_DATE).replace(/([+-]\d{2}):(\d{2})$/, "$1$2")}"`);
      }
      if (mime && needsStructure) {
        const extended = /\bBODYSTRUCTURE\b/i.test(itemsText);
        attributes.push(`${extended ? "BODYSTRUCTURE" : "BODY"} ${mailClientBodyStructure(mime, extended)}`);
      }
      rendered.push({entry, attributes, bodies});
    } catch (error) {
      sessionLog(session, `IMAP FETCH uid=${entry.uid} ${(error as Error).message}`);
      const flags = [entry.seen ? "\\Seen" : null, entry.deleted ? "\\Deleted" : null].filter(Boolean).join(" ");
      rendered.push({
        entry,
        attributes: [`UID ${entry.uid}`, ...(requestedFlags ? [`FLAGS (${flags})`] : []), ...(requestedSize ? ["RFC822.SIZE 0"] : [])],
        bodies: mailClientBodyFetches(emptyMime, itemsText).map(body => ({...body, content: body.content ? Buffer.alloc(0) : null}))
      });
    }
  }
  const first = rendered[0];
  sessionLog(session, `IMAP FETCH returned=${rendered.length} of=${selected.length} size=${first?.attributes.find(attribute => attribute.startsWith("RFC822.SIZE ")) || "none"} body=${first?.bodies[0]?.content?.length ?? 0} section=${first?.bodies.map(body => body.label).join(",") || "none"} sample=${fetchLogSample(first?.bodies[0]?.content)}`);
  rendered.forEach(item => {
    sessionLog(session, `IMAP FETCH tag=${tag} uid=${item.entry.uid} sequence=${item.entry.seq} sections=${item.bodies.map(body => `${body.label} literal=${body.content?.length ?? "NIL"}`).join(",") || "none"}`);
    const bodies = item.bodies.flatMap(body => {
      if (body.content === null) {
        return [Buffer.from(` ${body.label} NIL`)];
      } else {
        return [Buffer.from(` ${body.label} {${body.content.length}}\r\n`), body.content];
      }
    });
    const response = Buffer.concat([
      Buffer.from(`* ${item.entry.seq} FETCH (${item.attributes.join(" ")}`),
      ...bodies,
      Buffer.from(")\r\n")
    ].map(content => new Uint8Array(content.buffer, content.byteOffset, content.byteLength)));
    session.socket.write(new Uint8Array(response.buffer, response.byteOffset, response.byteLength));
  });
  return true;
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

function imapCapabilities(): string {
  return `${MailClientImapCapability.IMAP4REV1} AUTH=${MailClientImapAuth.PLAIN} ${MailClientImapCommand.IDLE} ${MailClientImapCommand.MOVE} ${MailClientImapCapability.UIDPLUS} ${MailClientImapCapability.SPECIAL_USE} ${MailClientImapCapability.ESEARCH}`;
}

function search(session: ImapSession, tag: string, args: string, byUid: boolean): void {
  const request = parseSearchRequest(args);
  const tokens = searchTokens(request.criteria || ImapSearchCriterion.ALL);
  const bounds = {maxSeq: session.messages.length, maxUid: Math.max(0, ...session.messages.map(message => message.uid))};
  const messages = session.messages.filter(message => searchAnd(message, tokens, 0, bounds).ok);
  sessionLog(session, `IMAP SEARCH matches=${messages.length}/${session.messages.length} ${request.criteria}`);
  if (request.returnOptions) {
    write(session, esearchLine(tag, byUid, messages, request.returnOptions));
  } else {
    write(session, `* SEARCH ${messages.map(message => byUid ? message.uid : message.seq).join(" ")}`.trim());
  }
  write(session, `${tag} OK SEARCH completed`);
}

function parseSearchRequest(args: string): {returnOptions: ImapSearchReturnOption[] | null; criteria: string} {
  const trimmed = args.trim().replace(/^CHARSET\s+\S+\s+/i, "");
  const returned = trimmed.match(/^RETURN\s+\(([^)]*)\)\s*(.*)$/i);
  if (!returned) {
    return {returnOptions: null, criteria: trimmed};
  } else {
    const allowed = values(ImapSearchReturnOption);
    const options = returned[1].trim()
      ? returned[1].toUpperCase().split(/\s+/).filter((option): option is ImapSearchReturnOption => allowed.includes(option as ImapSearchReturnOption))
      : [ImapSearchReturnOption.ALL];
    return {returnOptions: options.length ? options : [ImapSearchReturnOption.ALL], criteria: returned[2]};
  }
}

function esearchLine(tag: string, byUid: boolean, messages: MailClientImapMessage[], options: ImapSearchReturnOption[]): string {
  const numbers = messages.map(message => byUid ? message.uid : message.seq);
  const items = [
    options.includes(ImapSearchReturnOption.MIN) && numbers.length ? `MIN ${numbers[0]}` : null,
    options.includes(ImapSearchReturnOption.MAX) && numbers.length ? `MAX ${numbers[numbers.length - 1]}` : null,
    options.includes(ImapSearchReturnOption.COUNT) ? `COUNT ${numbers.length}` : null,
    options.includes(ImapSearchReturnOption.ALL) && numbers.length ? `ALL ${compactSequenceSet(numbers)}` : null
  ].filter(Boolean);
  return `* ESEARCH (TAG "${tag}")${byUid ? " UID" : ""}${items.length ? ` ${items.join(" ")}` : ""}`;
}

function compactSequenceSet(numbers: number[]): string {
  const closed = numbers.reduce<{parts: string[]; start: number; previous: number | null}>((state, value) => {
    if (state.previous === null) {
      return {parts: [], start: value, previous: value};
    } else if (value === state.previous + 1) {
      return {...state, previous: value};
    } else {
      return {
        parts: state.parts.concat(state.start === state.previous ? `${state.start}` : `${state.start}:${state.previous}`),
        start: value,
        previous: value
      };
    }
  }, {parts: [], start: 0, previous: null as number | null});
  if (closed.previous === null) {
    return "";
  } else {
    return closed.parts.concat(closed.start === closed.previous ? `${closed.start}` : `${closed.start}:${closed.previous}`).join(",");
  }
}

function searchTokens(args: string): string[] {
  return (args.toUpperCase().trim().replace(/^CHARSET\s+\S+\s+/, "").match(/\(|\)|[^\s()]+/g) ?? []).filter(Boolean);
}

function searchAnd(message: MailClientImapMessage, tokens: string[], index: number, bounds: {maxSeq: number; maxUid: number}): {ok: boolean; next: number} {
  if (index >= tokens.length || tokens[index] === ")") {
    return {ok: true, next: index};
  } else {
    const part = searchTerm(message, tokens, index, bounds);
    const rest = searchAnd(message, tokens, part.next, bounds);
    return {ok: part.ok && rest.ok, next: rest.next};
  }
}

function searchTerm(message: MailClientImapMessage, tokens: string[], index: number, bounds: {maxSeq: number; maxUid: number}): {ok: boolean; next: number} {
  const token = tokens[index];
  if (token === "NOT") {
    const inner = searchTerm(message, tokens, index + 1, bounds);
    return {ok: !inner.ok, next: inner.next};
  } else if (token === "OR") {
    const left = searchTerm(message, tokens, index + 1, bounds);
    const right = searchTerm(message, tokens, left.next, bounds);
    return {ok: left.ok || right.ok, next: right.next};
  } else if (token === "(") {
    const inner = searchAnd(message, tokens, index + 1, bounds);
    return {ok: inner.ok, next: tokens[inner.next] === ")" ? inner.next + 1 : inner.next};
  } else if (token === ImapSearchCriterion.SEEN) {
    return {ok: message.seen, next: index + 1};
  } else if (token === ImapSearchCriterion.UNSEEN) {
    return {ok: !message.seen, next: index + 1};
  } else if (token === ImapSearchCriterion.DELETED) {
    return {ok: message.deleted, next: index + 1};
  } else if (token === ImapSearchCriterion.UNDELETED) {
    return {ok: !message.deleted, next: index + 1};
  } else if (token === ImapSearchCriterion.ALL) {
    return {ok: true, next: index + 1};
  } else if (token === ImapSearchCriterion.SINCE || token === ImapSearchCriterion.SENTSINCE) {
    const start = searchDateMillis(tokens[index + 1]);
    return {ok: start === null || messageStamp(message, token === ImapSearchCriterion.SENTSINCE) >= start, next: index + 2};
  } else if (token === ImapSearchCriterion.BEFORE || token === ImapSearchCriterion.SENTBEFORE) {
    const start = searchDateMillis(tokens[index + 1]);
    return {ok: start === null || messageStamp(message, token === ImapSearchCriterion.SENTBEFORE) < start, next: index + 2};
  } else if (token === ImapSearchCriterion.ON || token === ImapSearchCriterion.SENTON) {
    const start = searchDateMillis(tokens[index + 1]);
    const stamp = messageStamp(message, token === ImapSearchCriterion.SENTON);
    const end = start === null ? null : dateTimeFromMillis(start).plus({days: 1}).toMillis();
    return {ok: start === null || (stamp >= start && stamp < end), next: index + 2};
  } else if (token === "UID") {
    return {ok: sequenceMatches(message.uid, parseSequenceSet(tokens[index + 1] || ""), bounds.maxUid), next: index + 2};
  } else if (/^(\d+|\*)(:(\d+|\*))?(,(\d+|\*)(:(\d+|\*))?)*$/.test(token)) {
    return {ok: sequenceMatches(message.seq, parseSequenceSet(token), bounds.maxSeq), next: index + 1};
  } else {
    return {ok: true, next: index + 1};
  }
}

const IMAP_MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
};

function searchDateMillis(token: string): number | null {
  const match = token.match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/);
  const month = match ? IMAP_MONTHS[match[2]] : null;
  if (!match || !month) {
    return null;
  } else {
    return dateTimeFromObject({year: Number(match[3]), month, day: Number(match[1])}).startOf("day").toMillis();
  }
}

function messageStamp(message: MailClientImapMessage, sent: boolean): number {
  if (sent) {
    return message.message.sentAt ?? 0;
  } else {
    return message.message.receivedAt ?? message.message.sentAt ?? 0;
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

function listMailboxQuery(args: string): {reference: string; pattern: string} {
  const matchedTokens: string[] = args.match(/"(?:\\.|[^"\\])*"|[^\s]+/g) ?? [];
  const tokens = matchedTokens.filter(token => !token.startsWith("(") && token.toUpperCase() !== "RETURN");
  return {reference: unquote(tokens[0] || ""), pattern: unquote(tokens[1] || "")};
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

function loggedImapArgs(command: string, args: string): string | null {
  if (command === MailClientImapCommand.LOGIN || command === MailClientImapCommand.AUTHENTICATE) {
    return null;
  } else {
    return args.slice(0, 180);
  }
}

function loggedImapLine(line: string): string {
  const parsed = parseTagged(line);
  if (parsed && (parsed.command.toUpperCase() === MailClientImapCommand.LOGIN || parsed.command.toUpperCase() === MailClientImapCommand.AUTHENTICATE)) {
    return `${parsed.tag} ${parsed.command.toUpperCase()}`;
  } else {
    return line.slice(0, 180);
  }
}

function write(session: ImapSession, line: string): void {
  if (/^[^\s*+]+\s(?:OK|NO|BAD)\b/.test(line)) {
    sessionLog(session, `IMAP ${line}`);
  }
  session.socket.write(line + "\r\n");
}

function sessionLog(session: ImapSession, message: string, ...details: unknown[]): void {
  debugLog(`IMAP session=${session.id ?? "local"} ${message.replace(/^IMAP /, "")}`, ...details);
}
