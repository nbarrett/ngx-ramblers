import {MAIL_CLIENT_IMAP_PORT, MAIL_CLIENT_LOCAL_IMAP_PORT, MAIL_CLIENT_LOCAL_SMTP_PORT, MAIL_CLIENT_SMTP_PORT, MailClientConnectionSettings} from "../models/mail-client.model";

export function isLocalMailClientHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host.trim().toLowerCase());
}

export function mailClientSetupCopyText(connection: MailClientConnectionSettings, address: string, applicationPassword: string | null, hasStoredPasswords = false): string {
  const security = (secure: boolean) => secure ? "SSL/TLS" : "None";
  const passwordLine = {value: "Password: none created yet"};
  if (applicationPassword) {
    passwordLine.value = `Password: ${applicationPassword}`;
  } else if (hasStoredPasswords) {
    passwordLine.value = "Password: already created, cannot be shown again";
  }
  return [
    `Email address: ${address}`,
    passwordLine.value,
    "",
    "Incoming mail (IMAP)",
    `Hostname: ${connection.host}`,
    `Port: ${connection.imapPort}`,
    `Username: ${address}`,
    `Connection security: ${security(connection.imapSecure)}`,
    "",
    "Outgoing mail (SMTP)",
    `Hostname: ${connection.host}`,
    `Port: ${connection.smtpPort}`,
    `Username: ${address}`,
    `Connection security: ${security(connection.smtpSecure)}`
  ].join("\n");
}

export function mailClientConnectionForHost(settings: MailClientConnectionSettings, host: string): MailClientConnectionSettings {
  const local = isLocalMailClientHost(host);
  const configuredHost = host.trim().toLowerCase() === settings.host.trim().toLowerCase();
  return {
    ...settings,
    host,
    imapPort: local ? settings.localImapPort ?? MAIL_CLIENT_LOCAL_IMAP_PORT : configuredHost ? settings.imapPort : MAIL_CLIENT_IMAP_PORT,
    smtpPort: local ? settings.localSmtpPort ?? MAIL_CLIENT_LOCAL_SMTP_PORT : configuredHost ? settings.smtpPort : MAIL_CLIENT_SMTP_PORT,
    imapSecure: local ? false : configuredHost ? settings.imapSecure : true,
    smtpSecure: local ? false : configuredHost ? settings.smtpSecure : true
  };
}
