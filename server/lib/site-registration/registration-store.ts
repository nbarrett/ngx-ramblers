import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { Collection } from "mongodb";
import { Model } from "mongoose";
import { RegistrationHistoryAction, RegistrationSettings, StoredSiteRegistration } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { dateTimeNowAsValue } from "../shared/dates";
import { siteRegistration, siteRegistrationConfig } from "../mongo/models/site-registration";
import { ensureCollectionIndexes } from "../mongo/utils/collection-indexes";


export function registrations(): Collection<StoredSiteRegistration> {
  return siteRegistration.collection as unknown as Collection<StoredSiteRegistration>;
}

export async function recordRegistrationHistory(id: string, action: RegistrationHistoryAction, by: string): Promise<void> {
  await registrations().updateOne({id}, {$push: {history: {action, at: dateTimeNowAsValue(), by}}});
}

export async function ensureRegistrationIndexes(): Promise<void> {
  await ensureCollectionIndexes(siteRegistration as Model<unknown>, true);
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

export async function deleteRegistrationsForEnvironment(environmentName: string): Promise<number> {
  if (!environmentName) {
    return 0;
  } else {
    const result = await registrations().deleteMany({environmentName});
    return result.deletedCount || 0;
  }
}
