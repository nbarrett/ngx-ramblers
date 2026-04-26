import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import http from "http";
import { Request, Response } from "express";
import { handleError, successfulResponse } from "./common/messages";
import { envConfig } from "../env-config/env-config";
import { configuredBrevo } from "./brevo-config";
import { readBrevoEventsWebhookSecret } from "./brevo-events-webhook-config";
import { member } from "../mongo/models/member";
import { mailListAudit } from "../mongo/models/mail-list-audit";
import {
  BLOCKED_CONTACT_REASON_LABELS,
  BlockedContactReasonCode,
  MailListAuditListType,
  MailListAuditSource
} from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { AuditStatus } from "../../../projects/ngx-ramblers/src/app/models/audit";

const messageType = "brevo:events-webhook";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

const BLOCK_EVENTS = new Set<string>(["unsubscribed", "blocked", "hard_bounce", "spam", "complaint"]);
const CLEAR_EVENTS = new Set<string>(["unsubscribe_revoked", "unblocked"]);

function eventToReasonCode(event: string): BlockedContactReasonCode {
  switch (event) {
  case "unsubscribed":
    return BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL;
  case "blocked":
    return BlockedContactReasonCode.ADMIN_BLOCKED;
  case "hard_bounce":
    return BlockedContactReasonCode.HARD_BOUNCE;
  case "spam":
  case "complaint":
    return BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM;
  default:
    return BlockedContactReasonCode.ADMIN_BLOCKED;
  }
}

function reasonToAuditStatus(code: BlockedContactReasonCode): AuditStatus {
  if (
    code === BlockedContactReasonCode.HARD_BOUNCE
    || code === BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM
    || code === BlockedContactReasonCode.ADMIN_BLOCKED
  ) {
    return AuditStatus.error;
  }
  return AuditStatus.warning;
}

