import { ForwardableEmailMessage, NgxInboxEnv } from "./types";

declare const __WEBHOOK_URL__: string;

export default {
  async email(message: ForwardableEmailMessage, env: NgxInboxEnv, _ctx: unknown): Promise<void> {
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
      envelopeTo: message.to,
      envelopeFrom: message.from
    });
    const signature = await hmacSign(body, sharedSecret);
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
      const reason = "NGX inbound-inbox webhook failed: " + response.status + " " + text;
      console.error(reason);
      throw new Error(reason);
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
