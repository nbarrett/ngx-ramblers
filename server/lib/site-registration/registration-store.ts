import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { Collection } from "mongodb";
import { RegistrationSettings, StoredSiteRegistration } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { siteRegistration, siteRegistrationConfig } from "../mongo/models/site-registration";


export function registrations(): Collection<StoredSiteRegistration> {
  return siteRegistration.collection as unknown as Collection<StoredSiteRegistration>;
}

export async function ensureRegistrationIndexes(): Promise<void> {
  await registrations().createIndex({"group.group_code": 1}, {unique: true});
  await registrations().createIndex({resumeTokenHash: 1}, {unique: true});
  await registrations().createIndex({state: 1, leaseUntil: 1});
}

export async function registrationSettings(): Promise<RegistrationSettings> {
  const saved = await siteRegistrationConfig.findOne({key: ConfigKey.SITE_REGISTRATION}).lean();
  const defaults: RegistrationSettings = {
    enabled: false, committeeEmailValidationEnabled: true, sourceFidelityValidationEnabled: true, publicUrl: "", senderEmail: "", reviewer: {firstName: "", lastName: "", email: ""},
    sourceEnvironmentName: "", approvedEmails: []
  };
  return saved?.value ? {...defaults, ...saved.value, reviewer: {...defaults.reviewer, ...saved.value.reviewer}, approvedEmails: saved.value.approvedEmails || []} : defaults;
}

export async function saveRegistrationSettings(settings: RegistrationSettings): Promise<void> {
  await siteRegistrationConfig.updateOne({key: ConfigKey.SITE_REGISTRATION}, {$set: {value: settings}}, {upsert: true});
}
