import { ForwardableEmailMessage, NgxInboxEnv } from "./types";
import { encodeRawMimeBase64, signAndPostWebhook } from "./shared";

export default {
  async email(message: ForwardableEmailMessage, env: NgxInboxEnv, _ctx: unknown): Promise<void> {
    const sharedSecret = env.NGX_INBOUND_SECRET;
    if (!sharedSecret) {
      console.error("NGX_INBOUND_SECRET not configured on worker");
      return;
    }
    const recipient = message.to || "";
    const atIndex = recipient.lastIndexOf("@");
    const domain = atIndex >= 0 ? recipient.slice(atIndex + 1).trim().toLowerCase() : "";
    if (!domain) {
      console.error("Could not derive recipient domain from " + recipient);
      return;
    }
    const fallback = (env.NGX_FALLBACK_FORWARD || "").trim();
    const forwardTo = async (address: string, reason: string): Promise<void> => {
      const target = (address || "").trim() || fallback;
      if (!target) {
        throw new Error("NGX inbox router: " + reason + " and no forward address or NGX_FALLBACK_FORWARD configured for " + domain);
      }
      try {
        await message.forward(target);
      } catch (forwardError) {
        if (target !== fallback && fallback) {
          console.error("NGX inbox router forward to " + target + " failed, using fallback:", (forwardError as Error).message || forwardError);
          await message.forward(fallback);
        } else {
          throw forwardError;
        }
      }
    };
    const forwardToFallback = (reason: string): Promise<void> => forwardTo(fallback, reason);

    const webhookUrl = "https://" + domain + "/api/cloudflare/email-routing/inbound-inbox";
    const rawMimeBase64 = await encodeRawMimeBase64(message.raw);
    const body = JSON.stringify({
      rawMimeBase64,
      envelopeTo: message.to,
      envelopeFrom: message.from
    });

    let response: Response;
    try {
      response = await signAndPostWebhook(webhookUrl, body, sharedSecret);
    } catch (fetchError) {
      await forwardToFallback("webhook unreachable: " + ((fetchError as Error).message || String(fetchError)));
      return;
    }

    if (!response.ok) {
      const text = await response.text();
      await forwardToFallback("webhook returned " + response.status + " " + text);
      return;
    }

    let action = "store";
    let forwardAddress = "";
    try {
      const parsed = JSON.parse(await response.text());
      const inner = (parsed && parsed.response) || parsed || {};
      action = inner.action || "store";
      forwardAddress = inner.to || "";
    } catch (_ignored) {
      action = "store";
    }
    if (action === "forward") {
      await forwardTo(forwardAddress, "site catch-all forwards");
    }
  }
};
