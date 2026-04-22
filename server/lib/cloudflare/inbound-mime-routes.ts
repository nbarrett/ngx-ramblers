import crypto from "crypto";
import debug from "debug";
import express, { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { configuredBrevo } from "../brevo/brevo-config";
import { relayRawMime } from "../brevo/smtp-relay";

const messageType = "cloudflare:inbound-mime";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace(messageType));
errorDebugLog.enabled = true;

const router = express.Router();

interface InboundMimePayload {
  rawMimeBase64: string;
  recipients: string[];
  senderEmail: string;
  senderName: string;
}

interface RecipientResult {
  recipient: string;
  status: "delivered" | "failed";
  error?: string;
}

function parseHeaderValue(rawMimeText: string, headerName: string): string {
  const lower = rawMimeText.toLowerCase();
  const headerLower = headerName.toLowerCase();
  const headerEndIdx = lower.indexOf("\r\n\r\n");
  const headerSection = headerEndIdx >= 0 ? rawMimeText.slice(0, headerEndIdx) : rawMimeText;
  const lines = headerSection.split(/\r?\n/);
  const collected: string[] = [];
  let capturing = false;
  for (const line of lines) {
    if (capturing) {
      if (/^[ \t]/.test(line)) {
        collected.push(line.trim());
        continue;
      }
      break;
    }
    if (line.toLowerCase().startsWith(headerLower + ":")) {
      collected.push(line.slice(headerName.length + 1).trim());
      capturing = true;
    }
  }
  return collected.join(" ");
}

function parseAddressFromHeader(headerValue: string): string {
  if (!headerValue) return "";
  const angleMatch = headerValue.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim();
  return headerValue.trim();
}

function parseDisplayNameFromHeader(headerValue: string): string {
  if (!headerValue) return "";
  const match = headerValue.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  if (match) return match[1].trim();
  return "";
}

function rewriteHeaders(rawMime: string, opts: {
  newFrom: string;
  newReplyTo: string;
  newTo: string;
}): string {
  const headerEndIdx = rawMime.indexOf("\r\n\r\n");
  if (headerEndIdx < 0) {
    throw new Error("Cannot find header/body separator in raw MIME");
  }
  const headerBlock = rawMime.slice(0, headerEndIdx);
  const body = rawMime.slice(headerEndIdx);

  const lines = headerBlock.split(/\r?\n/);
  const filtered: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (skipping) {
      if (/^[ \t]/.test(line)) continue;
      skipping = false;
    }
    const lower = line.toLowerCase();
    if (lower.startsWith("from:") || lower.startsWith("to:") || lower.startsWith("reply-to:")
      || lower.startsWith("return-path:") || lower.startsWith("sender:")
      || lower.startsWith("dkim-signature:") || lower.startsWith("authentication-results:")
      || lower.startsWith("arc-")) {
      skipping = true;
      continue;
    }
    filtered.push(line);
  }

  const newHeaders = [
    `From: ${opts.newFrom}`,
    `Reply-To: ${opts.newReplyTo}`,
    `To: ${opts.newTo}`,
    ...filtered
  ];
  return newHeaders.join("\r\n") + body;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const mismatch = Array.from(a).reduce(
    (acc, _, i) => acc | (a.charCodeAt(i) ^ b.charCodeAt(i)),
    0
  );
  return mismatch === 0;
}

function verifyHmac(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return constantTimeEqual(expected.toLowerCase(), signatureHeader.toLowerCase());
}

function escapeMimeDisplayName(name: string): string {
  if (!name) return "";
  if (/^[\x20-\x7E]+$/.test(name) && !/[<>"@,;]/.test(name)) {
    return name;
  }
  const encoded = Buffer.from(name, "utf-8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

router.post("/inbound-mime", express.text({ type: "application/json", limit: "30mb" }), async (req: Request, res: Response) => {
  const rawBody = req.body as string;
  try {
    const brevo = await configuredBrevo();
    const secret = brevo.inboundWebhookSecret;
    if (!secret) {
      errorDebugLog("inboundWebhookSecret not configured in Brevo config");
      res.status(500).json({ request: { messageType }, error: { message: "Inbound webhook secret not configured on server" } });
      return;
    }
    const signatureHeader = req.header("X-NGX-Signature");
    if (!verifyHmac(rawBody, signatureHeader, secret)) {
      errorDebugLog("HMAC signature verification failed");
      res.status(401).json({ request: { messageType }, error: { message: "Signature verification failed" } });
      return;
    }
    const payload = JSON.parse(rawBody) as InboundMimePayload;
    if (!payload.rawMimeBase64 || !payload.recipients || !payload.senderEmail) {
      res.status(400).json({ request: { messageType }, error: { message: "Missing required fields: rawMimeBase64, recipients, senderEmail" } });
      return;
    }

    const rawMimeBuffer = Buffer.from(payload.rawMimeBase64, "base64");
    const rawMimeText = rawMimeBuffer.toString("utf-8");

    const originalFrom = parseHeaderValue(rawMimeText, "From");
    const originalDisplay = parseDisplayNameFromHeader(originalFrom) || parseAddressFromHeader(originalFrom);
    const originalReplyAddress = parseAddressFromHeader(parseHeaderValue(rawMimeText, "Reply-To"))
      || parseAddressFromHeader(originalFrom);

    const newFromDisplay = escapeMimeDisplayName(originalDisplay);
    const newFromHeader = newFromDisplay ? `${newFromDisplay} <${payload.senderEmail}>` : payload.senderEmail;
    const newReplyToHeader = originalReplyAddress
      ? (newFromDisplay ? `${newFromDisplay} <${originalReplyAddress}>` : originalReplyAddress)
      : payload.senderEmail;

    const results: RecipientResult[] = [];
    for (const recipient of payload.recipients) {
      try {
        const rewrittenMime = rewriteHeaders(rawMimeText, {
          newFrom: newFromHeader,
          newReplyTo: newReplyToHeader,
          newTo: recipient
        });
        await relayRawMime({
          rawMime: Buffer.from(rewrittenMime, "utf-8"),
          recipient,
          envelopeFrom: payload.senderEmail,
          envelopeTo: recipient
        });
        results.push({ recipient, status: "delivered" });
      } catch (err) {
        const message = (err as Error).message || String(err);
        errorDebugLog("Relay failed for %s: %s", recipient, message);
        results.push({ recipient, status: "failed", error: message });
      }
    }

    const allDelivered = results.every(r => r.status === "delivered");
    debugLog("Inbound-mime processed: %d recipients, all-delivered=%s", results.length, allDelivered);
    res.status(allDelivered ? 200 : 207).json({ request: { messageType }, response: { results } });
  } catch (err) {
    const message = (err as Error).message || String(err);
    errorDebugLog("Unhandled inbound-mime error: %s", message);
    res.status(500).json({ request: { messageType }, error: { message } });
  }
});

export const inboundMimeRoutes = router;
