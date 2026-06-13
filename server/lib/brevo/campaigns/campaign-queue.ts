import { Request, Response } from "express";
import debug from "debug";
import { Brevo, BrevoClient } from "@getbrevo/brevo";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { fetchBrevoAccount } from "../account/account";
import { dateTimeNow } from "../../shared/dates";
import { pluraliseWithCount } from "../../shared/string-utils";
import { handleError } from "../common/messages";
import {
  BrevoCampaignProgress,
  BrevoCampaignQueueSummary,
  NGX_BREVO_CAMPAIGN_TAG
} from "../../../../projects/ngx-ramblers/src/app/models/brevo-campaign-queue.model";
import { Account } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { brevoEmailsSentToday, campaignDailyAllowance } from "../../../../projects/ngx-ramblers/src/app/functions/brevo-campaigns";
import { ngxBrevoCampaign } from "../../mongo/models/ngx-brevo-campaign";

type CampaignItem = Brevo.GetEmailCampaignsResponse.Campaigns.Item;

const debugLog = debug(envConfig.logNamespace("brevo:campaign-queue"));
debugLog.enabled = true;
const brevoCancellationStatus = Brevo.UpdateCampaignStatus.Status.Cancel;

async function campaignsApi(): Promise<BrevoClient> {
  return brevoClient();
}

export function campaignProgress(campaign: CampaignItem): BrevoCampaignProgress {
  const statistics = campaign.statistics?.globalStats;
  return {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject ?? campaign.name,
    status: `${campaign.status}`,
    sent: statistics?.sent ?? 0,
    delivered: statistics?.delivered ?? 0,
    remaining: campaign.statistics?.remaining ?? 0,
    createdAt: campaign.createdAt,
    modifiedAt: campaign.modifiedAt,
    sentDate: campaign.sentDate ?? null
  };
}

export function isNgxCampaign(campaign: CampaignItem): boolean {
  return campaign.tag === NGX_BREVO_CAMPAIGN_TAG;
}

async function ngxCampaignIdSet(): Promise<Set<number>> {
  const records = await ngxBrevoCampaign.find().select("campaignId").lean();
  return new Set(records.map(record => record.campaignId));
}

export function brevoRemainingDailyAllowance(account: Account): number | null {
  return campaignDailyAllowance(account);
}

export async function campaignQueueSummary(): Promise<BrevoCampaignQueueSummary> {
  const client = await campaignsApi();
  const completionFrom = dateTimeNow().minus({days: 7}).startOf("day").toISO()!;
  const completionTo = dateTimeNow().toISO()!;
  const [pendingResponse, completedResponse] = await Promise.all([
    scheduleBrevo(() => client.emailCampaigns.getEmailCampaigns({type: "classic", status: "suspended", statistics: "globalStats", limit: 100, offset: 0, sort: "desc", excludeHtmlContent: true})),
    scheduleBrevo(() => client.emailCampaigns.getEmailCampaigns({type: "classic", status: "sent", statistics: "globalStats", startDate: completionFrom, endDate: completionTo, limit: 100, offset: 0, sort: "desc", excludeHtmlContent: true}))
  ]);
  const suspendedCampaigns = pendingResponse?.campaigns ?? [];
  const sentCampaigns = completedResponse?.campaigns ?? [];
  const ngxCampaignIds = await ngxCampaignIdSet();
  const isNgx = (campaign: CampaignItem): boolean => isNgxCampaign(campaign) || ngxCampaignIds.has(campaign.id);
  debugLog(`campaignQueueSummary: Brevo returned ${suspendedCampaigns.length} suspended and ${pluraliseWithCount(sentCampaigns.length, "sent classic campaign")}; matching on NGX tag "${NGX_BREVO_CAMPAIGN_TAG}" or ${pluraliseWithCount(ngxCampaignIds.size, "tracked campaign id")}`);
  debugLog("campaignQueueSummary: suspended campaigns:", suspendedCampaigns.map(campaign =>
    ({id: campaign.id, name: campaign.name, status: campaign.status, tag: campaign.tag, remaining: campaign.statistics?.remaining, ngx: isNgx(campaign)})));
  const pendingCampaigns = suspendedCampaigns
    .filter(isNgx)
    .map(campaignProgress)
    .filter(campaign => campaign.remaining > 0);
  const completedCampaigns = sentCampaigns
    .filter(isNgx)
    .map(campaignProgress);
  debugLog(`campaignQueueSummary: ${pendingCampaigns.length} pending and ${completedCampaigns.length} completed campaign(s) after NGX match and remaining>0 filters`);
  const account = await fetchBrevoAccount();
  const remainingAllowanceToday = account ? brevoRemainingDailyAllowance(account) : null;
  return {
    emailsSentToday: account ? brevoEmailsSentToday(account) : null,
    remainingAllowanceToday,
    pendingCampaigns,
    completedCampaigns
  };
}

async function updateCampaignStatus(campaignId: number, status: Brevo.UpdateCampaignStatus.Status): Promise<void> {
  const client = await campaignsApi();
  await scheduleBrevo(() => client.emailCampaigns.updateCampaignStatus({campaignId, body: {status}}));
}

export async function releaseCampaign(campaignId: number): Promise<void> {
  const summary = await campaignQueueSummary();
  if (!summary.pendingCampaigns.some(campaign => campaign.id === campaignId)) {
    throw new Error("Campaign is not in the NGX pending queue");
  }
  await updateCampaignStatus(campaignId, Brevo.UpdateCampaignStatus.Status.Queued);
}

export async function cancelCampaign(campaignId: number): Promise<void> {
  const summary = await campaignQueueSummary();
  if (!summary.pendingCampaigns.some(campaign => campaign.id === campaignId)) {
    throw new Error("Campaign is not in the NGX pending queue");
  }
  await updateCampaignStatus(campaignId, brevoCancellationStatus);
}

export async function releasePendingCampaigns(): Promise<void> {
  const summary = await campaignQueueSummary();
  await Promise.all(summary.pendingCampaigns.map(campaign => updateCampaignStatus(campaign.id, Brevo.UpdateCampaignStatus.Status.Queued)));
  debugLog("Released suspended Brevo campaigns:", summary.pendingCampaigns.map(campaign => campaign.id));
}

export async function queueSummaryRoute(req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({response: await campaignQueueSummary()});
  } catch (error) {
    handleError(req, res, "brevo:campaign-queue", debugLog, error);
  }
}

export async function releaseCampaignRoute(req: Request, res: Response): Promise<void> {
  try {
    const campaignId = Number(req.params.campaignId);
    await releaseCampaign(campaignId);
    res.status(200).json({response: await campaignQueueSummary()});
  } catch (error: any) {
    debugLog("Campaign release failed:", error);
    res.status(500).json({error: {message: error?.message || "Campaign release failed"}});
  }
}

export async function cancelCampaignRoute(req: Request, res: Response): Promise<void> {
  try {
    const campaignId = Number(req.params.campaignId);
    await cancelCampaign(campaignId);
    res.status(200).json({response: await campaignQueueSummary()});
  } catch (error: any) {
    debugLog("Campaign cancellation failed:", error);
    res.status(500).json({error: {message: error?.message || "Campaign cancellation failed"}});
  }
}
