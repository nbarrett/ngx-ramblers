import { randomUUID } from "crypto";
import { isArray, isString, values } from "es-toolkit/compat";
import { REGISTRATION_ADMIN_HELP_PROMPT, RegistrationDraft, RegistrationEmailType, RegistrationHistoryAction, RegistrationPlan, RegistrationSettings, RegistrationSiteFlavour, RegistrationStartRequest, RegistrationStartResponse, RegistrationState, RegistrationStep, StoredSiteRegistration } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { dateTimeNowAsValue } from "../shared/dates";
import { fetchRamblersGroupsFromApi } from "../ramblers/list-groups";
import { findEnvironmentFromDatabase } from "../environments/environments-config";
import { ensureRegistrationIndexes, recordRegistrationHistory, registrations, registrationSettings } from "./registration-store";
import { assertRegistrationDraft, assertRegistrationEditable, normalisedRegistrationEmail, registrationEmailAllowed, registrationToken, registrationTokenHash, validRegistrationEmail } from "./registration-policy";
import { sendRegistrationEmail } from "../brevo/transactional-mail/send-site-registration-email";
import { HttpError } from "../shared/http-error";
import { stripTrailingSlash } from "../../../projects/ngx-ramblers/src/app/functions/strings";

export function registrationLink(settings: RegistrationSettings, token: string): string {
  return `${stripTrailingSlash(settings.publicUrl)}/register/${token}`;
}

export async function startRegistration(request: RegistrationStartRequest): Promise<RegistrationStartResponse> {
  const settings = await registrationSettings();
  const email = normalisedRegistrationEmail(request?.email);
  const groupCode = isString(request?.groupCode) ? request.groupCode.trim().toUpperCase() : "";
  const areaCode = isString(request?.areaCode) ? request.areaCode.trim().toUpperCase() : "";
  const code = groupCode || areaCode;
  const scope = groupCode ? "G" : "A";
  if (!settings.enabled) {
    throw new Error("Site registration is switched off on this site.");
  } else if (!values(RegistrationPlan).includes(request?.plan)) {
    throw new Error("Choose Lite or Full before continuing.");
  } else if (!code) {
    throw new Error("Choose your Ramblers area, and your group if you are registering one, before continuing.");
  } else if (!normalisedRegistrationEmail(request?.email) || !validRegistrationEmail(email)) {
    throw new Error("Enter a valid committee email address, such as secretary@yourgroup.org.uk.");
  } else if (!registrationEmailAllowed(settings, code, email)) {
    throw new Error(`That email address is not on the approved list for this group or area. Try another committee email address or ${REGISTRATION_ADMIN_HELP_PROMPT}.`);
  }
  const entries = await fetchRamblersGroupsFromApi([code]);
  const group = entries.find(candidate => candidate.group_code === code && candidate.scope === scope);
  if (!group) {
    throw new Error(`The selected ${groupCode ? "group" : "area"} could not be found in the Ramblers directory.`);
  }
  await ensureRegistrationIndexes();
  const now = dateTimeNowAsValue();
  const resumeToken = registrationToken();
  const existingRecord = await registrations().findOne({"group.group_code": group.group_code});
  const leftover = existingRecord && ![RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING, RegistrationState.APPROVING].includes(existingRecord.state)
    && !(existingRecord.environmentName && await findEnvironmentFromDatabase(existingRecord.environmentName));
  if (leftover) {
    await registrations().deleteOne({id: existingRecord.id});
  }
  const existing = leftover ? null : existingRecord;
  const message = "Check your committee inbox for the confirmation or return link.";
  if (existing && existing.email !== email) {
    throw new Error("This group or area already has a registration. Ask the platform administrator to help you resume it.");
  } else if (existing && now - existing.lastEmailAt < 60000) {
    return {message};
  } else {
    const initial: StoredSiteRegistration = {
      id: randomUUID(), group, email, plan: request.plan, currentStep: RegistrationStep.EMAIL,
      website: group.external_url || "", pages: [], proposedNavigation: [], state: RegistrationState.AWAITING_EMAIL,
      verifiedAt: null, createdAt: now, updatedAt: now,
      environmentName: group.group_code.toLowerCase(), siteUrl: null, flavour: RegistrationSiteFlavour.GENERIC,
      progress: [], error: null, resumeTokenHash: registrationTokenHash(resumeToken),
      verificationTokenHash: registrationTokenHash(resumeToken), verificationExpiresAt: now + 86400000,
      lastEmailAt: now, migrationConfig: null, provisionedAt: null, walksLoadedAt: null, importedAt: null, reviewedAt: null,
      reviewNotifiedAt: null, invitedAt: null, leaseUntil: 0, leaseOwner: null,
      history: [{action: RegistrationHistoryAction.STARTED, at: now, by: email}]
    };
    const saved = existing ? await registrations().findOneAndUpdate({id: existing.id, lastEmailAt: existing.lastEmailAt}, {
      $set: {resumeTokenHash: initial.resumeTokenHash, verificationTokenHash: initial.verificationTokenHash, verificationExpiresAt: initial.verificationExpiresAt, lastEmailAt: now}
    }, {returnDocument: "after"}) : await registrations().findOneAndUpdate({"group.group_code": group.group_code}, {$setOnInsert: initial}, {upsert: true, returnDocument: "after"});
    if (!saved || (!existing && saved.id !== initial.id)) {
      return {message};
    } else {
      try {
        await sendRegistrationLinkEmail(settings, group.name, email, resumeToken);
      } catch (error) {
        await registrations().updateOne({id: saved.id, lastEmailAt: now}, {$set: {lastEmailAt: 0}});
        throw error;
      }
      return {message, resumeToken};
    }
  }
}

