import debug from "debug";
import { Request, Response } from "express";
import { BrevoClient } from "@getbrevo/brevo";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { campaignProgress } from "./campaign-queue";
import { BrevoCampaignAudienceList } from "../../../../projects/ngx-ramblers/src/app/models/brevo-campaign-queue.model";

const messageType = "brevo:campaign-stats";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

async function audienceLists(client: BrevoClient, listIds: number[]): Promise<BrevoCampaignAudienceList[]> {
  const lists = await Promise.all(listIds.map(async listId => {
    try {
      const list = await scheduleBrevo(() => client.contacts.getList({listId}));
      return {id: list.id, name: list.name, uniqueSubscribers: list.uniqueSubscribers ?? 0};
    } catch (error) {
      debugLog(`Failed to fetch list ${listId}:`, error);
      return null;
    }
  }));
  return lists.filter((list): list is BrevoCampaignAudienceList => list !== null);
}

export async function campaignStats(req: Request, res: Response): Promise<void> {
  try {
    const campaignId = Number(req.params.campaignId);
    if (!Number.isFinite(campaignId)) {
      res.status(400).json({ error: "campaignId is required" });
      return;
    }
    const client = await brevoClient();
    const response = await scheduleBrevo(() => client.emailCampaigns.getEmailCampaign({campaignId, statistics: "globalStats", excludeHtmlContent: true}));
    const body = campaignProgress(response);
    body.audienceLists = await audienceLists(client, body.listIds ?? []);
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
