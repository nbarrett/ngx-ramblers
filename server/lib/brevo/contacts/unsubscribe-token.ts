import crypto from "crypto";
import debug from "debug";
import { ConfigKey, ConfigDocument } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { MailConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { envConfig } from "../../env-config/env-config";
import * as config from "../../mongo/controllers/config";
import { systemConfig } from "../../config/system-config";
import { signRamblersUploadBody, verifyRamblersUploadSignature } from "../../ramblers/integration-worker-crypto";
import { dateTimeNowAsValue } from "../../shared/dates";

const debugLog = debug(envConfig.logNamespace("brevo:unsubscribe-token"));
debugLog.enabled = false;

export interface UnsubscribeTokenPayload {
  email: string;
  issuedAt: number;
  senderEmail?: string;
  listId?: number;
}

export interface DecodedUnsubscribeToken {
  email: string;
  issuedAt: number;
  senderEmail?: string;
  listId?: number;
}

const TOKEN_DELIMITER = ".";

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function newSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function ensureUnsubscribeTokenSecret(): Promise<string> {
  const doc = await config.queryKey(ConfigKey.BREVO) as ConfigDocument;
  const value: MailConfig = doc.value;
  if (value.unsubscribeTokenSecret) {
    return value.unsubscribeTokenSecret;
  }
  const secret = newSecret();
  value.unsubscribeTokenSecret = secret;
  await config.createOrUpdateKey(ConfigKey.BREVO, value);
  debugLog("Generated new unsubscribe token secret and saved to Brevo config");
  return secret;
}

export async function readUnsubscribeTokenSecret(): Promise<string | undefined> {
  const doc = await config.queryKey(ConfigKey.BREVO) as ConfigDocument;
  const value: MailConfig = doc.value;
  return value?.unsubscribeTokenSecret;
}

export async function buildUnsubscribeToken(email: string, senderEmail?: string, listId?: number): Promise<string> {
  const secret = await ensureUnsubscribeTokenSecret();
  const trimmedSender = senderEmail?.trim().toLowerCase();
  const payload: UnsubscribeTokenPayload = {
    email: email.trim().toLowerCase(),
    issuedAt: dateTimeNowAsValue(),
    ...(trimmedSender ? { senderEmail: trimmedSender } : {}),
    ...(Number.isFinite(listId) ? { listId } : {})
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signRamblersUploadBody(body, secret);
  return `${body}${TOKEN_DELIMITER}${signature}`;
}

const CONTACT_US_HREF_PATTERN = /^(contact[-_]?us|contact|get[-_]?in[-_]?touch)$/i;
const CONTACT_US_TITLE_PATTERN = /(contact|get in touch)/i;

async function contactUsParentSegment(): Promise<string | null> {
  try {
    const sys = await systemConfig();
    const pages = sys?.group?.pages || [];
    const matchedPage = pages.find(page => {
      const href = (page?.href || "").trim();
      const title = (page?.title || "").trim();
      return (href && CONTACT_US_HREF_PATTERN.test(href))
        || (title && CONTACT_US_TITLE_PATTERN.test(title));
    });
    const href = matchedPage?.href?.trim();
    return href ? href.replace(/^\/+|\/+$/g, "") : null;
  } catch (error: any) {
    debugLog("contactUsParentSegment:failed", error?.message || error);
    return null;
  }
}

export async function buildUnsubscribeUrl(email: string, appUrl: string, senderEmail?: string, listId?: number): Promise<string> {
  const token = await buildUnsubscribeToken(email, senderEmail, listId);
  const base = (appUrl || "").replace(/\/+$/, "");
  const parent = await contactUsParentSegment();
  const path = parent ? `/${parent}/unsubscribe` : "/unsubscribe";
  return `${base}${path}?t=${encodeURIComponent(token)}`;
}

export async function buildUnsubscribeApiUrl(email: string, appUrl: string, senderEmail?: string, listId?: number): Promise<string> {
  const token = await buildUnsubscribeToken(email, senderEmail, listId);
  const base = (appUrl || "").replace(/\/+$/, "");
  return `${base}/api/mail/unsubscribe/confirm?t=${encodeURIComponent(token)}`;
}

export async function verifyUnsubscribeToken(token: string): Promise<DecodedUnsubscribeToken | null> {
  const secret = await readUnsubscribeTokenSecret();
  if (!secret) {
    debugLog("verifyUnsubscribeToken: no secret configured");
    return null;
  }
  const parts = (token || "").split(TOKEN_DELIMITER);
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!verifyRamblersUploadSignature(body, secret, signature)) {
    return null;
  }
  try {
    const decoded = JSON.parse(base64UrlDecode(body)) as UnsubscribeTokenPayload;
    if (!decoded?.email) return null;
    return {
      email: decoded.email,
      issuedAt: decoded.issuedAt,
      senderEmail: decoded.senderEmail,
      listId: decoded.listId
    };
  } catch (error: any) {
    debugLog("verifyUnsubscribeToken: decode failed", error?.message || error);
    return null;
  }
}

export async function appBaseUrl(): Promise<string> {
  const sys = await systemConfig();
  const base = (sys?.group?.href || "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("System config group.href not set; cannot derive unsubscribe URL");
  }
  return base;
}
