import { MailClientMessageMetadata } from "./mail-client-mime.model";
import { Socket } from "net";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";

export enum MailClientMailboxAttribute {
  INBOX = "\\Inbox",
  SENT = "\\Sent",
  DRAFTS = "\\Drafts",
  JUNK = "\\Junk",
  TRASH = "\\Trash"
}

export enum MailClientImapCommand {
  AUTHENTICATE = "AUTHENTICATE",
  CAPABILITY = "CAPABILITY",
  CHECK = "CHECK",
  CLOSE = "CLOSE",
  DONE = "DONE",
  ENABLE = "ENABLE",
  EXAMINE = "EXAMINE",
  EXPUNGE = "EXPUNGE",
  FETCH = "FETCH",
  IDLE = "IDLE",
  LIST = "LIST",
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  LSUB = "LSUB",
  NAMESPACE = "NAMESPACE",
  NOOP = "NOOP",
  SEARCH = "SEARCH",
  SELECT = "SELECT",
  STATUS = "STATUS",
  STORE = "STORE",
  UID = "UID",
  APPEND = "APPEND",
  CREATE = "CREATE",
  COPY = "COPY",
  MOVE = "MOVE",
  RENAME = "RENAME",
  DELETE = "DELETE",
  ID = "ID",
  SUBSCRIBE = "SUBSCRIBE",
  UNSUBSCRIBE = "UNSUBSCRIBE"
}

export enum MailClientImapAuth {
  PLAIN = "PLAIN"
}

export enum MailClientImapCapability {
  IMAP4REV1 = "IMAP4rev1",
  UIDPLUS = "UIDPLUS",
  SPECIAL_USE = "SPECIAL-USE",
  ESEARCH = "ESEARCH"
}

export enum ImapSearchReturnOption {
  ALL = "ALL",
  COUNT = "COUNT",
  MAX = "MAX",
  MIN = "MIN"
}

export interface MailClientMailbox {
  name: string;
  folder: InboxThreadFolder | null;
  userFolderId: string | null;
}

export interface MailClientImapMessage {
  uid: number;
  seq: number;
  message: MailClientMessageMetadata;
  thread: InboxThread;
  seen: boolean;
  deleted: boolean;
}

export interface MailClientMailboxSnapshot {
  revision: number;
  uidValidity: number;
  messages: Promise<MailClientImapMessage[]>;
}

export interface ImapSession {
  id?: string;
  socket: Socket;
  incoming: Buffer;
  member: Member | null;
  username: string;
  role: CommitteeMember | null;
  mailboxes: MailClientMailbox[];
  selected: MailClientMailbox | null;
  messages: MailClientImapMessage[];
  idleTag: string | null;
  authenticationTag?: string | null;
  readOnly?: boolean;
  idleTimer?: ReturnType<typeof setInterval> | null;
  idleRefreshPending?: boolean;
  pending?: Promise<void>;
  literal?: ImapLiteral | null;
  commandLiteral?: {line: string; remaining: number; chunks: Buffer[]; plus: boolean} | null;
  commands?: string[];
  commandBusy?: boolean;
}

export interface ImapLiteral {
  tag: string;
  mailbox: string;
  flags: string[];
  remaining: number;
  chunks: Buffer[];
  plus: boolean;
}

export enum ImapSearchCriterion {
  ALL = "ALL",
  BEFORE = "BEFORE",
  DELETED = "DELETED",
  ON = "ON",
  SEEN = "SEEN",
  SENTBEFORE = "SENTBEFORE",
  SENTON = "SENTON",
  SENTSINCE = "SENTSINCE",
  SINCE = "SINCE",
  UNDELETED = "UNDELETED",
  UNSEEN = "UNSEEN"
}

export interface ImapSequenceRange {
  from: number | null;
  to: number | null;
}

export interface MailClientAppendResult {
  uidValidity: number;
  uid: number;
}
