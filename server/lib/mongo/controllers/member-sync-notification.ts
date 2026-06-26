import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { pluraliseWithCount } from "../../shared/string-utils";
import { memberSyncNotification } from "../models/member-sync-notification";
import { member } from "../models/member";
import { mailListAudit } from "../models/mail-list-audit";
import * as crudController from "./crud-controller";
import { parseError, toObjectWithId } from "./transforms";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { AuditStatus } from "../../../../projects/ngx-ramblers/src/app/models/audit";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  MemberSyncNotification,
  MemberSyncNotificationCandidate,
  MemberSyncNotificationReconcileRequest,
  MemberSyncNotificationReconcileResult,
  MemberSyncNotificationResolution,
  MemberSyncNotificationSendResult,
  MemberSyncNotificationStatus
} from "../../../../projects/ngx-ramblers/src/app/models/member-sync-notification.model";
import { sendMemberSyncNotificationEmail } from "../../brevo/transactional-mail/send-member-sync-notification-email";
import { dateTimeNowAsValue } from "../../shared/dates";

const debugLog = debug(envConfig.logNamespace("member-sync-notification"));
debugLog.enabled = false;

const controller = crudController.create<MemberSyncNotification>(memberSyncNotification);
export const all = controller.all;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const deleteOne = controller.deleteOne;

function actingUser(req: Request): string {
  return (req as any).user?.memberId ?? "system";
}

function normalisedValue(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === "" ? null : value;
}

function sameHeadOfficeValue(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalisedValue(left) === normalisedValue(right);
}

async function processCandidate(candidate: MemberSyncNotificationCandidate, syncRunAt: number): Promise<"inserted" | "updated" | "superseded-and-inserted"> {
  const activeRow = await memberSyncNotification.findOne({
    memberId: candidate.memberId,
    fieldName: candidate.fieldName,
    status: {$in: [MemberSyncNotificationStatus.PENDING, MemberSyncNotificationStatus.SENT]}
  });
  if (!activeRow) {
    await memberSyncNotification.create({
      memberId: candidate.memberId,
      fieldName: candidate.fieldName,
      localValue: candidate.localValue,
      headOfficeValue: candidate.headOfficeValue,
      resolution: candidate.resolution,
      status: MemberSyncNotificationStatus.PENDING,
      firstSeenAt: syncRunAt,
      lastSeenInSyncRunAt: syncRunAt
    });
    return "inserted";
  }
  const headOfficeMatches = sameHeadOfficeValue(activeRow.headOfficeValue, candidate.headOfficeValue);
  if (activeRow.status === MemberSyncNotificationStatus.SENT && !headOfficeMatches) {
    await memberSyncNotification.updateOne({_id: activeRow._id}, {status: MemberSyncNotificationStatus.SUPERSEDED});
    await memberSyncNotification.create({
      memberId: candidate.memberId,
      fieldName: candidate.fieldName,
      localValue: candidate.localValue,
      headOfficeValue: candidate.headOfficeValue,
      resolution: candidate.resolution,
      status: MemberSyncNotificationStatus.PENDING,
      firstSeenAt: syncRunAt,
      lastSeenInSyncRunAt: syncRunAt
    });
    return "superseded-and-inserted";
  } else if (activeRow.status === MemberSyncNotificationStatus.PENDING && !headOfficeMatches) {
    await memberSyncNotification.updateOne({_id: activeRow._id}, {
      localValue: candidate.localValue,
      headOfficeValue: candidate.headOfficeValue,
      resolution: candidate.resolution,
      lastSeenInSyncRunAt: syncRunAt
    });
    return "updated";
  } else {
    await memberSyncNotification.updateOne({_id: activeRow._id}, {lastSeenInSyncRunAt: syncRunAt});
    return "updated";
  }
}

