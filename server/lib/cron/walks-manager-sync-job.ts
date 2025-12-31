import debug from "debug";
import * as cron from "node-cron";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { syncWalksManagerData } from "../walks/walks-manager-sync";
import { EventPopulation } from "../../../projects/ngx-ramblers/src/app/models/system.model";

const debugLog = debug(envConfig.logNamespace("cron:walks-manager-sync"));
debugLog.enabled = true;

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

export async function scheduleWalksManagerSync() {
  try {
    const config = await systemConfig();

    if (config.group.walkPopulation !== EventPopulation.WALKS_MANAGER &&
        config.group.walkPopulation !== EventPopulation.HYBRID) {
      debugLog("Walk population is LOCAL, skipping WALKS_MANAGER sync cron job");
      return;
    }

    const cronExpression = "0 */6 * * *";

    scheduledTask = cron.schedule(cronExpression, async () => {
      debugLog("Starting scheduled WALKS_MANAGER sync");
      try {
        const config = await systemConfig();
        const result = await syncWalksManagerData(config, { fullSync: false });

        debugLog("Scheduled sync completed:", {
          added: result.added,
          updated: result.updated,
          deleted: result.deleted,
          totalProcessed: result.totalProcessed,
          errors: result.errors.length
        });

        if (result.errors.length > 0) {
          debugLog("Sync errors:", result.errors);
        }
      } catch (error) {
        debugLog("Scheduled sync failed:", error);
      }
    });

    debugLog(`WALKS_MANAGER sync cron job scheduled: ${cronExpression} (every 6 hours)`);
  } catch (error) {
    debugLog("Failed to schedule WALKS_MANAGER sync:", error);
  }
}

export function stopWalksManagerSync() {
  if (scheduledTask) {
    scheduledTask.stop();
    debugLog("WALKS_MANAGER sync cron job stopped");
    scheduledTask = null;
  }
}
