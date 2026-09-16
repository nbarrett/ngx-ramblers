import { isArray, isBoolean, isString } from "es-toolkit/compat";
import { ComposerExternalRecipient } from "../models/email-composer.model";
import { RegistrationEmailApproval, RegistrationSettings } from "../models/site-registration.model";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PUBLIC_SITE_PATTERN = /^https:\/\/[^/]+$/;

export function validRegistrationEmail(email: string): boolean {
  return EMAIL_PATTERN.test(isString(email) ? email.trim().toLowerCase() : "");
}

export function approvalRecipients(entry: RegistrationEmailApproval): ComposerExternalRecipient[] {
  return (entry?.recipients || []).filter(recipient => validRegistrationEmail(recipient?.email));
}

export function approvalEmailAddresses(entry: RegistrationEmailApproval): string[] {
  return approvalRecipients(entry).map(recipient => recipient.email.trim().toLowerCase());
}

export function approvalRecipientNames(entry: RegistrationEmailApproval): string {
  return approvalRecipients(entry).map(recipient => (recipient.name || "").trim() || recipient.email).join(", ");
}

export function approvalCode(entry: Pick<RegistrationEmailApproval, "areaCode" | "groupCode">): string {
  return ((entry?.groupCode || "").trim() || (entry?.areaCode || "").trim()).toUpperCase();
}

export function approvalGroupLabel(entry: RegistrationEmailApproval): string {
  const name = (entry.groupName || "").trim();
  const code = (entry.groupCode || "").trim();
  if (!code) {
    return "Whole area";
  } else {
    return name ? `${name} (${code})` : code;
  }
}

export function approvalAreaLabel(entry: RegistrationEmailApproval): string {
  const name = (entry.areaName || "").trim();
  const code = (entry.areaCode || "").trim();
  if (name && code) {
    return `${name} (${code})`;
  } else {
    return name || code;
  }
}

export function normalisedRegistrationPublicUrl(value: string): string {
  if (!isString(value) || !value.trim()) {
    return "";
  } else {
    try {
      const url = new URL(value.trim());
      return url.protocol === "https:" && !url.username && !url.password ? `https://${url.host}` : value.trim();
    } catch {
      return value.trim();
    }
  }
}

export function registrationEnableProblems(settings: RegistrationSettings): string[] {
  return [
    {ok: PUBLIC_SITE_PATTERN.test(normalisedRegistrationPublicUrl(settings?.publicUrl || "")), message: "Public registration website must be the https address of this site and nothing more, such as https://www.ngx-ramblers.org.uk."},
    {ok: !!settings?.sourceEnvironmentName?.trim(), message: "Choose an NGX setup template."},
    {ok: validRegistrationEmail(settings?.senderEmail), message: "Email address used to send messages must be a valid email address."},
    {ok: !!settings?.reviewer?.firstName?.trim() && !!settings?.reviewer?.lastName?.trim(), message: "Enter the reviewer's first name and last name."},
    {ok: validRegistrationEmail(settings?.reviewer?.email), message: "Reviewer's email must be a valid email address."}
  ].filter(item => !item.ok).map(item => item.message);
}

export function registrationSettingsProblem(settings: RegistrationSettings): string {
  const validFieldTypes = isBoolean(settings?.enabled) && isBoolean(settings?.committeeEmailValidationEnabled) && isBoolean(settings?.sourceFidelityValidationEnabled) &&
    isString(settings?.publicUrl) && isString(settings?.senderEmail) && isString(settings?.reviewer?.firstName) &&
    isString(settings?.reviewer?.lastName) && isString(settings?.reviewer?.email) && isString(settings?.sourceEnvironmentName);
  if (!validFieldTypes) {
    return "Registration settings arrived in an unexpected shape. Reload the page and try again.";
  } else if (!isArray(settings?.approvedEmails) || !settings.approvedEmails.every(entry => !!approvalCode(entry) && isArray(entry.recipients))) {
    return "Each approved email entry needs a group code and a list of addresses.";
  } else if (!settings.approvedEmails.every(entry => entry.recipients.every(recipient => validRegistrationEmail(recipient?.email)))) {
    const offending = settings.approvedEmails.find(entry => !entry.recipients.every(recipient => validRegistrationEmail(recipient?.email)));
    return `The approved email list for ${approvalCode(offending)} contains an address that is not a valid email address.`;
  } else if (settings.enabled !== true) {
    return "";
  } else {
    return registrationEnableProblems(settings)[0] || "";
  }
}

export function validRegistrationSettings(settings: RegistrationSettings): boolean {
  return !registrationSettingsProblem(settings);
}
