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
  UID = "UID"
}

export enum MailClientImapAuth {
  PLAIN = "PLAIN"
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
  buffer: string;
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
