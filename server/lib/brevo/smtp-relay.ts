import debug from "debug";
import nodemailer, { Transporter } from "nodemailer";
import { envConfig } from "../env-config/env-config";
import { configuredBrevo } from "./brevo-config";
import { BREVO_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/mail.model";

const debugLog = debug(envConfig.logNamespace("brevo:smtp-relay"));
debugLog.enabled = true;

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey: string | null = null;

async function transporter(): Promise<Transporter> {
  const config = await configuredBrevo();
  const host = config.smtpServer || BREVO_DEFAULTS.SMTP_SERVER;
  const port = config.smtpPort || BREVO_DEFAULTS.SMTP_PORT;
  const user = config.smtpUser;
  const pass = config.smtpPassword;
  if (!user || !pass) {
    throw new Error("Brevo SMTP credentials not configured. Set smtpUser and smtpPassword in Mail config.");
  }
  const cacheKey = `${host}|${port}|${user}`;
  if (cachedTransporter && cachedTransporterKey === cacheKey) {
    return cachedTransporter;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  cachedTransporterKey = cacheKey;
  return cachedTransporter;
}

export interface RelayEnvelope {
  rawMime: Buffer;
  recipient: string;
  envelopeFrom: string;
  envelopeTo: string;
}

export async function keepaliveRecipient(): Promise<string | null> {
  const config = await configuredBrevo();
  return config.smtpKeepaliveRecipient?.trim() || config.smtpUser?.trim() || null;
}

export async function sendSmtpKeepalive(): Promise<string> {
  const tx = await transporter();
  const config = await configuredBrevo();
  const recipient = await keepaliveRecipient();
  if (!recipient) {
    throw new Error("No SMTP keepalive recipient configured and no SMTP Login to fall back to.");
  }
  const sender = config.smtpUser;
  debugLog("Sending SMTP keepalive probe to %s", recipient);
  const info = await tx.sendMail({
    from: sender,
    to: recipient,
    subject: "SMTP keepalive probe",
    text: "Automated monthly probe. It keeps the Brevo SMTP key active so inbound committee email continues to be relayed, and confirms the relay is still working. No action needed."
  });
  debugLog("SMTP keepalive accepted; messageId=%s response=%s", info.messageId, info.response);
  return recipient;
}

export async function relayRawMime(envelope: RelayEnvelope): Promise<void> {
  const tx = await transporter();
  debugLog("Relaying %d bytes via Brevo SMTP to %s", envelope.rawMime.length, envelope.recipient);
  const info = await tx.sendMail({
    raw: envelope.rawMime,
    envelope: {
      from: envelope.envelopeFrom,
      to: envelope.envelopeTo
    }
  });
  debugLog("SMTP send accepted; messageId=%s response=%s", info.messageId, info.response);
}
