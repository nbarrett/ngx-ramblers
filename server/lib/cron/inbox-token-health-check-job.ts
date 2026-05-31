import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { registerScheduledTask } from "./scheduled-task-registry";
import { renewInboxWatches, runInboxTokenHealthCheck } from "../inbox/inbox-poller";

const debugLog = debug(envConfig.logNamespace("cron:inbox-token-health-check"));
debugLog.enabled = true;

export async function scheduleInboxTokenHealthCheck(): Promise<void> {
  try {
    const cronExpression = "30 6 * * *";
    await registerScheduledTask({
      id: "inbox-token-health-check",
      name: "Inbox Gmail token health check",
      description: "Pings each connected Gmail inbox daily and flags revoked OAuth refresh tokens before inbound mail silently stacks up.",
      cronExpression,
      enabled: true,
      run: async () => {
        debugLog("Starting scheduled inbox token health check");
        const results = await runInboxTokenHealthCheck();
        const unhealthy = results.filter(result => !result.healthy);
        debugLog("Inbox token health check completed:", {
          checked: results.length,
          unhealthy: unhealthy.length,
          revoked: unhealthy.map(result => `${result.gmailAccountEmail}: ${result.connectionStatus}`)
        });
        await renewInboxWatches();
        debugLog("Inbox Gmail watch renewal completed");
      }
    });
    debugLog(`Inbox token health check cron job scheduled: ${cronExpression} (daily at 06:30)`);
  } catch (error: any) {
    debugLog("Failed to schedule inbox token health check:", error?.message || error);
  }
}
