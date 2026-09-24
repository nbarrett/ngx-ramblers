import { keys } from "es-toolkit/compat";
import { CommitteeConfig, CommitteeMember, InboxRoleRecipient } from "../models/committee.model";
import { emailDomain, emailLocalPart } from "./strings";
import { apexHost, hostFromUrl } from "./hosts";

export function ngxRamblersMailDomain(environmentName: string): string {
  return `${(environmentName || "").trim().toLowerCase()}.ngx-ramblers.org.uk`;
}

export function mailDomainForSiteHost(hostname: string): string {
  const host = hostFromUrl(hostname) || hostname.replace(/^https?:\/\//i, "").split("/")[0];
  return apexHost(host).toLowerCase();
}

export function replaceEmailDomain(email: string, oldDomain: string, newDomain: string): string {
  const trimmed = (email || "").trim();
  const from = (oldDomain || "").trim().toLowerCase();
  const to = mailDomainForSiteHost(newDomain);
  if (!trimmed || !from || !to || from === to) {
    return trimmed;
  } else if (emailDomain(trimmed) !== from) {
    return trimmed;
  } else {
    return `${emailLocalPart(trimmed)}@${to}`;
  }
}

function rewriteEmailList(emails: string[] | undefined, oldDomain: string, newDomain: string): string[] | undefined {
  if (!emails) {
    return emails;
  } else {
    return emails.map(email => replaceEmailDomain(email, oldDomain, newDomain));
  }
}

function rewriteInboxRecipients(recipients: InboxRoleRecipient[] | undefined, oldDomain: string, newDomain: string): InboxRoleRecipient[] | undefined {
  if (!recipients) {
    return recipients;
  } else {
    return recipients.map(recipient => ({
      ...recipient,
      email: recipient.email ? replaceEmailDomain(recipient.email, oldDomain, newDomain) : recipient.email
    }));
  }
}

export function rewriteCommitteeRoleMail(role: CommitteeMember, oldDomain: string, newDomain: string): CommitteeMember {
  return {
    ...role,
    email: replaceEmailDomain(role.email, oldDomain, newDomain),
    additionalEmails: rewriteEmailList(role.additionalEmails, oldDomain, newDomain),
    inboxNotificationEmail: role.inboxNotificationEmail
      ? replaceEmailDomain(role.inboxNotificationEmail, oldDomain, newDomain)
      : role.inboxNotificationEmail,
    forwardEmailCustom: role.forwardEmailCustom
      ? replaceEmailDomain(role.forwardEmailCustom, oldDomain, newDomain)
      : role.forwardEmailCustom,
    forwardEmailRecipients: rewriteEmailList(role.forwardEmailRecipients, oldDomain, newDomain),
    contactUsCustom: role.contactUsCustom
      ? replaceEmailDomain(role.contactUsCustom, oldDomain, newDomain)
      : role.contactUsCustom,
    contactUsRecipients: rewriteEmailList(role.contactUsRecipients, oldDomain, newDomain),
    inboxRecipients: rewriteInboxRecipients(role.inboxRecipients, oldDomain, newDomain)
  };
}

export function rewriteCommitteeMailAddresses(committee: CommitteeConfig, oldDomain: string, newDomain: string): CommitteeConfig {
  const roles = (committee?.roles || []).map(role => rewriteCommitteeRoleMail(role, oldDomain, newDomain));
  const contactUsEntries = committee?.contactUs
    ? keys(committee.contactUs).map(key => [key, rewriteCommitteeRoleMail(committee.contactUs[key], oldDomain, newDomain)] as const)
    : [];
  const contactUs = contactUsEntries.length
    ? contactUsEntries.reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as Record<string, CommitteeMember>)
    : committee?.contactUs;
  return { ...committee, roles, contactUs };
}

export function committeeMailboxDomains(committee: CommitteeConfig): string[] {
  const roles = committee?.roles || [];
  const domains = roles
    .map(role => emailDomain(role.email || ""))
    .filter(domain => !!domain);
  return domains.filter((domain, index) => domains.indexOf(domain) === index);
}

export function committeeMailRewriteCount(before: CommitteeConfig, after: CommitteeConfig): number {
  const beforeRoles = before?.roles || [];
  const afterRoles = after?.roles || [];
  return afterRoles.reduce((count, role, index) => {
    const previous = beforeRoles[index];
    if (!previous) {
      return count;
    } else if (previous.email !== role.email) {
      return count + 1;
    } else {
      return count;
    }
  }, 0);
}