export async function reconcile(req: Request, res: Response): Promise<void> {
  const request: MemberSyncNotificationReconcileRequest = req.body;
  const syncRunAt = request?.syncRunAt || dateTimeNowAsValue();
  const candidates: MemberSyncNotificationCandidate[] = request?.candidates || [];
  const processedMemberIds: string[] = request?.processedMemberIds || [];
  try {
    const outcomes = await Promise.all(candidates.map(candidate => processCandidate(candidate, syncRunAt)));
    const staleResolved = processedMemberIds.length > 0
      ? await memberSyncNotification.find({
        memberId: {$in: processedMemberIds},
        status: MemberSyncNotificationStatus.PENDING,
        lastSeenInSyncRunAt: {$ne: syncRunAt}
      })
      : [];
    await Promise.all(staleResolved.map(row => memberSyncNotification.updateOne({_id: row._id}, {status: MemberSyncNotificationStatus.SUPERSEDED})));
    const result: MemberSyncNotificationReconcileResult = {
      inserted: outcomes.filter(outcome => outcome === "inserted" || outcome === "superseded-and-inserted").length,
      updated: outcomes.filter(outcome => outcome === "updated").length,
      superseded: outcomes.filter(outcome => outcome === "superseded-and-inserted").length + staleResolved.length
    };
    debugLog("reconcile:result", result);
    res.status(200).json({action: ApiAction.UPDATE, response: result});
  } catch (error) {
    debugLog("reconcile:error", error);
    res.status(500).json({message: "Member sync notification reconcile failed", error: parseError(error)});
  }
}

async function sendForMember(memberId: string, sentBy: string, resend: boolean): Promise<"sent" | "skipped-no-email" | "failed" | "none"> {
  const statuses = resend
    ? [MemberSyncNotificationStatus.PENDING, MemberSyncNotificationStatus.SENT]
    : [MemberSyncNotificationStatus.PENDING];
  const rows = await memberSyncNotification.find({memberId, status: {$in: statuses}});
  if (rows.length === 0) {
    return "none";
  }
  const memberDoc = await member.findById(memberId).lean();
  const memberRecord = memberDoc ? toObjectWithId(memberDoc) as unknown as Member : null;
  if (!memberRecord?.email) {
    return "skipped-no-email";
  }
  const notifications: MemberSyncNotification[] = rows.map(row => toObjectWithId(row));
  const sent = await sendMemberSyncNotificationEmail(memberRecord, notifications);
  if (!sent) {
    return "failed";
  }
  const sentAt = dateTimeNowAsValue();
  await memberSyncNotification.updateMany(
    {_id: {$in: rows.map(row => row._id)}},
    {status: MemberSyncNotificationStatus.SENT, sentAt, sentBy}
  );
  const appliedCount = notifications.filter(notification => notification.resolution === MemberSyncNotificationResolution.APPLIED_FROM_HEAD_OFFICE).length;
  const keptCount = notifications.filter(notification => notification.resolution === MemberSyncNotificationResolution.KEPT_LOCAL_DIVERGENCE).length;
  await mailListAudit.create({
    memberId,
    listId: 0,
    createdBy: sentBy,
    listType: "member-sync-notification",
    timestamp: sentAt,
    status: AuditStatus.info,
    audit: `Member sync notification sent to ${memberRecord.email} for ${pluraliseWithCount(notifications.length, "field")} (${appliedCount} applied from Head Office, ${keptCount} kept): ${notifications.map(notification => notification.fieldName).join(", ")}`
  });
  return "sent";
}

export async function send(req: Request, res: Response): Promise<void> {
  const memberIds: string[] = req.body?.memberIds || [];
  const resend = !!req.body?.resend;
  const sentBy = actingUser(req);
  try {
    const outcomes = await Promise.all(memberIds.map(memberId => sendForMember(memberId, sentBy, resend)));
    const result: MemberSyncNotificationSendResult = {
      sent: outcomes.filter(outcome => outcome === "sent").length,
      skippedNoEmail: outcomes.filter(outcome => outcome === "skipped-no-email").length,
      failed: outcomes.filter(outcome => outcome === "failed").length
    };
    debugLog("send:result", result);
    res.status(200).json({action: ApiAction.UPDATE, response: result});
  } catch (error) {
    debugLog("send:error", error);
    res.status(500).json({message: "Member sync notification send failed", error: parseError(error)});
  }
}
