import {values} from "es-toolkit/compat";
import {CachedRecipientRows, MemberRecipientInfo, RecipientRow, RecipientSelector} from "./campaign-recipient-export.model";
import debug from "debug";
import { Request, Response } from "express";
import { BrevoClient } from "@getbrevo/brevo";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { member } from "../../mongo/models/member";
import { CampaignRecipient, CampaignRecipientsReport, CampaignRecipientType } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { dateTimeNow } from "../../shared/dates";
import { parseRecipientExportCsv } from "./campaign-recipient-export";
import { HttpError } from "../../shared/http-error";

const messageType = "brevo:campaign-recipients";
const debugLog = debug(envConfig.logNamespace(messageType));

const MAX_RECIPIENTS = 2000;
const POLL_ATTEMPTS = 80;
const POLL_INTERVAL_MS = 1500;
const QUEUED_POLLS_BEFORE_RETRY = 8;
const CACHE_TTL_MS = 30 * 60 * 1000;

const cardTypeSelectors: Record<CampaignRecipientType, RecipientSelector> = {
  [CampaignRecipientType.DELIVERED]: {select: row => !!row.deliveredDate && !row.hardBounceDate && !row.softBounceDate, date: row => row.deliveredDate},
  [CampaignRecipientType.OPENED]: {select: row => !!row.openDate, date: row => row.openDate},
  [CampaignRecipientType.CLICKS]: {select: row => row.clickedCount > 0, date: row => row.deliveredDate, links: row => row.clickedLinks},
  [CampaignRecipientType.UNSUBSCRIBED]: {select: row => !!row.unsubscribeDate, date: row => row.unsubscribeDate},
  [CampaignRecipientType.HARD_BOUNCES]: {select: row => !!row.hardBounceDate, date: row => row.hardBounceDate},
  [CampaignRecipientType.SOFT_BOUNCES]: {select: row => !!row.softBounceDate, date: row => row.softBounceDate}
};

const rowsCache = new Map<number, CachedRecipientRows>();
const exportJobs = new Map<number, Promise<RecipientRow[]>>();
const MAX_CACHED_CAMPAIGNS = 3;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function exportUrlForProcess(client: BrevoClient, processId: number, attemptsRemaining: number, queuedPolls: number, previousStatus: string): Promise<string | null> {
  debugLog("getProcess request", JSON.stringify({processId}));
  const process = await scheduleBrevo(() => client.process.getProcess({processId}));
  const status = process.status || "";
  if (queuedPolls === 1 || status !== previousStatus || process.export_url) {
    debugLog("getProcess response", JSON.stringify(process), "attempts left", attemptsRemaining);
  } else {
    debugLog("export process", processId, "status", status, "attempts left", attemptsRemaining);
  }
  if (process.export_url) {
    return process.export_url;
  } else if (status === "failed" || status === "cancelled") {
    throw new HttpError(502, `Brevo recipient export ${status}`);
  } else if (status === "queued" && queuedPolls >= QUEUED_POLLS_BEFORE_RETRY) {
    debugLog("export process", processId, "still queued after", queuedPolls, "checks; starting another export");
    return null;
  } else if (attemptsRemaining <= 0) {
    throw new HttpError(502, "Brevo recipient export did not finish. Try View again.");
  } else {
    await delay(POLL_INTERVAL_MS);
    const nextQueuedPolls = status === "queued" ? queuedPolls + 1 : 0;
    return exportUrlForProcess(client, processId, attemptsRemaining - 1, nextQueuedPolls, status);
  }
}

async function exportDownloadUrl(client: BrevoClient, campaignId: number): Promise<string | null> {
  const exportRequest = {campaignId, recipientsType: "all" as const};
  debugLog("emailExportRecipients request", JSON.stringify(exportRequest));
  const exportResponse = await scheduleBrevo(() => client.emailCampaigns.emailExportRecipients(exportRequest));
  debugLog("emailExportRecipients response", JSON.stringify(exportResponse));
  const processId = exportResponse?.processId;
  if (!processId) {
    throw new HttpError(502, "Brevo did not start a recipient export for this campaign");
  } else {
    debugLog("started export process", processId, "for campaign", campaignId);
    return exportUrlForProcess(client, processId, POLL_ATTEMPTS, 1, "");
  }
}



