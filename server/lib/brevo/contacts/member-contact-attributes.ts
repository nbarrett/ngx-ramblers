import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { logBrevoError } from "../common/error-log";

const debugLog = debug(envConfig.logNamespace("brevo:member-contact-attributes"));
debugLog.enabled = true;

const MEMBER_CONTACT_ATTRIBUTES: string[] = ["MEMBER_NUM", "MEMBER_EXP", "USERNAME"];

let availableMemberAttributes: Set<string> | null = null;

async function configuredContactsApi(): Promise<SibApiV3Sdk.ContactsApi> {
  const brevoConfig = await configuredBrevo();
  const apiInstance = new SibApiV3Sdk.ContactsApi();
  apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
  return apiInstance;
}

export async function ensureMemberContactAttributes(): Promise<Set<string>> {
  if (availableMemberAttributes) {
    return availableMemberAttributes;
  }
  const available = new Set<string>();
  try {
    const apiInstance = await configuredContactsApi();
    const existing: { body: any } = await scheduleBrevo(() => apiInstance.getAttributes());
    const existingNames: string[] = (existing.body?.attributes ?? []).map((attribute: any) => attribute?.name);
    for (const attributeName of MEMBER_CONTACT_ATTRIBUTES) {
      if (existingNames.includes(attributeName)) {
        available.add(attributeName);
      } else {
        try {
          const createAttribute = new SibApiV3Sdk.CreateAttribute();
          createAttribute.type = SibApiV3Sdk.CreateAttribute.TypeEnum.Text;
          await scheduleBrevo(() => apiInstance.createAttribute("normal", attributeName, createAttribute));
          available.add(attributeName);
          debugLog("created Brevo contact attribute", attributeName);
        } catch (error: any) {
          logBrevoError("brevo:member-contact-attributes", error, {attributeName});
          debugLog("could not create Brevo contact attribute", attributeName, "- omitting it from contact sync", error?.body ?? error?.message ?? error);
        }
      }
    }
  } catch (error: any) {
    logBrevoError("brevo:member-contact-attributes", error);
    debugLog("could not resolve Brevo contact attributes - member attributes omitted from contact sync", error?.body ?? error?.message ?? error);
  }
  availableMemberAttributes = available;
  return available;
}

export function stripUnavailableMemberAttributes<T>(attributes: T, available: Set<string>): T {
  if (!attributes) {
    return attributes;
  }
  return Object.fromEntries(
    Object.entries(attributes as Record<string, any>)
      .filter(([key]) => !MEMBER_CONTACT_ATTRIBUTES.includes(key) || available.has(key))
  ) as T;
}
