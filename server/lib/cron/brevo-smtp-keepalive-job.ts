import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { registerScheduledTask } from "./scheduled-task-registry";
import { sendSmtpKeepalive, smtpKeepaliveAuths } from "../brevo/smtp-relay";
import { ScheduledTaskId } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";

const debugLog = debug(envConfig.logNamespace("cron:brevo-smtp-keepalive"));
debugLog.enabled = true;

async function smtpCredentialsConfigured(): Promise<boolean> {
  try {
    const auths = await smtpKeepaliveAuths();
    return auths.length > 0;
  } catch (error: any) {
    debugLog("Failed to read Brevo config when checking SMTP credentials:", error?.message || error);
    return false;
  }
}

export async function scheduleBrevoSmtpKeepalive(): Promise<void> {
  try {
    const cronExpression = "0 5 1 * *";
    await registerScheduledTask({
      id: ScheduledTaskId.BREVO_SMTP_KEEPALIVE,
      name: "Brevo SMTP key keepalive",
      description: "Sends a monthly probe through each configured Brevo SMTP login and key so unused keys are not marked inactive after three months, and confirms inbound committee email can still be relayed.",
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
