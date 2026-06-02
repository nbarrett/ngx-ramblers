import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { googleInboxConfigured } from "../inbox/inbox-runtime";
import { registerScheduledTask } from "./scheduled-task-registry";

const debugLog = debug(envConfig.logNamespace("cron:inbox-message-digest"));
debugLog.enabled = true;

export async function scheduleInboxMessageDigest(): Promise<void> {
  try {
    const cronExpression = "*/5 * * * *";
    await registerScheduledTask({
      id: "inbox-message-digest",
      name: "Inbox message digest email",
      description: "Every 5 minutes, emails a digest of new inbound inbox messages to opted-in committee members assigned to the role mailbox.",
      cronExpression,
      enabled: true,
      run: async () => {
        debugLog("starting scheduled inbox message digest");
        if (!await googleInboxConfigured()) {
          debugLog("Inbox message digest skipped - Google Inbox OAuth is not configured");
          return;
        }
        const { runInboxMessageDigest } = await import("../inbox/inbox-message-digest");
        const count = await runInboxMessageDigest();
        debugLog(`inbox message digest completed: ${count} message(s) covered`);
      }
    });
    debugLog(`inbox message digest cron scheduled: ${cronExpression}`);
  } catch (error: any) {
    debugLog("failed to schedule inbox message digest:", error?.message || error);
  }
}
