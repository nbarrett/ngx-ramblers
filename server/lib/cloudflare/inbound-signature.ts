import crypto from "crypto";
import { configuredBrevo } from "../brevo/brevo-config";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const mismatch = Array.from(a).reduce(
    (acc, _, i) => acc | (a.charCodeAt(i) ^ b.charCodeAt(i)),
    0
  );
  return mismatch === 0;
}

export function verifyHmac(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return constantTimeEqual(expected.toLowerCase(), signatureHeader.toLowerCase());
}

export async function inboundWebhookSecret(): Promise<string | null> {
  const brevo = await configuredBrevo();
  return brevo.inboundWebhookSecret || null;
}