function tsToMillis(ts: number | string | undefined): number {
  if (typeof ts === "number" && Number.isFinite(ts)) {
    return ts < 1e12 ? ts * 1000 : ts;
  }
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

async function fetchListIdsForEmail(email: string): Promise<number[]> {
  try {
    const brevoConfig = await configuredBrevo();
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: { response: http.IncomingMessage, body: any } = await contactsApi.getContactInfo(email);
    return (response.body?.listIds as number[]) || [];
  } catch (error: any) {
    debugLog("fetchListIdsForEmail:lookup-failed", email, error?.response?.statusCode || error?.message || error);
    return [];
  }
}

async function applyBlockEvent(payload: any): Promise<{ applied: boolean; reason?: string }> {
  const email = String(payload?.email || "").toLowerCase().trim();
  if (!email) return { applied: false, reason: "missing email" };
  const event = String(payload?.event || "");
  const reasonCode = eventToReasonCode(event);
  const reasonMessage = String(payload?.reason || "").trim() || undefined;
  const blockedAt = tsToMillis(payload?.ts ?? payload?.ts_event ?? payload?.date);
  const senderEmail = String(payload?.sending_ip || payload?.from || "").trim() || undefined;

  const matchedMember = await member.findOne(
    { email },
    { _id: 1, displayName: 1 }
  ).lean().exec() as any;
  if (!matchedMember) {
    debugLog("applyBlockEvent:no-member-match", email, event);
    return { applied: false, reason: "no matching member" };
  }
  const memberId = matchedMember.id || matchedMember._id?.toString();

  const listIds = await fetchListIdsForEmail(email);
  const memberDoc = await member.findById(memberId).lean().exec() as any;
  const existingSubs: Array<{ id: number; subscribed: boolean }> = memberDoc?.mail?.subscriptions || [];
  const blockedListIds = new Set(listIds.filter(id => Number.isFinite(id)));
  const updatedSubs = existingSubs.map(sub =>
    blockedListIds.has(sub.id) ? { ...sub, subscribed: false } : sub
  );

  const emailBlock = {
    reasonCode,
    reasonMessage,
    senderEmail,
    blockedAt,
    syncedAt: Date.now(),
    source: MailListAuditSource.BREVO_EVENTS_WEBHOOK
  };

  const update: any = { $set: { emailBlock } };
  if (updatedSubs.length > 0 && JSON.stringify(updatedSubs) !== JSON.stringify(existingSubs)) {
    update.$set["mail.subscriptions"] = updatedSubs;
  }
  await member.updateOne({ _id: memberId }, update);

  const reasonLabel = BLOCKED_CONTACT_REASON_LABELS[reasonCode] || reasonCode;
  const auditMessage = senderEmail
    ? `${reasonLabel} via Brevo webhook (sender: ${senderEmail})`
    : `${reasonLabel} via Brevo webhook`;
  const targetListIds = listIds.length > 0 ? listIds : [0];
  for (const listId of targetListIds) {
    try {
      await mailListAudit.updateOne(
        { memberId, listId, timestamp: blockedAt, createdBy: MailListAuditSource.BREVO_EVENTS_WEBHOOK },
        {
          $setOnInsert: {
            memberId,
            listId,
            timestamp: blockedAt,
            createdBy: MailListAuditSource.BREVO_EVENTS_WEBHOOK,
            listType: MailListAuditListType.BREVO_BLOCKED,
            status: reasonToAuditStatus(reasonCode),
            audit: auditMessage
          }
        },
        { upsert: true }
      );
    } catch (error: any) {
      debugLog("applyBlockEvent:audit-write-failed", memberId, listId, error?.message || error);
    }
  }
  return { applied: true };
}

async function applyClearEvent(payload: any): Promise<{ applied: boolean; reason?: string }> {
  const email = String(payload?.email || "").toLowerCase().trim();
  if (!email) return { applied: false, reason: "missing email" };
  const matchedMember = await member.findOne({ email }, { _id: 1 }).lean().exec() as any;
  if (!matchedMember) return { applied: false, reason: "no matching member" };
  const memberId = matchedMember.id || matchedMember._id?.toString();
  await member.updateOne({ _id: memberId }, { $unset: { emailBlock: 1 } });
  await mailListAudit.create({
    memberId,
    listId: 0,
    timestamp: Date.now(),
    createdBy: MailListAuditSource.BREVO_EVENTS_WEBHOOK,
    listType: MailListAuditListType.BREVO_BLOCKLIST_CLEARED,
    status: AuditStatus.info,
    audit: `Brevo webhook cleared block for ${email} (event: ${payload?.event})`
  });
  return { applied: true };
}

export async function brevoEventsWebhook(req: Request, res: Response): Promise<void> {
  try {
    const expectedSecret = await readBrevoEventsWebhookSecret();
    if (!expectedSecret) {
      res.status(503).json({ error: "Brevo events webhook not configured on this server" });
      return;
    }
    const presentedToken = String(req.query.token || "");
    if (presentedToken !== expectedSecret) {
      debugLog("brevoEventsWebhook:bad-token");
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const payload = req.body || {};
    const event = String(payload?.event || "");
    if (BLOCK_EVENTS.has(event)) {
      const result = await applyBlockEvent(payload);
      successfulResponse({ req, res, response: { event, ...result }, messageType, debugLog });
      return;
    }
    if (CLEAR_EVENTS.has(event)) {
      const result = await applyClearEvent(payload);
      successfulResponse({ req, res, response: { event, ...result }, messageType, debugLog });
      return;
    }
    successfulResponse({ req, res, response: { event, applied: false, reason: "event ignored" }, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}

export async function brevoEventsWebhookConfig(req: Request, res: Response): Promise<void> {
  try {
    const { ensureBrevoEventsWebhookConfigured } = await import("./brevo-events-webhook-config");
    const result = await ensureBrevoEventsWebhookConfigured();
    successfulResponse({ req, res, response: result, messageType: "brevo:events-webhook-config", debugLog });
  } catch (error) {
    handleError(req, res, "brevo:events-webhook-config", debugLog, error);
  }
}
