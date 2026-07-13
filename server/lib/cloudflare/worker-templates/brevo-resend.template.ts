import { BrevoResendEnv, ForwardableEmailMessage } from "./types";
import { encodeRawMimeBase64, signAndPostWebhook } from "./shared";

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
    const rawMimeBase64 = await encodeRawMimeBase64(message.raw);
    const body = JSON.stringify({
      rawMimeBase64,
      recipients,
      senderEmail,
      senderName
    });
    const response = await signAndPostWebhook(webhookUrl, body, sharedSecret);
    if (!response.ok) {
      const text = await response.text();
      const reason = "NGX inbound-mime webhook failed: " + response.status + " " + text;
      console.error(reason);
      throw new Error(reason);
    }
  }
};
