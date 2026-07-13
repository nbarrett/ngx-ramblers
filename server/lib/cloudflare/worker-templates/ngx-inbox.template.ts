import { ForwardableEmailMessage, NgxInboxEnv } from "./types";
import { encodeRawMimeBase64, signAndPostWebhook } from "./shared";

declare const __WEBHOOK_URL__: string;

export default {
  async email(message: ForwardableEmailMessage, env: NgxInboxEnv, _ctx: unknown): Promise<void> {
    const webhookUrl: string = __WEBHOOK_URL__;
    const sharedSecret = env.NGX_INBOUND_SECRET;
    if (!sharedSecret) {
      console.error("NGX_INBOUND_SECRET not configured on worker");
      return;
    }
    const rawMimeBase64 = await encodeRawMimeBase64(message.raw);
    const body = JSON.stringify({
      rawMimeBase64,
      envelopeTo: message.to,
      envelopeFrom: message.from
    });
    const response = await signAndPostWebhook(webhookUrl, body, sharedSecret);
    if (!response.ok) {
      const text = await response.text();
      const reason = "NGX inbound-inbox webhook failed: " + response.status + " " + text;
      console.error(reason);
      throw new Error(reason);
    }
  }
};
