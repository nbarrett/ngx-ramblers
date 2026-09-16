import { Request } from "express";
import { RegistrationSettings } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { Member, MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { normalisedRegistrationPublicUrl } from "../../../projects/ngx-ramblers/src/app/functions/registration-settings";
import { envConfig } from "../env-config/env-config";
import { parseMongoUri } from "../shared/mongodb-uri";
import { systemConfig } from "../config/system-config";
import { getDefaultSender } from "../brevo/templates/template-management";
import { member } from "../mongo/models/member";
import { environmentDetails } from "../environment-setup/environment-details";

export function currentRegistrationEnvironmentName(): string {
  const database = parseMongoUri(envConfig.mongo().uri)?.database || "";
  return database.replace(/^ngx-ramblers-/, "") || database;
}

async function signedInReviewer(req: Request): Promise<{firstName: string; lastName: string; email: string}> {
  const cookie = req.user as MemberCookie;
  const stored = cookie?.memberId ? await member.findById(cookie.memberId).lean() as Member : null;
  const source = stored || cookie;
  return {
    firstName: (source?.firstName || "").trim(),
    lastName: (source?.lastName || "").trim(),
    email: ((stored?.email || "") as string).trim().toLowerCase()
  };
}

export async function preparedRegistrationSettings(req: Request): Promise<{settings: RegistrationSettings; enableProblem: string}> {
  const reviewer = await signedInReviewer(req);
  const system = await systemConfig();
  const sender = await getDefaultSender();
  const source = await environmentDetails(currentRegistrationEnvironmentName()).catch(() => null);
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  const publicUrl = normalisedRegistrationPublicUrl(system?.group?.href) || normalisedRegistrationPublicUrl(`https://${host}`);
  const approvedEmails = (req.body?.approvedEmails || []).map(entry => {
    const recipients = (entry.recipients || []).map(recipient => ({
      email: (recipient.email || "").trim().toLowerCase(),
      name: (recipient.name || "").trim()
    })).filter(recipient => recipient.email);
    return {
      areaCode: (entry.areaCode || "").trim().toUpperCase(),
      areaName: (entry.areaName || "").trim(),
      groupCode: entry.groupCode.trim().toUpperCase(),
      groupName: (entry.groupName || "").trim(),
      recipients
    };
  });
  const settings: RegistrationSettings = {
    enabled: req.body?.enabled === true,
    committeeEmailValidationEnabled: req.body?.committeeEmailValidationEnabled !== false,
    sourceFidelityValidationEnabled: req.body?.sourceFidelityValidationEnabled !== false,
    publicUrl,
    senderEmail: (sender?.email || "").trim().toLowerCase(),
    sourceEnvironmentName: currentRegistrationEnvironmentName(),
    reviewer,
    approvedEmails
  };
  const enableProblem = !settings.publicUrl ? "This site has no https address in System settings, so confirmation emails cannot include a return link."
    : !settings.sourceEnvironmentName ? "This site is not listed as an environment, so a new group site cannot be created."
    : !settings.senderEmail ? "Mail Settings has no verified sender, so registration emails cannot be sent."
    : !settings.reviewer.email
      ? "Your contact details have no email address. Add one under Admin → Profile → Contact details, then try again."
    : !system?.national?.walksManager?.apiKey
      ? "Walks Manager has no API key, so a new group site cannot be created."
    : !source?.serviceConfigs?.mongodb?.cluster || !source?.serviceConfigs?.mongodb?.username || !source?.serviceConfigs?.mongodb?.password
      ? "This environment has no MongoDB cluster user, so a database user cannot be created for a new group."
    : !source?.serviceConfigs?.flyio?.personalAccessToken
      ? "This environment has no Fly token, so a new group site cannot be created."
      : "";
  return {settings: {...settings, enabled: settings.enabled && !enableProblem}, enableProblem};
}
