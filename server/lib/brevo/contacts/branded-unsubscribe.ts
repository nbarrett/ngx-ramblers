import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { member } from "../../mongo/models/member";
import { mailListAudit } from "../../mongo/models/mail-list-audit";
import {
  MailListAuditListType,
  MailListAuditSource,
  MatchedMemberSubscriptions
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { AuditStatus } from "../../../../projects/ngx-ramblers/src/app/models/audit";
import { verifyUnsubscribeToken } from "./unsubscribe-token";
import { dateTimeNowAsValue } from "../../shared/dates";

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
    { _id: 1, displayName: 1, mail: 1 }
  ).lean().exec() as any;
  if (!matchedMember) return null;
  return {
    memberId: matchedMember.id || matchedMember._id?.toString(),
    subscriptions: matchedMember?.mail?.subscriptions || []
  };
}

async function removeContactFromBrevoList(email: string, listId: number): Promise<void> {
  const brevoConfig = await configuredBrevo();
  const contactsApi = new SibApiV3Sdk.ContactsApi();
  contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
  const removal = new SibApiV3Sdk.RemoveContactFromList();
  removal.emails = [email];
  try {
    await contactsApi.removeContactFromList(listId, removal);
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
    const response: any = await contactsApi.getList(listId);
    const name = response?.body?.name;
    return isString(name) && name.trim().length > 0 ? name : undefined;
  } catch (error: any) {
    debugLog("lookupListName:failed", listId, error?.message || error);
    return undefined;
  }
}

async function flipLocalSubscription(matched: MatchedMemberSubscriptions, listId: number): Promise<void> {
  const updated = matched.subscriptions.map(sub =>
    sub.id === listId ? { ...sub, subscribed: false } : sub
  );
  if (JSON.stringify(updated) === JSON.stringify(matched.subscriptions)) {
    return;
  }
  await member.updateOne({ _id: matched.memberId }, { $set: { "mail.subscriptions": updated } });
}

async function flipAllLocalSubscriptions(matched: MatchedMemberSubscriptions): Promise<void> {
  const updated = matched.subscriptions.map(sub => ({ ...sub, subscribed: false }));
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
    let listName: string | undefined;
    if (typeof listId === "number") {
      await removeContactFromBrevoList(email, listId);
      listName = await lookupListName(listId);
      if (matched) {
        await flipLocalSubscription(matched, listId);
        await writeListUnsubscribeAudit(matched.memberId, email, listId, listName);
      }
    } else if (matched) {
      await flipAllLocalSubscriptions(matched);
      await writeLegacySoftGlobalAudit(matched.memberId, email);
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
