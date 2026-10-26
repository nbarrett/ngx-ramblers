import debug from "debug";
import nodemailer, { Transporter } from "nodemailer";
import { envConfig } from "../env-config/env-config";
import { configuredBrevo } from "./brevo-config";
import { fetchBrevoAccount } from "./account/account";
import { BREVO_DEFAULTS, MailConfig, SmtpAuthIdentity } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { uniq } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("brevo:smtp-relay"));
debugLog.enabled = true;

const transporters = new Map<string, Transporter>();

function smtpHostPort(config: MailConfig): {host: string; port: number} {
  return {
    host: config.smtpServer || BREVO_DEFAULTS.SMTP_SERVER,
    port: config.smtpPort || BREVO_DEFAULTS.SMTP_PORT
  };
}

function transporterFor(host: string, port: number, user: string, pass: string): Transporter {
  const cacheKey = `${host}|${port}|${user}|${pass}`;
  const cached = transporters.get(cacheKey);
  if (cached) {
    return cached;
  } else {
    const created = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {user, pass}
    });
    transporters.set(cacheKey, created);
    return created;
  }
}

async function transporter(): Promise<Transporter> {
  const config = await configuredBrevo();
  const {host, port} = smtpHostPort(config);
  const user = config.smtpUser;
  const pass = config.smtpPassword;
  if (!user || !pass) {
    throw new Error("Brevo SMTP credentials not configured. Set smtpUser and smtpPassword in Mail config.");
  } else {
    return transporterFor(host, port, user, pass);
  }
}

function uniqueNonEmpty(values: (string | null | undefined)[]): string[] {
  return uniq(values.map(value => value?.trim()).filter((value): value is string => !!value));
}

export async function smtpKeepaliveAuths(): Promise<SmtpAuthIdentity[]> {
  const config = await configuredBrevo();
  const passwords = uniqueNonEmpty([config.smtpPassword, config.smtpPasswordSecondary]);
  if (passwords.length === 0) {
    return [];
  } else {
    const accountLogins = await smtpLoginsFromBrevoAccount();
    const users = uniqueNonEmpty([config.smtpUser, ...accountLogins]);
    return passwords.flatMap(pass => users.map(user => ({user, pass})));
  }
}

async function smtpLoginsFromBrevoAccount(): Promise<string[]> {
  try {
    const account = await fetchBrevoAccount();
    return uniqueNonEmpty([account.relay?.data?.userName, account.email]);
  } catch (error: any) {
    debugLog("Could not load Brevo account SMTP login for keepalive:", error?.message || error);
    return [];
  }
}

export interface RelayEnvelope {
  rawMime: Buffer;
  recipient: string;
  envelopeFrom: string;
  envelopeTo: string;
}

export async function keepaliveRecipient(): Promise<string | null> {
  const config = await configuredBrevo();
  if (config.smtpKeepaliveRecipient?.trim()) {
    return config.smtpKeepaliveRecipient.trim();
  } else {
    const auths = await smtpKeepaliveAuths();
    return auths[0]?.user || config.smtpUser?.trim() || null;
  }
}

export async function sendSmtpKeepalive(): Promise<string> {
  const config = await configuredBrevo();
  const {host, port} = smtpHostPort(config);
  const auths = await smtpKeepaliveAuths();
  const recipient = auths.length === 0 ? null : await keepaliveRecipient();
  if (auths.length === 0) {
    throw new Error("Brevo SMTP credentials not configured. Set SMTP Login and SMTP Key in Mail Settings.");
  } else if (!recipient) {
    throw new Error("No SMTP keepalive recipient configured and no SMTP Login to fall back to.");
  } else {
    const failures: string[] = [];
    const acceptedPasswords = new Set<string>();
    await Promise.all(auths.map(async (auth) => {
      try {
        const tx = transporterFor(host, port, auth.user, auth.pass);
        debugLog("Sending SMTP keepalive probe as %s to %s", auth.user, recipient);
        const info = await tx.sendMail({
          from: auth.user,
          to: recipient,
          subject: "SMTP keepalive probe",
          text: "Automated monthly probe. It keeps the Brevo SMTP key active so inbound committee email continues to be relayed, and confirms the relay is still working. No action needed."
        });
        acceptedPasswords.add(auth.pass);
        debugLog("SMTP keepalive accepted for %s; messageId=%s response=%s", auth.user, info.messageId, info.response);
      } catch (error: any) {
        const detail = error?.message || `${error}`;
        failures.push(`${auth.user}: ${detail}`);
        debugLog("SMTP keepalive failed for %s:", auth.user, detail);
      }
    }));
    if (acceptedPasswords.size !== uniqueNonEmpty(auths.map(auth => auth.pass)).length) {
      throw new Error(`SMTP keepalive failed for one or more configured keys (${failures.join("; ")})`);
    } else {
      return recipient;
    }
  }
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
