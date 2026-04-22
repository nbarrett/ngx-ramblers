import crypto from "crypto";
import debug from "debug";
import { ConfigKey, ConfigDocument } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { MailConfig } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { systemConfig } from "../config/system-config";

const debugLog = debug(envConfig.logNamespace("brevo:inbound-webhook-config"));
debugLog.enabled = true;

export interface InboundWebhookConfig {
  webhookUrl: string;
  secret: string;
}

function newSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function deriveWebhookUrl(): Promise<string> {
  const sys = await systemConfig();
  const base = (sys?.group?.href || "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("System config group.href not set; cannot derive webhook URL");
  }
  return `${base}/api/cloudflare/email-routing/inbound-mime`;
}

export async function ensureInboundWebhookConfigured(): Promise<InboundWebhookConfig> {
  const doc = await config.queryKey(ConfigKey.BREVO) as ConfigDocument;
  const value: MailConfig = doc.value;
  const webhookUrl = await deriveWebhookUrl();
  if (value.inboundWebhookSecret) {
    debugLog("Inbound webhook already configured for %s", webhookUrl);
    return { webhookUrl, secret: value.inboundWebhookSecret };
  }
  const secret = newSecret();
  value.inboundWebhookSecret = secret;
  await config.createOrUpdateKey(ConfigKey.BREVO, value);
  debugLog("Generated new inbound webhook secret and saved to Brevo config");
  return { webhookUrl, secret };
}
