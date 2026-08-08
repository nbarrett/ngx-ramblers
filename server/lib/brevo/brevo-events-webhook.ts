import { dateTimeNowAsValue } from "../shared/dates";
import debug from "debug";
import { Request, Response } from "express";
import { isNumber, isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "./common/messages";
import { envConfig } from "../env-config/env-config";
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
import { bounceTypeForBrevoEvent, reportSalesforceBounce } from "../salesforce/salesforce-bounce";
import { writeBackConsentForEmailBlock } from "../salesforce/member-consent-writeback";
import {
  isFirstTransitionToEmailBlock,
  mailSubscriptionsChanged,
  reasonCodeForBrevoBlockEvent,
  unsubscribeAllMailSubscriptions
} from "./contacts/email-block-from-event";

const messageType = "brevo:events-webhook";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

const BLOCK_EVENTS = new Set<string>(["unsubscribed", "blocked", "hard_bounce", "spam", "complaint"]);
const CLEAR_EVENTS = new Set<string>(["unsubscribe_revoked", "unblocked"]);

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
  let result = dateTimeNowAsValue();
  if (isNumber(ts) && Number.isFinite(ts)) {
    result = ts < 1e12 ? ts * 1000 : ts;
  } else if (isString(ts)) {
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) {
      result = parsed;
    }
  }
  return result;
}

async function applyBlockEvent(payload: any): Promise<{ applied: boolean; reason?: string; memberId?: string; memberRef?: string; email?: string; eventKey?: string }> {
  const email = String(payload?.email || "").toLowerCase().trim();
  let result: { applied: boolean; reason?: string; memberId?: string; memberRef?: string; email?: string; eventKey?: string } = {
    applied: false,
    reason: "missing email"
  };
  if (email) {
    const event = String(payload?.event || "");
    const reasonCode = reasonCodeForBrevoBlockEvent(event);
    const reasonMessage = String(payload?.reason || "").trim() || undefined;
    const blockedAt = tsToMillis(payload?.ts ?? payload?.ts_event ?? payload?.date);
    const senderEmail = String(payload?.from || "").trim() || undefined;

    const matchedMember = await member.findOne(
      { email },
      { _id: 1, displayName: 1, email: 1, salesforceMemberRef: 1, membershipNumber: 1 }
    ).lean().exec() as any;
    if (!matchedMember) {
      debugLog("applyBlockEvent:no-member-match", email, event);
      result = { applied: false, reason: "no matching member" };
    } else {
      const memberId = matchedMember.id || matchedMember._id?.toString();
      const eventIdentifier = String(payload?.["message-id"] || payload?.messageId || payload?.id || payload?.ts_event || payload?.ts || blockedAt);
      const eventKey = `${event}:${eventIdentifier}:${email}`;

      const memberDoc = await member.findById(memberId).lean().exec() as any;
      const existingSubs = memberDoc?.mail?.subscriptions || [];
      const updatedSubs = unsubscribeAllMailSubscriptions(existingSubs, blockedAt);
      const firstBlock = isFirstTransitionToEmailBlock(memberDoc?.emailBlock);

      const emailBlock = {
        reasonCode,
        reasonMessage,
        senderEmail,
        blockedAt,
        syncedAt: dateTimeNowAsValue(),
        source: MailListAuditSource.BREVO_EVENTS_WEBHOOK
      };

      const update: any = { $set: { emailBlock } };
      if (mailSubscriptionsChanged(existingSubs, updatedSubs)) {
        update.$set["mail.subscriptions"] = updatedSubs;
      }
      await member.updateOne({ _id: memberId }, update);

      const reasonLabel = BLOCKED_CONTACT_REASON_LABELS[reasonCode] || reasonCode;
      const auditMessage = senderEmail
        ? `${reasonLabel} via Brevo webhook (sender: ${senderEmail})`
        : `${reasonLabel} via Brevo webhook`;
      try {
        await mailListAudit.updateOne(
          { memberId, listId: 0, timestamp: blockedAt, createdBy: MailListAuditSource.BREVO_EVENTS_WEBHOOK, audit: auditMessage },
          {
            $setOnInsert: {
              memberId,
              listId: 0,
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
        debugLog("applyBlockEvent:audit-write-failed", memberId, error?.message || error);
      }

      if (firstBlock) {
        await writeBackConsentForEmailBlock(
          {
            id: memberId,
            email: memberDoc?.email || email,
            salesforceMemberRef: memberDoc?.salesforceMemberRef || matchedMember.salesforceMemberRef,
            membershipNumber: memberDoc?.membershipNumber || matchedMember.membershipNumber
          },
          reasonCode,
          MailListAuditSource.BREVO_EVENTS_WEBHOOK
        );
      }

      result = {
        applied: true,
        memberId,
        memberRef: matchedMember.salesforceMemberRef,
        email,
        eventKey
      };
    }
  }
  return result;
}

async function resolveSoftBounce(payload: any): Promise<{ applied: boolean; reason?: string; memberId?: string; memberRef?: string; email?: string; eventKey?: string }> {
  const email = String(payload?.email || "").toLowerCase().trim();
  if (!email) return { applied: false, reason: "missing email" };
  const matchedMember = await member.findOne({ email }, { _id: 1, salesforceMemberRef: 1 }).lean().exec() as any;
  if (!matchedMember) return { applied: false, reason: "no matching member" };
  const eventIdentifier = String(payload?.["message-id"] || payload?.messageId || payload?.id || payload?.ts_event || payload?.ts || payload?.date || "unknown");
  return {
    applied: true,
    memberId: matchedMember.id || matchedMember._id?.toString(),
    memberRef: matchedMember.salesforceMemberRef,
    email,
    eventKey: `soft_bounce:${eventIdentifier}:${email}`,
  };
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
    timestamp: dateTimeNowAsValue(),
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
    if (event === "soft_bounce") {
      const result = await resolveSoftBounce(payload);
      if (result.memberId && result.email && result.eventKey) {
        await reportSalesforceBounce({
          memberId: result.memberId,
          email: result.email,
          memberRef: result.memberRef,
          eventKey: result.eventKey,
          bounceType: "Soft",
        });
      }
      successfulResponse({ req, res, response: { event, applied: result.applied, reason: result.reason }, messageType, debugLog });
      return;
    }
    if (BLOCK_EVENTS.has(event)) {
      const result = await applyBlockEvent(payload);
      const bounceType = bounceTypeForBrevoEvent(event);
      if (bounceType && result.memberId && result.email && result.eventKey) {
        await reportSalesforceBounce({
          memberId: result.memberId,
          email: result.email,
          memberRef: result.memberRef,
          eventKey: result.eventKey,
          bounceType,
        });
      }
      successfulResponse({ req, res, response: { event, applied: result.applied, reason: result.reason }, messageType, debugLog });
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
