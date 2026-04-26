import debug from "debug";
import * as cron from "node-cron";
import { envConfig } from "../env-config/env-config";
import { runUnsubscribesSync } from "../brevo/contacts/unsubscribes";
import { configuredBrevo } from "../brevo/brevo-config";

const debugLog = debug(envConfig.logNamespace("cron:brevo-unsubscribes-sync"));
debugLog.enabled = true;

export async function scheduleBrevoUnsubscribesSync(): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    if (!brevoConfig?.apiKey) {
      debugLog("Brevo API key not configured — skipping unsubscribes sync cron job");
      return;
    }

    const cronExpression = "15 */2 * * *";

    cron.schedule(cronExpression, async () => {
      debugLog("Starting scheduled Brevo unsubscribes sync");
      try {
        const { response, selfHealed } = await runUnsubscribesSync({});
        debugLog("Scheduled sync completed:", {
          fetchedContacts: response.contacts.length,
          totalBlocked: response.count,
          selfHealed
        });
      } catch (error: any) {
        debugLog("Scheduled sync failed:", error?.message || error);
      }
    });

    debugLog(`Brevo unsubscribes sync cron job scheduled: ${cronExpression} (every 2 hours, offset 15m)`);
  } catch (error: any) {
    debugLog("Failed to schedule Brevo unsubscribes sync:", error?.message || error);
  }
}
