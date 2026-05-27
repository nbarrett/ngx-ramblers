import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { runUnsubscribesSync } from "../brevo/contacts/unsubscribes";
import { configuredBrevo } from "../brevo/brevo-config";
import { registerScheduledTask } from "./scheduled-task-registry";

const debugLog = debug(envConfig.logNamespace("cron:brevo-unsubscribes-sync"));
debugLog.enabled = true;

export async function scheduleBrevoUnsubscribesSync(): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const cronExpression = "15 */2 * * *";
    await registerScheduledTask({
      id: "brevo-unsubscribes-sync",
      name: "Brevo unsubscribes sync",
      description: "Synchronises blocked and unsubscribed Brevo contacts into member records.",
      cronExpression,
      enabled: !!brevoConfig?.apiKey,
      run: async () => {
        debugLog("Starting scheduled Brevo unsubscribes sync");
        const { response, selfHealed } = await runUnsubscribesSync({});
        debugLog("Scheduled sync completed:", {
          fetchedContacts: response.contacts.length,
          totalBlocked: response.count,
          selfHealed
        });
      }
    });
    debugLog(`Brevo unsubscribes sync cron job scheduled: ${cronExpression} (every 2 hours, offset 15m)`);
  } catch (error: any) {
    debugLog("Failed to schedule Brevo unsubscribes sync:", error?.message || error);
  }
}
