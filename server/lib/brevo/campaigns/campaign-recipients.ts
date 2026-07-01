import debug from "debug";
import { Request, Response } from "express";
import { BrevoClient } from "@getbrevo/brevo";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { member } from "../../mongo/models/member";
import { CampaignRecipient, CampaignRecipientsReport } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { dateTimeNow } from "../../shared/dates";

const messageType = "brevo:campaign-recipients";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const MAX_RECIPIENTS = 2000;
const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1500;
const CACHE_TTL_MS = 30 * 60 * 1000;

type RecipientRow = {
  email: string;
  deliveredDate: string;
  openDate: string;
  unsubscribeDate: string;
  hardBounceDate: string;
  softBounceDate: string;
  clickedCount: number;
  clickedLinks: string[];
};

type RecipientSelector = { select: (row: RecipientRow) => boolean; date: (row: RecipientRow) => string; links?: (row: RecipientRow) => string[] };

type CachedRows = { rows: RecipientRow[]; cachedAt: number };

const cardTypeSelectors: Record<string, RecipientSelector> = {
  delivered: {select: row => !!row.deliveredDate, date: row => row.deliveredDate},
  opened: {select: row => !!row.openDate, date: row => row.openDate},
  clicks: {select: row => row.clickedCount > 0, date: row => row.deliveredDate, links: row => row.clickedLinks},
  unsubscribed: {select: row => !!row.unsubscribeDate, date: row => row.unsubscribeDate},
  hardBounces: {select: row => !!row.hardBounceDate, date: row => row.hardBounceDate},
  softBounces: {select: row => !!row.softBounceDate, date: row => row.softBounceDate}
};

const rowsCache = new Map<number, CachedRows>();

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function exportUrlForProcess(client: BrevoClient, processId: number, attemptsRemaining: number): Promise<string | null> {
  const process = await scheduleBrevo(() => client.process.getProcess({processId}));
  if (process.status === "completed" && process.export_url) {
    return process.export_url;
  } else if (process.status === "failed" || process.status === "cancelled" || attemptsRemaining <= 0) {
    return null;
  } else {
    await delay(POLL_INTERVAL_MS);
    return exportUrlForProcess(client, processId, attemptsRemaining - 1);
  }
}

function parseRows(csv: string): RecipientRow[] {
  const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }
  const header = lines[0].split(";");
  const idx = {
    email: header.indexOf("Email_ID"),
    delivered: header.indexOf("Delivered_Date"),
    open: header.indexOf("Open_Date"),
    unsubscribe: header.indexOf("Unsubscribe_Date"),
    hardBounce: header.indexOf("Hard_Bounce_Date"),
    softBounce: header.indexOf("Soft_Bounce_Date"),
    clicked: header.indexOf("Clicked_Links_Count")
  };
  const complaintIndex = header.indexOf("Complaint_date");
  const linkColumns = header
    .map((columnHeader, index) => ({url: columnHeader, index}))
    .filter(column => complaintIndex >= 0 && column.index > complaintIndex && /^https?:\/\//i.test(column.url));
  const value = (columns: string[], index: number): string => index >= 0 ? (columns[index] ?? "").trim() : "";
  return lines.slice(1)
    .map(line => line.split(";"))
    .map(columns => ({
      email: value(columns, idx.email),
      deliveredDate: value(columns, idx.delivered),
      openDate: value(columns, idx.open),
      unsubscribeDate: value(columns, idx.unsubscribe),
      hardBounceDate: value(columns, idx.hardBounce),
      softBounceDate: value(columns, idx.softBounce),
      clickedCount: Number(value(columns, idx.clicked)) || 0,
      clickedLinks: [...new Set(linkColumns.filter(column => value(columns, column.index).length > 0).map(column => column.url))]
    }))
    .filter(row => row.email.length > 0);
}

async function memberNamesByEmail(emails: string[]): Promise<Map<string, string>> {
  const loweredEmails = [...new Set(emails.map(email => email.toLowerCase()))];
  const members = await member.find({email: {$in: loweredEmails}}, {email: 1, firstName: 1, lastName: 1, displayName: 1}).lean().exec() as any[];
  return members.reduce((map, memberRecord) => {
    const fullName = [memberRecord.firstName, memberRecord.lastName].filter(Boolean).join(" ").trim() || memberRecord.displayName || "";
    if (memberRecord.email && fullName) {
      map.set(memberRecord.email.toLowerCase(), fullName);
    }
    return map;
  }, new Map<string, string>());
}

async function allRecipientRows(campaignId: number): Promise<RecipientRow[] | null> {
  const cached = rowsCache.get(campaignId);
  if (cached && dateTimeNow().toMillis() - cached.cachedAt < CACHE_TTL_MS) {
    debugLog(`Serving campaign ${campaignId} recipients from cache (${cached.rows.length} rows); no Brevo export triggered`);
    return cached.rows;
  }
  const client = await brevoClient();
  const exportResponse = await scheduleBrevo(() => client.emailCampaigns.emailExportRecipients({campaignId, recipientsType: "all"}));
  const processId = exportResponse?.processId;
  if (!processId) {
    return null;
  }
  const exportUrl = await exportUrlForProcess(client, processId, POLL_ATTEMPTS);
  if (!exportUrl) {
    return null;
  }
  const csv = await (await fetch(exportUrl)).text();
  const rows = parseRows(csv);
  rowsCache.set(campaignId, {rows, cachedAt: dateTimeNow().toMillis()});
  return rows;
}

export async function campaignRecipients(req: Request, res: Response): Promise<void> {
  try {
    const campaignId = Number(req.params.campaignId);
    if (!Number.isFinite(campaignId)) {
      res.status(400).json({error: "campaignId is required"});
      return;
    }
    const selector = cardTypeSelectors[String(req.query.type)];
    if (!selector) {
      res.status(400).json({error: "Unsupported recipient type"});
      return;
    }
    const rows = await allRecipientRows(campaignId);
    if (!rows) {
      successfulResponse({req, res, response: {recipients: [], truncated: false}, messageType, debugLog});
      return;
    }
    const matched = rows.filter(selector.select);
    const sliced = matched.slice(0, MAX_RECIPIENTS);
    const names = await memberNamesByEmail(sliced.map(row => row.email));
    const recipients: CampaignRecipient[] = sliced.map(row => ({
      email: row.email,
      date: selector.date(row),
      name: names.get(row.email.toLowerCase()),
      links: selector.links ? selector.links(row) : undefined
    }));
    const body: CampaignRecipientsReport = {recipients, truncated: matched.length > MAX_RECIPIENTS};
    successfulResponse({req, res, response: body, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