async function memberInfoByEmail(emails: string[]): Promise<Map<string, MemberRecipientInfo>> {
  const loweredEmails = [...new Set(emails.map(email => email.toLowerCase()))];
  const members = await member.find(
    {email: {$in: loweredEmails}},
    {email: 1, firstName: 1, lastName: 1, displayName: 1, membershipNumber: 1}
  ).lean().exec() as any[];
  return members.reduce((map, memberRecord) => {
    if (memberRecord.email) {
      const fullName = [memberRecord.firstName, memberRecord.lastName].filter(Boolean).join(" ").trim() || memberRecord.displayName || "";
      map.set(memberRecord.email.toLowerCase(), {
        name: fullName || undefined,
        membershipNumber: memberRecord.membershipNumber || undefined
      });
    }
    return map;
  }, new Map<string, MemberRecipientInfo>());
}

function storeRows(campaignId: number, rows: RecipientRow[]): RecipientRow[] {
  rowsCache.delete(campaignId);
  if (rows.length > 0) {
    rowsCache.set(campaignId, {rows, cachedAt: dateTimeNow().toMillis()});
    Array.from(rowsCache.keys())
      .slice(0, Math.max(0, rowsCache.size - MAX_CACHED_CAMPAIGNS))
      .forEach(evictableCampaignId => rowsCache.delete(evictableCampaignId));
  }
  return rows;
}

async function runExport(campaignId: number): Promise<RecipientRow[]> {
  const client = await brevoClient();
  const firstUrl = await exportDownloadUrl(client, campaignId);
  const exportUrl = firstUrl ? firstUrl : await exportDownloadUrl(client, campaignId);
  if (!exportUrl) {
    throw new HttpError(502, "Brevo recipient export did not finish. Try View again.");
  } else {
    const response = await fetch(exportUrl);
    if (!response.ok) {
      throw new HttpError(502, "Brevo recipient export could not be downloaded. Try View again.");
    }
    const csv = await response.text();
    return storeRows(campaignId, parseRecipientExportCsv(csv));
  }
}

export function campaignRecipientRows(campaignId: number): Promise<RecipientRow[]> {
  const cached = rowsCache.get(campaignId);
  if (cached && cached.rows.length > 0 && dateTimeNow().toMillis() - cached.cachedAt < CACHE_TTL_MS) {
    debugLog(`Serving campaign ${campaignId} recipients from cache (${cached.rows.length} rows); no Brevo export triggered`);
    return Promise.resolve(cached.rows);
  } else {
    const existing = exportJobs.get(campaignId);
    if (existing) {
      return existing;
    } else {
      const job = runExport(campaignId).finally(() => {
        exportJobs.delete(campaignId);
      });
      exportJobs.set(campaignId, job);
      return job;
    }
  }
}

export function recipientSelectorFor(type: string): RecipientSelector {
  if (!values(CampaignRecipientType).includes(type as CampaignRecipientType)) {
    throw new HttpError(400, "Unsupported recipient type");
  } else {
    return cardTypeSelectors[type as CampaignRecipientType];
  }
}

export async function recipientsReportFor(campaignId: number, type: string): Promise<CampaignRecipientsReport> {
  const selector = recipientSelectorFor(type);
  const rows = await campaignRecipientRows(campaignId);
  const matched = rows.filter(selector.select);
  const sliced = matched.slice(0, MAX_RECIPIENTS);
  const memberInfo = await memberInfoByEmail(sliced.map(row => row.email));
  const recipients: CampaignRecipient[] = sliced.map(row => {
    const info = memberInfo.get(row.email.toLowerCase());
    return {
      email: row.email,
      date: selector.date(row),
      name: info?.name,
      membershipNumber: info?.membershipNumber,
      links: selector.links ? selector.links(row) : undefined
    };
  });
  return {recipients, truncated: matched.length > MAX_RECIPIENTS};
}

export async function campaignRecipients(req: Request, res: Response): Promise<void> {
  try {
    const campaignId = Number(req.params.campaignId);
    if (!Number.isInteger(campaignId) || campaignId <= 0) {
      res.status(400).json({error: "campaignId is required"});
    } else {
      const body = await recipientsReportFor(campaignId, String(req.query.type));
      successfulResponse({req, res, response: body, messageType, debugLog});
    }
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
