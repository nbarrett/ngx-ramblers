import { toPairs } from "es-toolkit/compat";
import { BrevoClient, BrevoError } from "@getbrevo/brevo";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { logBrevoError } from "../common/error-log";

const debugLog = debug(envConfig.logNamespace("brevo:member-contact-attributes"));
debugLog.enabled = true;

function errorDetail(error: unknown): unknown {
  if (error instanceof BrevoError) {
    return error.body ?? error.message;
  }
  return error instanceof Error ? error.message : error;
}

const MEMBER_CONTACT_ATTRIBUTES: string[] = ["MEMBER_NUM", "MEMBER_EXP", "USERNAME"];

let availableMemberAttributes: Set<string> | null = null;

export async function ensureMemberContactAttributes(): Promise<Set<string>> {
  if (availableMemberAttributes) {
    return availableMemberAttributes;
  }
  const available = new Set<string>();
  try {
    const client: BrevoClient = await brevoClient();
    const existing = await scheduleBrevo(() => client.contacts.getAttributes());
    const existingNames = (existing.attributes ?? []).map(attribute => attribute.name);
    for (const attributeName of MEMBER_CONTACT_ATTRIBUTES) {
      if (existingNames.includes(attributeName)) {
        available.add(attributeName);
      } else {
        try {
          await scheduleBrevo(() => client.contacts.createAttribute({attributeCategory: "normal", attributeName, type: "text"}));
          available.add(attributeName);
          debugLog("created Brevo contact attribute", attributeName);
        } catch (error) {
          logBrevoError("brevo:member-contact-attributes", error, {attributeName});
          debugLog("could not create Brevo contact attribute", attributeName, "- omitting it from contact sync", errorDetail(error));
        }
      }
    }
  } catch (error) {
    logBrevoError("brevo:member-contact-attributes", error);
    debugLog("could not resolve Brevo contact attributes - member attributes omitted from contact sync", errorDetail(error));
  }
  availableMemberAttributes = available;
  return available;
}

export function stripUnavailableMemberAttributes<T>(attributes: T, available: Set<string>): T {
  if (!attributes) {
    return attributes;
  }
  return Object.fromEntries(
    toPairs(attributes as Record<string, any>)
      .filter(([key]) => !MEMBER_CONTACT_ATTRIBUTES.includes(key) || available.has(key))
  ) as T;
}
