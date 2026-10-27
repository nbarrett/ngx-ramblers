import { AnyBulkWriteOperation, Document } from "mongodb";
import { InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

export interface MailClientUidState {
  uidValidity: number;
  uidNext: number;
}

export const IMAP_SHARED_FOLDER_ROLE = "";

export interface MailClientUidMailbox {
  tenantSlug: string;
  roleType: string;
  folder: InboxThreadFolder | null;
  userFolderId: string | null;
}

export interface MailClientUidMailboxRecord extends MailClientUidMailbox, MailClientUidState {
  _id: string;
  revision: number;
}

export interface MailClientUidMembership {
  _id: string;
  mailboxKey: string;
  threadId: string;
  messageId: string;
  uid: number;
  active: boolean;
}

export interface MailClientUidCounter {
  _id: string;
  value: number;
}

export interface MailClientUidDocument {
  _id?: {toString(): string} | string;
  threadId?: string;
}

export interface MailClientUidWriteContext {
  threadIds: string[];
  documentIds: string[];
  filters: Record<string, unknown>[];
  operations: AnyBulkWriteOperation<Document>[];
}
