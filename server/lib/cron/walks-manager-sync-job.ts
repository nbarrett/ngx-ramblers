import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { syncWalksManagerData } from "../walks/walks-manager-sync";
import { EventPopulation } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { registerScheduledTask, setScheduledTaskEnabled } from "./scheduled-task-registry";

const debugLog = debug(envConfig.logNamespace("cron:walks-manager-sync"));
debugLog.enabled = true;

export async function scheduleWalksManagerSync() {
  try {
    const config = await systemConfig();
    const cronExpression = "0 */6 * * *";
    await registerScheduledTask({
      id: "walks-manager-sync",
      name: "Walks Manager sync",
      description: "Imports walk changes from Ramblers Walks Manager.",
      cronExpression,
      enabled: config.group.walkPopulation === EventPopulation.WALKS_MANAGER,
      run: async () => {
        debugLog("Starting scheduled WALKS_MANAGER sync");
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
      }
    });
    debugLog(`WALKS_MANAGER sync cron job scheduled: ${cronExpression} (every 6 hours)`);
  } catch (error) {
    debugLog("Failed to schedule WALKS_MANAGER sync:", error);
  }
}

export function stopWalksManagerSync() {
  void setScheduledTaskEnabled("walks-manager-sync", false);
  debugLog("WALKS_MANAGER sync cron job stopped");
}
