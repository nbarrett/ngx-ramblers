import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import { isNumber, isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { member } from "../../mongo/models/member";
import { mailListAudit } from "../../mongo/models/mail-list-audit";
import {
  MailListAuditListType,
  MailListAuditSource,
  MatchedMemberSubscriptions
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { AuditStatus } from "../../../../projects/ngx-ramblers/src/app/models/audit";
import { buildUnsubscribeToken, contactUsParentSegment, verifyUnsubscribeToken } from "./unsubscribe-token";
import { dateTimeNowAsValue } from "../../shared/dates";
import { systemConfig } from "../../config/system-config";
import { notifySalesforceFullyOptedOut } from "../../salesforce/salesforce-consent";

const messageType = "brevo:branded-unsubscribe";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const FEEDBACK_REASON_CODES = new Set<string>([
  "too-many-emails",
  "not-relevant",
  "never-signed-up",
  "no-longer-interested",
  "moved-away",
  "other"
]);

function readToken(req: Request): string {
  const fromQuery = isString(req.query?.t) ? req.query.t : "";
  if (fromQuery) return fromQuery;
  return isString(req.body?.t) ? req.body.t : "";
}

async function findMember(email: string): Promise<MatchedMemberSubscriptions | null> {
  const matchedMember = await member.findOne(
    { email: email.toLowerCase() },
    { _id: 1, displayName: 1, mail: 1, membershipNumber: 1 }
  ).lean().exec() as any;
  if (!matchedMember) return null;
  return {
    memberId: matchedMember.id || matchedMember._id?.toString(),
    membershipNumber: matchedMember?.membershipNumber,
    subscriptions: matchedMember?.mail?.subscriptions || []
  };
}

export function activeSubscribedCount(subs: Array<{ id: number; subscribed: boolean }>): number {
  return subs.filter(sub => sub?.subscribed).length;
}

export function consentWritebackShouldFire(beforeCount: number, afterCount: number): boolean {
  return beforeCount > 0 && afterCount === 0;
}

async function removeContactFromBrevoList(email: string, listId: number): Promise<void> {
  const brevoConfig = await configuredBrevo();
  const contactsApi = new SibApiV3Sdk.ContactsApi();
  contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
  const removal = new SibApiV3Sdk.RemoveContactFromList();
  removal.emails = [email];
  try {
    await scheduleBrevo(() => contactsApi.removeContactFromList(listId, removal));
  } catch (error: any) {
    const status = error?.response?.statusCode;
    if (status === 400 || status === 404) {
      debugLog("removeContactFromBrevoList: contact not on list (or list missing), continuing", email, listId, status);
      return;
    }
    throw error;
  }
}

async function lookupListName(listId: number): Promise<string | undefined> {
  try {
    const brevoConfig = await configuredBrevo();
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: any = await scheduleBrevo(() => contactsApi.getList(listId));
    const name = response?.body?.name;
    return isString(name) && name.trim().length > 0 ? name : undefined;
  } catch (error: any) {
    debugLog("lookupListName:failed", listId, error?.message || error);
    return undefined;
  }
}

async function flipLocalSubscription(matched: MatchedMemberSubscriptions, listId: number): Promise<void> {
  const unsubscribedAt = dateTimeNowAsValue();
  const updated = matched.subscriptions.map(sub =>
    sub.id === listId && sub.subscribed ? { ...sub, subscribed: false, unsubscribedAt } : sub
  );
  if (JSON.stringify(updated) === JSON.stringify(matched.subscriptions)) {
    return;
  }
  await member.updateOne({ _id: matched.memberId }, { $set: { "mail.subscriptions": updated } });
}

async function flipAllLocalSubscriptions(matched: MatchedMemberSubscriptions): Promise<void> {
  const unsubscribedAt = dateTimeNowAsValue();
  const updated = matched.subscriptions.map(sub =>
    sub.subscribed ? { ...sub, subscribed: false, unsubscribedAt } : sub
  );
  if (updated.length === 0 || JSON.stringify(updated) === JSON.stringify(matched.subscriptions)) {
    return;
  }
  await member.updateOne({ _id: matched.memberId }, { $set: { "mail.subscriptions": updated } });
}

async function writeListUnsubscribeAudit(memberId: string, email: string, listId: number, listName: string | undefined): Promise<void> {
  const timestamp = dateTimeNowAsValue();
  const listLabel = listName || `list #${listId}`;
  try {
    await mailListAudit.updateOne(
      { memberId, listId, timestamp, createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE },
      {
        $setOnInsert: {
          memberId,
          listId,
          timestamp,
          createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE,
          listType: MailListAuditListType.USER_INITIATED,
          status: AuditStatus.info,
          audit: `Unsubscribed from ${listLabel} via branded unsubscribe page (${email})`
        }
      },
      { upsert: true }
    );
  } catch (error: any) {
    debugLog("writeListUnsubscribeAudit:failed", memberId, listId, error?.message || error);
  }
}

async function writeLegacySoftGlobalAudit(memberId: string, email: string): Promise<void> {
  const timestamp = dateTimeNowAsValue();
  try {
    await mailListAudit.updateOne(
      { memberId, listId: 0, timestamp, createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE },
      {
        $setOnInsert: {
          memberId,
          listId: 0,
          timestamp,
          createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE,
          listType: MailListAuditListType.USER_INITIATED,
          status: AuditStatus.info,
          audit: `Unsubscribed via legacy branded unsubscribe link - all local subscriptions disabled (${email})`
        }
      },
      { upsert: true }
    );
  } catch (error: any) {
    debugLog("writeLegacySoftGlobalAudit:failed", memberId, error?.message || error);
  }
}

async function maybeWriteSalesforceConsent(matched: MatchedMemberSubscriptions, beforeSubscribedCount: number, email: string, reason: string): Promise<void> {
  const memberDoc = await member.findById(matched.memberId).lean().exec() as any;
  const afterSubscriptions: Array<{ id: number; subscribed: boolean }> = memberDoc?.mail?.subscriptions || [];
  const afterSubscribedCount = activeSubscribedCount(afterSubscriptions);
  if (!consentWritebackShouldFire(beforeSubscribedCount, afterSubscribedCount)) {
    return;
  }
  const membershipNumber: string | undefined = memberDoc?.membershipNumber || matched.membershipNumber;
  if (!membershipNumber) {
    return;
  }
  const outcome = await notifySalesforceFullyOptedOut({ membershipNumber, reason });
  if (!outcome.attempted) {
    return;
  }
  const auditMessage = outcome.success
    ? `Salesforce consent writeback succeeded after ${reason} (${email}, HTTP ${outcome.status}, ${outcome.latencyMs}ms)`
    : `Salesforce consent writeback failed after ${reason} (${email}): ${outcome.errorCode || "UNKNOWN"} - ${outcome.errorMessage || "no detail"} (HTTP ${outcome.status || "n/a"}, ${outcome.latencyMs}ms)`;
  try {
    await mailListAudit.create({
      memberId: matched.memberId,
      listId: 0,
      timestamp: dateTimeNowAsValue(),
      createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE,
      listType: MailListAuditListType.USER_INITIATED,
      status: outcome.success ? AuditStatus.info : AuditStatus.error,
      audit: auditMessage,
    });
  } catch (auditError: any) {
    debugLog("maybeWriteSalesforceConsent:audit-failed", matched.memberId, auditError?.message || auditError);
  }
}

async function writeFeedbackAudit(memberId: string, email: string, reason: string, comment: string | undefined): Promise<void> {
  const timestamp = dateTimeNowAsValue();
  const message = comment
    ? `Unsubscribe reason: ${reason} - ${comment}`
    : `Unsubscribe reason: ${reason}`;
  try {
    await mailListAudit.create({
      memberId,
      listId: 0,
      timestamp,
      createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE_FEEDBACK,
      listType: MailListAuditListType.USER_INITIATED,
      status: AuditStatus.info,
      audit: { reason, comment: comment || undefined, email, message }
    });
  } catch (error: any) {
    debugLog("writeFeedbackAudit:failed", memberId, error?.message || error);
  }
}

export async function decodeUnsubscribeRequest(req: Request, res: Response): Promise<void> {
  try {
    const token = readToken(req);
    const decoded = await verifyUnsubscribeToken(token);
    if (!decoded) {
      res.status(400).json({ error: "Invalid or expired unsubscribe link" });
      return;
    }
    successfulResponse({
      req,
      res,
      response: { email: decoded.email },
      messageType: `${messageType}:decode`,
      debugLog
    });
  } catch (error) {
    handleError(req, res, `${messageType}:decode`, debugLog, error);
  }
}

export async function confirmUnsubscribe(req: Request, res: Response): Promise<void> {
  try {
    const token = readToken(req);
    const decoded = await verifyUnsubscribeToken(token);
    if (!decoded) {
      res.status(400).json({ error: "Invalid or expired unsubscribe link" });
      return;
    }
    const email = decoded.email;
    const listId = Number.isFinite(decoded.listId) ? decoded.listId : undefined;
    const matched = await findMember(email);
    const beforeSubscribedCount = matched ? activeSubscribedCount(matched.subscriptions) : 0;
    let listName: string | undefined;
    if (isNumber(listId)) {
      await removeContactFromBrevoList(email, listId);
      listName = await lookupListName(listId);
      if (matched) {
        await flipLocalSubscription(matched, listId);
        await writeListUnsubscribeAudit(matched.memberId, email, listId, listName);
        await maybeWriteSalesforceConsent(matched, beforeSubscribedCount, email, "branded-unsubscribe-list");
      }
    } else if (matched) {
      await flipAllLocalSubscriptions(matched);
      await writeLegacySoftGlobalAudit(matched.memberId, email);
      await maybeWriteSalesforceConsent(matched, beforeSubscribedCount, email, "branded-unsubscribe-global");
    }
    successfulResponse({
      req,
      res,
      response: {
        email,
        unsubscribed: true,
        memberMatched: !!matched,
        listId,
        listName
      },
      messageType: `${messageType}:confirm`,
      debugLog
    });
  } catch (error) {
    handleError(req, res, `${messageType}:confirm`, debugLog, error);
  }
}

export async function submitUnsubscribeFeedback(req: Request, res: Response): Promise<void> {
  try {
    const token = readToken(req);
    const decoded = await verifyUnsubscribeToken(token);
    if (!decoded) {
      res.status(400).json({ error: "Invalid or expired unsubscribe link" });
      return;
    }
    const reason = isString(req.body?.reason) ? req.body.reason.trim() : "";
    const comment = isString(req.body?.comment) ? req.body.comment.trim().slice(0, 2000) : "";
    if (!FEEDBACK_REASON_CODES.has(reason)) {
      res.status(400).json({ error: "Unknown reason code" });
      return;
    }
    const email = decoded.email;
    const matchedMember = await member.findOne(
      { email: email.toLowerCase() },
      { _id: 1 }
    ).lean().exec() as any;
    const memberId = matchedMember?.id || matchedMember?._id?.toString();
    if (memberId) {
      await writeFeedbackAudit(memberId, email, reason, comment || undefined);
    }
    successfulResponse({
      req,
      res,
      response: { recorded: !!memberId },
      messageType: `${messageType}:feedback`,
      debugLog
    });
  } catch (error) {
    handleError(req, res, `${messageType}:feedback`, debugLog, error);
  }
}

async function emailIsOnList(email: string, listId: number): Promise<boolean> {
  try {
    const brevoConfig = await configuredBrevo();
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: any = await scheduleBrevo(() => contactsApi.getContactInfo(email));
    const listIds: number[] = response?.body?.listIds || [];
    return listIds.includes(listId);
  } catch (error: any) {
    debugLog("emailIsOnList:lookup-failed", email, listId, error?.response?.statusCode || error?.message || error);
    return false;
  }
}

export async function redirectFromList(req: Request, res: Response): Promise<void> {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    const listIdRaw = Number(req.query.listId);
    const listId = Number.isFinite(listIdRaw) ? listIdRaw : NaN;
    const requestedRedirect = String(req.query.redirect || "").trim();
    if (!email || !Number.isFinite(listId)) {
      res.status(400).send("This unsubscribe link is incomplete or no longer valid.");
      return;
    }
    if (!await emailIsOnList(email, listId)) {
      res.status(400).send("This unsubscribe link is no longer valid - the email address is not on this list.");
      return;
    }
    const sys = await systemConfig();
    const groupHref = (sys?.group?.href || "").replace(/\/+$/, "");
    if (!groupHref) {
      res.status(500).send("Unsubscribe is not configured for this site.");
      return;
    }
    const parent = await contactUsParentSegment();
    const defaultPath = parent ? `/${parent}/unsubscribe` : "/unsubscribe";
    const path = requestedRedirect && requestedRedirect.startsWith("/") ? requestedRedirect : defaultPath;
    const token = await buildUnsubscribeToken(email, undefined, listId);
    res.redirect(`${path}?t=${encodeURIComponent(token)}`);
  } catch (error) {
    handleError(req, res, `${messageType}:redirect-from-list`, debugLog, error);
  }
}
