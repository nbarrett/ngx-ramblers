import { Identifiable } from "./api-response.model";

export enum MailClientProtocol {
  SMTP = "smtp",
  IMAP = "imap"
}

export const MAIL_CLIENT_SMTP_PORT = 465;
export const MAIL_CLIENT_IMAP_PORT = 993;
export const MAIL_CLIENT_MAX_RECIPIENTS = 20;
export const MAIL_CLIENT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAIL_CLIENT_MAX_SENDS_PER_HOUR = 30;

export interface MailClientCredential extends Identifiable {
  memberId: string;
  label: string;
  secretHash: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

export interface MailClientCredentialView {
  id: string;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface MailClientCredentialCreated {
  credential: MailClientCredentialView;
  secret: string;
}

export interface MailClientConnectionSettings {
  enabled: boolean;
  host: string;
  smtpPort: number;
  imapPort: number;
  smtpSecure: boolean;
  imapSecure: boolean;
  usernameHint: string;
  allowedFromAddresses: string[];
}

export interface MailClientCreateCredentialRequest {
  label?: string;
}
