import { BrevoResendEnv, ForwardableEmailMessage } from "./types";

declare const __RECIPIENTS__: string[];
declare const __SENDER_EMAIL__: string;
declare const __SENDER_NAME__: string;
declare const __WEBHOOK_URL__: string;

export default {
  async email(message: ForwardableEmailMessage, env: BrevoResendEnv, _ctx: unknown): Promise<void> {
    const recipients: string[] = __RECIPIENTS__;
    const senderEmail: string = __SENDER_EMAIL__;
    const senderName: string = __SENDER_NAME__;
    const webhookUrl: string = __WEBHOOK_URL__;
    const sharedSecret = env.NGX_INBOUND_SECRET;
    if (!sharedSecret) {
      console.error("NGX_INBOUND_SECRET not configured on worker");
      return;
    }
    const buf = await new Response(message.raw).arrayBuffer();
    const bytes = new Uint8Array(buf);
    const chunkSize = 0x8000;
    const numChunks = Math.ceil(bytes.length / chunkSize);
    const binary = Array.from({ length: numChunks }, (_, i) =>
      String.fromCharCode.apply(null, Array.from(bytes.subarray(i * chunkSize, (i + 1) * chunkSize)))
    ).join("");
    const rawMimeBase64 = btoa(binary);
    const body = JSON.stringify({
      rawMimeBase64,
      recipients,
      senderEmail,
      senderName
    });
    const signature = await hmacSign(body, sharedSecret);
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-NGX-Signature": signature
        },
        body
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("NGX inbound-mime webhook failed: " + response.status + " " + text);
      }
    } catch (error) {
      console.error("Failed to POST to NGX webhook:", (error as Error).message || error);
    }
  }
};

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const sigBytes = new Uint8Array(sigBuffer);
  return Array.from(sigBytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
