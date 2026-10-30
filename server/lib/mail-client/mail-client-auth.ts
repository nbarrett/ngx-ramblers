import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeMember, roleEmailAddresses, roleMatchesEmail } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { MailConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { committeeRolesHeldByMemberId } from "../../../projects/ngx-ramblers/src/app/functions/committee-members";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { systemConfig } from "../config/system-config";
import { MAIL_CLIENT_IMAP_PORT, MAIL_CLIENT_SMTP_PORT, MailClientConnectionSettings } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { stripTrailingSlash } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { isLocalMailClientHost } from "../../../projects/ngx-ramblers/src/app/functions/mail-client-connection";
import { imapListenPort, smtpSubmissionPort } from "./mail-client-ports";

export async function mailClientAccessEnabled(): Promise<boolean> {
  const mailConfig = (await config.queryKey(ConfigKey.BREVO))?.value as MailConfig | null;
  return mailConfig?.allowMailClientAccess === true;
}

export async function committeeRolesForMember(member: Member): Promise<CommitteeMember[]> {
  const committeeConfig = (await config.queryKey(ConfigKey.COMMITTEE))?.value as CommitteeConfig | null;
  return committeeRolesHeldByMemberId(committeeConfig?.roles ?? [], member.id ?? member.memberId ?? null)
    .filter(role => !role.vacant && Boolean(role.email));
}

export function allowedFromAddresses(roles: CommitteeMember[]): string[] {
  return roles.flatMap(role => roleEmailAddresses(role)).map(normaliseEmail).filter(Boolean);
}

export function roleMatchingFrom(roles: CommitteeMember[], fromEmail: string): CommitteeMember | null {
  const wanted = normaliseEmail(fromEmail);
  return roles.find(role => roleMatchesEmail(role, wanted)) ?? null;
}

export async function connectionSettingsFor(member: Member): Promise<MailClientConnectionSettings> {
  const enabled = await mailClientAccessEnabled();
  const roles = await committeeRolesForMember(member);
  const href = stripTrailingSlash(((await systemConfig())?.group?.href || "").trim());
  const flyAppName = process.env[Environment.FLY_APP_NAME]?.trim();
  const host = hostFromHref(href) || (flyAppName ? `${flyAppName}.fly.dev` : "localhost");
  const localConnection = isLocalMailClientHost(host);
  return {
    enabled,
    host,
    smtpPort: localConnection ? smtpSubmissionPort() : MAIL_CLIENT_SMTP_PORT,
    imapPort: localConnection ? imapListenPort() : MAIL_CLIENT_IMAP_PORT,
    smtpSecure: !localConnection,
    imapSecure: !localConnection,
    usernameHint: allowedFromAddresses(roles)[0] || member.userName || "",
    localImapPort: imapListenPort(),
    localSmtpPort: smtpSubmissionPort(),
    allowedFromAddresses: allowedFromAddresses(roles)
  };
}

function hostFromHref(href: string): string {
  try {
    return href ? new URL(href.includes("://") ? href : `https://${href}`).hostname : "";
  } catch {
    return "";
  }
}
