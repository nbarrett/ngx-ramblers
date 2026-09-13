import { createHash, randomBytes } from "crypto";
import { isString, values } from "es-toolkit/compat";
import {
  RegistrationDraft, RegistrationPlan, RegistrationSettings, RegistrationState, RegistrationStep,
  SiteRegistration, StoredSiteRegistration
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { validRegistrationEmail as sharedValidRegistrationEmail, registrationSettingsProblem as sharedRegistrationSettingsProblem, validRegistrationSettings as sharedValidRegistrationSettings } from "../../../projects/ngx-ramblers/src/app/functions/registration-settings";

export const validRegistrationEmail = sharedValidRegistrationEmail;
export const registrationSettingsProblem = sharedRegistrationSettingsProblem;
export const validRegistrationSettings = sharedValidRegistrationSettings;

export function registrationToken(): string {
  return randomBytes(32).toString("hex");
}

export function registrationTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalisedRegistrationEmail(value: unknown): string {
  return isString(value) ? value.trim().toLowerCase() : "";
}

export function registrationEmailAllowed(settings: RegistrationSettings, groupCode: string, email: string): boolean {
  const normalisedGroupCode = groupCode.trim().toUpperCase();
  const normalisedEmail = normalisedRegistrationEmail(email);
  return validRegistrationEmail(normalisedEmail) && (settings.committeeEmailValidationEnabled === false || settings.approvedEmails.some(entry => entry.groupCode.trim().toUpperCase() === normalisedGroupCode &&
    entry.emails.some(approved => normalisedRegistrationEmail(approved) === normalisedEmail)));
}

export function assertRegistrationEditable(registration: SiteRegistration): void {
  if (!registration.verifiedAt || registration.state !== RegistrationState.DRAFT) {
    throw new Error("Confirm your email before editing an unfinished registration.");
  }
}

export function assertRegistrationDraft(draft: RegistrationDraft): void {
  if (!values(RegistrationPlan).includes(draft.plan) || !values(RegistrationStep).includes(draft.currentStep)) {
    throw new Error("Choose a valid plan and registration step.");
  }
}

export function publicRegistration(registration: StoredSiteRegistration): SiteRegistration {
  return {
    id: registration.id, group: registration.group, email: registration.email, plan: registration.plan,
    currentStep: registration.currentStep, website: registration.website, pages: registration.pages,
    proposedNavigation: registration.proposedNavigation,
    state: registration.state, verifiedAt: registration.verifiedAt, createdAt: registration.createdAt,
    updatedAt: registration.updatedAt, environmentName: registration.environmentName,
    siteUrl: registration.siteUrl, flavour: registration.flavour, progress: registration.progress,
    error: registration.error
  };
}
