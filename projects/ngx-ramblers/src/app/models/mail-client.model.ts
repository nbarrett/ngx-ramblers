import { Identifiable } from "./api-response.model";

export enum MailClientProtocol {
  SMTP = "smtp",
  IMAP = "imap"
}

export const MAIL_CLIENT_LOCAL_SMTP_PORT = 1587;
export const MAIL_CLIENT_LOCAL_IMAP_PORT = 1993;
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
  localSmtpPort?: number;
  localImapPort?: number;
}

export interface MailClientCreateCredentialRequest {
  label?: string;
}

export enum MailClientSetupApp {
  APPLE_MAIL = "apple-mail",
  IOS_MAIL = "ios-mail",
  THUNDERBIRD = "thunderbird"
}

export enum MailClientCredentialColumn {
  LABEL = "label",
  CREATED_AT = "createdAt",
  LAST_USED_AT = "lastUsedAt",
  ACTIONS = "actions"
}

export enum MailClientSetupPlatform {
  MAC = "mac",
  WINDOWS = "windows",
  IOS = "ios",
  OTHER = "other"
}
