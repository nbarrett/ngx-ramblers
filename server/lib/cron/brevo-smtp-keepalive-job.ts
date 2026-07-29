import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { registerScheduledTask } from "./scheduled-task-registry";
import { configuredBrevo } from "../brevo/brevo-config";
import { sendSmtpKeepalive } from "../brevo/smtp-relay";

const debugLog = debug(envConfig.logNamespace("cron:brevo-smtp-keepalive"));
debugLog.enabled = true;

async function smtpCredentialsConfigured(): Promise<boolean> {
  try {
    const config = await configuredBrevo();
    return !!config.smtpUser?.trim() && !!config.smtpPassword?.trim();
  } catch (error: any) {
    debugLog("Failed to read Brevo config when checking SMTP credentials:", error?.message || error);
    return false;
  }
}

export async function scheduleBrevoSmtpKeepalive(): Promise<void> {
  try {
    const cronExpression = "0 5 1 * *";
    await registerScheduledTask({
      id: "brevo-smtp-keepalive",
      name: "Brevo SMTP key keepalive",
      description: "Sends a monthly probe through the Brevo SMTP relay so the SMTP key is not marked inactive after three months of disuse, and confirms inbound committee email can still be relayed.",
      cronExpression,
      enabled: true,
      run: async () => {
        if (await smtpCredentialsConfigured()) {
          const recipient = await sendSmtpKeepalive();
          debugLog("Brevo SMTP keepalive probe delivered to", recipient);
        } else {
          debugLog("Brevo SMTP keepalive skipped - SMTP Login and SMTP Key are not both configured");
        }
      }
    });
    debugLog(`Brevo SMTP keepalive cron job scheduled: ${cronExpression} (05:00 on the 1st of each month)`);
  } catch (error: any) {
    debugLog("Failed to schedule Brevo SMTP keepalive:", error?.message || error);
  }
}
