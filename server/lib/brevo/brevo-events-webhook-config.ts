import crypto from "crypto";
import debug from "debug";
import { ConfigKey, ConfigDocument } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { MailConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { systemConfig } from "../config/system-config";

const debugLog = debug(envConfig.logNamespace("brevo:events-webhook-config"));
debugLog.enabled = true;

export interface BrevoEventsWebhookConfig {
  webhookUrl: string;
  secret: string;
}

function newSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function deriveWebhookUrl(secret: string): Promise<string> {
  const sys = await systemConfig();
  const base = (sys?.group?.href || "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("System config group.href not set; cannot derive webhook URL");
  }
  return `${base}/api/mail/webhooks/brevo-events?token=${secret}`;
}

export async function ensureBrevoEventsWebhookConfigured(): Promise<BrevoEventsWebhookConfig> {
  const doc = await config.queryKey(ConfigKey.BREVO) as ConfigDocument;
  const value: MailConfig = doc.value;
  if (value.brevoEventsWebhookSecret) {
    const webhookUrl = await deriveWebhookUrl(value.brevoEventsWebhookSecret);
    debugLog("Brevo events webhook already configured");
    return { webhookUrl, secret: value.brevoEventsWebhookSecret };
  }
  const secret = newSecret();
  value.brevoEventsWebhookSecret = secret;
  await config.createOrUpdateKey(ConfigKey.BREVO, value);
  const webhookUrl = await deriveWebhookUrl(secret);
  debugLog("Generated new Brevo events webhook secret and saved to Brevo config");
  return { webhookUrl, secret };
}

export async function readBrevoEventsWebhookSecret(): Promise<string | undefined> {
  const doc = await config.queryKey(ConfigKey.BREVO) as ConfigDocument;
  const value: MailConfig = doc.value;
  return value?.brevoEventsWebhookSecret;
}
