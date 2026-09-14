import { isArray, isBoolean, isString } from "es-toolkit/compat";
import { RegistrationSettings } from "../models/site-registration.model";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PUBLIC_SITE_PATTERN = /^https:\/\/[^/]+$/;

export function validRegistrationEmail(email: string): boolean {
  return EMAIL_PATTERN.test(isString(email) ? email.trim().toLowerCase() : "");
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
  } else if (!isArray(settings?.approvedEmails) || !settings.approvedEmails.every(entry => isString(entry.groupCode) && isArray(entry.emails))) {
    return "Each approved email entry needs a group code and a list of addresses.";
  } else if (!settings.approvedEmails.every(entry => entry.emails.every(email => isString(email) && EMAIL_PATTERN.test(email)))) {
    const offending = settings.approvedEmails.find(entry => !entry.emails.every(email => isString(email) && EMAIL_PATTERN.test(email)));
    return `The approved email list for ${offending.groupCode} contains an address that is not a valid email address.`;
  } else if (settings.enabled !== true) {
    return "";
  } else {
    return registrationEnableProblems(settings)[0] || "";
  }
}

export function validRegistrationSettings(settings: RegistrationSettings): boolean {
  return !registrationSettingsProblem(settings);
}
