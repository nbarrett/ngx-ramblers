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
}

export interface MailClientMimeMessage {
  raw: Buffer;
  root: MailClientMimePart;
}

export interface MailClientMimeFetch {
  label: string;
  content: Buffer | null;
}
