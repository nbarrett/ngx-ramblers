import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { inboxPollingEnabled } from "../inbox/inbox-runtime";
import { registerScheduledTask } from "./scheduled-task-registry";
import { INBOX_DELETED_RETENTION_DAYS } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { pluraliseWithCount } from "../shared/string-utils";

const debugLog = debug(envConfig.logNamespace("cron:inbox-deleted-purge"));
debugLog.enabled = true;

export async function scheduleInboxDeletedPurge(): Promise<void> {
  try {
    const cronExpression = "15 3 * * *";
    await registerScheduledTask({
      id: "inbox-deleted-purge",
      name: "Inbox deleted-mail purge",
      description: `Every night, permanently removes inbox conversations that have sat in Deleted for ${INBOX_DELETED_RETENTION_DAYS} days.`,
      cronExpression,
      enabled: true,
      run: async () => {
        if (!await inboxPollingEnabled()) {
          debugLog("Inbox deleted purge skipped - no enabled mailbox connection on this site");
        } else {
          const {purgeExpiredDeletedThreads} = await import("../inbox/inbox-deleted");
          const count = await purgeExpiredDeletedThreads();
          debugLog(`inbox deleted purge completed: ${pluraliseWithCount(count, "conversation")}`);
        }
      }
    });
    debugLog(`inbox deleted purge cron scheduled: ${cronExpression}`);
  } catch (error: any) {
    debugLog("failed to schedule inbox deleted purge:", error?.message || error);
  }
}
