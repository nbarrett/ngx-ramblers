import { Socket } from "net";
import { CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxMessage, InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";

export enum MailClientMailboxAttribute {
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
  SPECIAL_USE = "SPECIAL-USE"
}

export interface MailClientMailbox {
  name: string;
  folder: InboxThreadFolder | null;
  userFolderId: string | null;
}

export interface MailClientImapMessage {
  uid: number;
  seq: number;
  message: InboxMessage;
  thread: InboxThread;
  seen: boolean;
  deleted: boolean;
}

export interface ImapSession {
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
  pending?: Promise<void>;
  literal?: ImapLiteral | null;
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
  SEEN = "SEEN",
  UNSEEN = "UNSEEN",
  DELETED = "DELETED",
  UNDELETED = "UNDELETED"
}

export interface ImapSequenceRange {
  from: number | null;
  to: number | null;
}

export interface MailClientAppendResult {
  uidValidity: number;
  uid: number;
}