async function sendRegistrationLinkEmail(settings: RegistrationSettings, groupName: string, email: string, token: string): Promise<void> {
  await sendRegistrationEmail(settings, RegistrationEmailType.CONFIRMATION, email, {
    groupName, actionUrl: `${stripTrailingSlash(settings.publicUrl)}/register/confirm/${token}`, returnUrl: registrationLink(settings, token)
  });
}

export async function emailRegistrationReturnLink(id: string, by: string): Promise<string> {
  const saved = await registrations().findOne({id, state: {$in: [RegistrationState.AWAITING_EMAIL, RegistrationState.DRAFT]}});
  if (!saved) {
    throw new Error("A return link can only be sent for a registration that has not been submitted yet.");
  } else {
    const settings = await registrationSettings();
    const token = registrationToken();
    const now = dateTimeNowAsValue();
    await registrations().updateOne({id: saved.id}, {$set: {
      resumeTokenHash: registrationTokenHash(token), verificationTokenHash: registrationTokenHash(token),
      verificationExpiresAt: now + 86400000, lastEmailAt: now, updatedAt: now
    }});
    await sendRegistrationLinkEmail(settings, saved.group.name, saved.email, token);
    await recordRegistrationHistory(saved.id, RegistrationHistoryAction.RETURN_LINK_SENT, by);
    return saved.email;
  }
}

export async function confirmRegistration(token: string): Promise<string> {
  const now = dateTimeNowAsValue();
  const saved = await registrations().findOneAndUpdate({verificationTokenHash: registrationTokenHash(token), verificationExpiresAt: {$gt: now}}, {
    $set: {verificationExpiresAt: 0, updatedAt: now}
  }, {returnDocument: "after"});
  if (!saved) {
    const confirmed = await registrations().findOne({resumeTokenHash: registrationTokenHash(token), verifiedAt: {$ne: null}});
    if (!confirmed) {
      throw new Error("This confirmation link has expired. Request another from registration.");
    }
  } else {
    if (!saved.verifiedAt) {
      await registrations().updateOne({id: saved.id, state: RegistrationState.AWAITING_EMAIL}, {$set: {
        verifiedAt: now, state: RegistrationState.DRAFT,
        currentStep: saved.plan === RegistrationPlan.LITE ? RegistrationStep.REVIEW : RegistrationStep.CONTENT
      }});
      await recordRegistrationHistory(saved.id, RegistrationHistoryAction.EMAIL_CONFIRMED, saved.email);
    }
  }
  return token;
}

export async function registrationForToken(token: string): Promise<StoredSiteRegistration> {
  const saved = isString(token) && /^[a-f0-9]{64}$/.test(token)
    ? await registrations().findOne({resumeTokenHash: registrationTokenHash(token)}) : null;
  if (!saved) {
    throw new HttpError(404, "Registration not found. Open the link in your confirmation email.");
  }
  return saved;
}

export async function saveRegistrationDraft(token: string, draft: RegistrationDraft): Promise<void> {
  const saved = await registrationForToken(token);
  assertRegistrationEditable(saved);
  assertRegistrationDraft(draft);
  if (!isString(draft.website) || !isArray(draft.pages) || draft.pages.length > 200) {
    throw new Error("Invalid content selection.");
  }
  const pages = saved.pages.map(page => ({...page, selected: true}));
  const proposedNavigation = saved.proposedNavigation;
  await registrations().updateOne({id: saved.id, state: RegistrationState.DRAFT}, {$set: {
    plan: draft.plan, currentStep: draft.currentStep, website: draft.website.trim(),
    pages: saved.website === draft.website.trim() ? pages : [],
    proposedNavigation: saved.website === draft.website.trim() ? proposedNavigation : [], updatedAt: dateTimeNowAsValue()
  }});
}
