import debug from "debug";
import { BREVO_CAMPAIGN_RELEASE_TASK_ID } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import { envConfig } from "../env-config/env-config";
import { configuredBrevo } from "../brevo/brevo-config";
import { releasePendingCampaigns } from "../brevo/campaigns/campaign-queue";
import { registerScheduledTask } from "./scheduled-task-registry";

const debugLog = debug(envConfig.logNamespace("cron:brevo-campaign-release"));
debugLog.enabled = true;

export async function scheduleBrevoCampaignRelease(): Promise<void> {
  const brevoConfig = await configuredBrevo();
  await registerScheduledTask({
    id: BREVO_CAMPAIGN_RELEASE_TASK_ID,
    name: "Brevo campaign overflow release",
    description: "Releases campaign recipients held by Brevo after the daily sending allowance is reached.",
    cronExpression: "5 0 * * *",
    enabled: !!brevoConfig.apiKey,
    run: async () => {
      debugLog("Starting Brevo campaign overflow release");
      await releasePendingCampaigns();
    }
  });
}
