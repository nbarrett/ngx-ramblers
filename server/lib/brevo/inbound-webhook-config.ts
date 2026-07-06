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

async function deriveWebhookUrl(inboundPath: string): Promise<string> {
  const sys = await systemConfig();
  const base = (sys?.group?.href || "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("System config group.href not set; cannot derive webhook URL");
  }
  return `${base}/api/cloudflare/email-routing/${inboundPath}`;
}

async function ensureInboundSecret(): Promise<string> {
  const doc = await config.queryKey(ConfigKey.BREVO) as ConfigDocument;
  const value: MailConfig = doc.value;
  if (value.inboundWebhookSecret) {
    return value.inboundWebhookSecret;
  }
  const secret = newSecret();
  value.inboundWebhookSecret = secret;
  await config.createOrUpdateKey(ConfigKey.BREVO, value);
  debugLog("Generated new inbound webhook secret and saved to Brevo config");
  return secret;
}

export async function ensureInboundWebhookConfigured(): Promise<InboundWebhookConfig> {
  const secret = await ensureInboundSecret();
  const webhookUrl = await deriveWebhookUrl("inbound-mime");
  debugLog("Brevo re-send inbound webhook configured for %s", webhookUrl);
  return { webhookUrl, secret };
}

export async function ensureInboundInboxWebhookConfigured(): Promise<InboundWebhookConfig> {
  const secret = await ensureInboundSecret();
  const webhookUrl = await deriveWebhookUrl("inbound-inbox");
  debugLog("Direct-to-inbox webhook configured for %s", webhookUrl);
  return { webhookUrl, secret };
}
