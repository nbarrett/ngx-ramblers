export interface MailClientMimeHeader {
  name: string;
  value: string;
  raw: string;
}

export interface MailClientMimePart {
  raw: Buffer;
  body: Buffer;
  headers: MailClientMimeHeader[];
  type: string;
  subtype: string;
  parameters: Record<string, string>;
  children: MailClientMimePart[];
  bodySize?: number;
  bodyLines?: number;
}

export interface MailClientMimeMessage {
  raw: Buffer;
  root: MailClientMimePart;
  size?: number;
}

export interface MailClientMimeFetch {
  label: string;
  content: Buffer | null;
}
import {InboxMessage} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";

export const RFC822_BODY_ESCAPES: Record<string, string> = {"&": "&amp;", "<": "&lt;", ">": "&gt;"};

export interface MailClientMessageMetadata extends InboxMessage {
  bodySizeBytes?: number;
  bodyLines?: number;
}
