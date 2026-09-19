import { Request, Response } from "express";
import mongoose, { PipelineStage } from "mongoose";
import debug from "debug";
import { isArray, isNumber, isString, uniqBy } from "es-toolkit/compat";
import { memberBulkLoadAudit } from "../models/member-bulk-load-audit";
import { memberUpdateAudit } from "../models/member-update-audit";
import { member } from "../models/member";
import { mailListAudit } from "../models/mail-list-audit";
import { memberEmailSend, MemberEmailSendDocument } from "../models/member-email-send";
import { notificationConfig } from "../models/notification-config";
import {
  Member,
  MemberBulkLoadAudit,
  MemberBulkLoadDateMap,
  MemberBulkLoadDigest,
  MemberBulkLoadDigestEmailSends,
  MemberBulkLoadDigestMember,
  MemberBulkLoadDigestPreview,
  MemberBulkLoadDigestSendRequest,
  MemberBulkLoadDigestSendResult,
  MemberUpdateAudit,
  RamblersMember
} from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { envConfig } from "../../env-config/env-config";
import { pluraliseWithCount } from "../../shared/string-utils";
import * as transforms from "./transforms";
import { dateTimeFromMillis, dateTimeNowAsValue } from "../../shared/dates";
import {
  expiryNotificationConfigIds,
  memberBulkLoadDigest,
  memberBulkLoadDigestCountsLabel
} from "../../../../projects/ngx-ramblers/src/app/functions/member-bulk-load-digest";
import { memberFullName } from "../../../../projects/ngx-ramblers/src/app/functions/member-names";
import { previewMemberBulkLoadDigestEmail, sendMemberBulkLoadDigestEmail } from "../../brevo/transactional-mail/send-member-bulk-load-digest-email";
import { assertSendAllowed, SendRefusedError } from "../../brevo/send-permission";
import { NotificationConfig, SendPurpose } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { AuditStatus } from "../../../../projects/ngx-ramblers/src/app/models/audit";

const debugLog = debug(envConfig.logNamespace("member-bulk-load-audit"));

type MemberBulkLoadDateMapResult = {
  dateMap: MemberBulkLoadDateMap;
};

export async function memberBulkLoadDateMap(req: Request, res: Response) {
  try {
    const pipeline: PipelineStage[] = [
      {$sort: {createdDate: -1}},
      {$unwind: "$members"},
      {$match: {
        "members.membershipNumber": {$type: "string", $ne: ""}
      }},
      {$group: {
        _id: "$members.membershipNumber",
        lastBulkLoadDate: {$first: "$createdDate"}
      }},
      {$group: {
        _id: null,
        entries: {
          $push: {
            k: "$_id",
            v: "$lastBulkLoadDate"
          }
        }
      }},
      {$project: {
        _id: 0,
        dateMap: {$arrayToObject: "$entries"}
      }}
    ];
    const results = await memberBulkLoadAudit.aggregate<MemberBulkLoadDateMapResult>(pipeline);
    const dateMap = results[0]?.dateMap || {};
    res.json(dateMap);
  } catch (error) {
    debugLog("memberBulkLoadDateMap failed:", error);
    res.status(500).json({message: "Failed to build member bulk load date map"});
  }
}

export async function deleteMemberBulkLoadAudit(req: Request, res: Response) {
  const criteria = transforms.mongoIdCriteria(req);
  const sessionId = criteria._id?.toString() || "";
  if (!sessionId) {
    res.status(400).json({message: "Upload session id is required"});
    return;
  }
  const sessionDelete = await memberBulkLoadAudit.deleteOne(criteria).exec();
  const updateAuditDelete = await memberUpdateAudit.deleteMany({uploadSessionId: sessionId}).exec();
  const deleted = sessionDelete.deletedCount === 1;
  debugLog(
    "deleteMemberBulkLoadAudit: session",
    sessionId,
    "deleted",
    deleted,
    "memberUpdateAudit rows",
    updateAuditDelete.deletedCount || 0,
  );
  if (!deleted) {
    res.status(404).json({message: "Upload session not found", id: sessionId});
    return;
  }
  res.status(200).json({
    action: "delete",
    response: {
      id: sessionId,
      deleted: true,
      memberUpdateAuditsDeleted: updateAuditDelete.deletedCount || 0,
    }
  });
}

export async function deleteMemberBulkLoadAuditsByDateRange(req: Request, res: Response) {
  const from = Number(req.body?.from);
  const to = Number(req.body?.to);
  if (!isNumber(from) || !isNumber(to) || !Number.isFinite(from) || !Number.isFinite(to)) {
    res.status(400).json({message: "from and to date values are required"});
    return;
  }
  const rangeStart = Math.min(from, to);
  const rangeEnd = dateTimeFromMillis(Math.max(from, to)).endOf("day").toMillis();
  const sessions = await memberBulkLoadAudit.find({
    createdDate: {$gte: rangeStart, $lte: rangeEnd}
  }).select({_id: 1}).lean().exec();
  const sessionIds = sessions.map(session => session._id.toString());
  if (sessionIds.length === 0) {
    res.status(200).json({
      action: "delete-by-date-range",
      response: {
        deletedCount: 0,
        memberUpdateAuditsDeleted: 0,
        message: "No upload sessions matched the selected date range"
      }
    });
    return;
  }
  const sessionResult = await memberBulkLoadAudit.deleteMany({
    createdDate: {$gte: rangeStart, $lte: rangeEnd}
  }).exec();
  const updateAuditResult = await memberUpdateAudit.deleteMany({
    uploadSessionId: {$in: sessionIds}
  }).exec();
  const deletedCount = sessionResult.deletedCount || 0;
  const memberUpdateAuditsDeleted = updateAuditResult.deletedCount || 0;
  debugLog(
    "deleteMemberBulkLoadAuditsByDateRange: from",
    rangeStart,
    "to",
    rangeEnd,
    "deleted",
    deletedCount,
    "sessions and",
    memberUpdateAuditsDeleted,
    "member update audits",
  );
  res.status(200).json({
    action: "delete-by-date-range",
    response: {
      deletedCount,
      memberUpdateAuditsDeleted,
      message: `Deleted ${pluraliseWithCount(deletedCount, "upload session")}`
    }
  });
}

export async function deleteMemberBulkLoadAuditsByIds(req: Request, res: Response) {
  const rawIds = req.body?.ids;
  if (!isArray(rawIds) || rawIds.length === 0) {
    res.status(400).json({message: "ids array is required"});
    return;
  }
  const sessionIds = rawIds
    .filter((value: unknown): value is string => isString(value) && transforms.isMongoIdString(value.trim()))
    .map((value: string) => value.trim());
  if (sessionIds.length === 0) {
    res.status(400).json({message: "No valid upload session ids supplied"});
    return;
  }
  const objectIds = sessionIds.map(id => new mongoose.Types.ObjectId(id));
  const sessionResult = await memberBulkLoadAudit.deleteMany({_id: {$in: objectIds}}).exec();
  const updateAuditResult = await memberUpdateAudit.deleteMany({
    uploadSessionId: {$in: sessionIds}
  }).exec();
  const deletedCount = sessionResult.deletedCount || 0;
  const memberUpdateAuditsDeleted = updateAuditResult.deletedCount || 0;
  debugLog(
    "deleteMemberBulkLoadAuditsByIds: requested",
    sessionIds.length,
    "deleted",
    deletedCount,
    "sessions and",
    memberUpdateAuditsDeleted,
    "member update audits",
  );
  res.status(200).json({
    action: "delete-by-ids",
    response: {
      deletedCount,
      memberUpdateAuditsDeleted,
      message: `Deleted ${pluraliseWithCount(deletedCount, "upload session")}`
    }
  });
}

export async function clearAllMemberBulkLoadAudits(req: Request, res: Response) {
  const sessionResult = await memberBulkLoadAudit.deleteMany({});
  const updateAuditResult = await memberUpdateAudit.deleteMany({});
  const deletedCount = sessionResult.deletedCount || 0;
  const memberUpdateAuditsDeleted = updateAuditResult.deletedCount || 0;
  debugLog(
    "clearAllMemberBulkLoadAudits: deleted",
    deletedCount,
    "sessions and",
    memberUpdateAuditsDeleted,
    "member update audits",
  );
  res.status(200).json({
    action: "clear-all",
    response: {
      deletedCount,
      memberUpdateAuditsDeleted,
      message: `Cleared ${pluraliseWithCount(deletedCount, "upload session")}`
    }
  });
}

function actingUser(req: Request): string {
  return (req as any).user?.memberId ?? "system";
}

async function uploadedMembersByEmail(emails: string[]): Promise<Map<string, RamblersMember>> {
  if (emails.length === 0) {
    return new Map();
  } else {
    const rows: {_id: string; member: RamblersMember}[] = await memberBulkLoadAudit.aggregate([
      {$match: {"members.email": {$in: emails}}},
      {$sort: {createdDate: -1}},
      {$unwind: "$members"},
      {$match: {"members.email": {$in: emails}}},
      {$group: {_id: {$toLower: "$members.email"}, member: {$first: "$members"}}}
    ]).exec();
    return new Map(rows.map(row => [row._id, row.member]));
  }
}

async function expiryEmailSendsForSession(session: MemberBulkLoadAudit): Promise<MemberBulkLoadDigestEmailSends> {
  const configs: NotificationConfig[] = await notificationConfig.find({}).lean().exec()
    .then(docs => docs.map(doc => transforms.toObjectWithId(doc) as NotificationConfig));
  const {warningIds, expiryIds} = expiryNotificationConfigIds(configs);
  const nextSession = await memberBulkLoadAudit.findOne({createdDate: {$gt: session.createdDate}}).sort({createdDate: 1}).lean().exec();
  const sentAt = nextSession
    ? {$gte: session.createdDate, $lt: nextSession.createdDate}
    : {$gte: session.createdDate};
  const sends: MemberEmailSendDocument[] = await memberEmailSend
    .find({notificationConfigId: {$in: [...warningIds, ...expiryIds]}, sentAt})
    .sort({sentAt: 1}).lean().exec();
  const memberIds = [...new Set(sends.map(send => send.memberId))].filter(id => mongoose.isValidObjectId(id));
  const memberDocs = memberIds.length > 0 ? await member.find({_id: {$in: memberIds}}).lean().exec() : [];
  const members: Member[] = memberDocs.map(doc => transforms.toObjectWithId(doc));
  const unnamedEmails = sends
    .filter(send => !send.fullName && !members.some(item => item.id === send.memberId))
    .map(send => send.email)
    .filter(email => !!email);
  const uploaded = await uploadedMembersByEmail(unnamedEmails);
  const digestMemberFor = (send: MemberEmailSendDocument): MemberBulkLoadDigestMember => {
    const existing = members.find(item => item.id === send.memberId);
    const uploadedMember = uploaded.get((send.email || "").toLowerCase());
    return {
      name: send.fullName || memberFullName(existing) || memberFullName(uploadedMember) || send.email || "Unknown member",
      membershipNumber: send.membershipNumber || existing?.membershipNumber || uploadedMember?.membershipNumber || "",
      email: send.email || "",
      errorText: null
    };
  };
  const membersSentOneOf = (configIds: string[]): MemberBulkLoadDigestMember[] => uniqBy(
    sends.filter(send => configIds.includes(send.notificationConfigId)), send => send.memberId
  ).map(digestMemberFor);
  return {expiryWarnings: membersSentOneOf(warningIds), expiryNotices: membersSentOneOf(expiryIds)};
}

async function committeeSummaryDigest(sessionId: string): Promise<MemberBulkLoadDigest | null> {
  const sessionDoc = await memberBulkLoadAudit.findById(sessionId).lean().exec();
  if (!sessionDoc) {
    return null;
  } else {
    const session = transforms.toObjectWithId(sessionDoc) as MemberBulkLoadAudit;
    const auditDocs = await memberUpdateAudit.find({uploadSessionId: session.id}).lean().exec();
    const audits: MemberUpdateAudit[] = auditDocs.map(doc => transforms.toObjectWithId(doc));
    const memberIds = audits.map(audit => audit.memberId || audit.member?.id).filter(Boolean);
    const withUploader = session.createdBy && session.createdBy !== "system"
      ? [...memberIds, session.createdBy]
      : memberIds;
    const uniqueIds = [...new Set(withUploader)];
    const memberDocs = uniqueIds.length > 0
      ? await member.find({_id: {$in: uniqueIds}}).lean().exec()
      : [];
    const members: Member[] = memberDocs.map(doc => transforms.toObjectWithId(doc));
    const uploadedBy = members.find(item => item.id === session.createdBy);
    const emailSends = await expiryEmailSendsForSession(session);
    return memberBulkLoadDigest(session, audits, members, memberFullName(uploadedBy, session.createdBy === "system" ? "System" : "Unknown member"), emailSends);
  }
}

export async function previewCommitteeSummary(req: Request, res: Response): Promise<void> {
  try {
    const digest = await committeeSummaryDigest(req.params.id);
    if (!digest) {
      res.status(404).json({message: "Upload session not found", id: req.params.id});
    } else {
      const preview: MemberBulkLoadDigestPreview = await previewMemberBulkLoadDigestEmail(digest);
      res.status(200).json({action: ApiAction.QUERY, response: preview});
    }
  } catch (error) {
    debugLog("previewCommitteeSummary failed:", error);
    res.status(500).json({message: "Failed to preview committee summary", error: transforms.parseError(error)});
  }
}

export async function sendCommitteeSummary(req: Request, res: Response): Promise<void> {
  const sessionId = req.params.id;
  const sendRequest: MemberBulkLoadDigestSendRequest = req.body;
  if (!sessionId) {
    res.status(400).json({message: "Upload session id is required"});
  } else {
    try {
      await assertSendAllowed(SendPurpose.BULK_LOAD_DIGEST, {requestedBy: actingUser(req)});
      const digest = await committeeSummaryDigest(sessionId);
      if (!digest) {
        res.status(404).json({message: "Upload session not found", id: sessionId});
      } else {
        const sendResult = await sendMemberBulkLoadDigestEmail(digest, sendRequest?.recipients || []);
        if (!sendResult.sent) {
          res.status(500).json({message: `Committee summary was not sent. ${sendResult.problem || ""}`.trim()});
        } else {
          const sentBy = actingUser(req);
          await mailListAudit.create({
            memberId: sentBy,
            listId: 0,
            createdBy: sentBy,
            listType: "member-bulk-load-digest",
            timestamp: dateTimeNowAsValue(),
            status: AuditStatus.info,
            audit: `Committee bulk load summary sent for session ${sessionId} to ${sendResult.recipients.map(recipient => recipient.email).join(", ")} (${memberBulkLoadDigestCountsLabel(digest)})`
          });
          const result: MemberBulkLoadDigestSendResult = {
            sent: true,
            recipientCount: sendResult.recipients.length,
            recipients: sendResult.recipients.map(recipient => recipient.email)
          };
          res.status(200).json({action: ApiAction.UPDATE, response: result});
        }
      }
    } catch (error) {
      debugLog("sendCommitteeSummary failed:", error);
      if (error instanceof SendRefusedError) {
        res.status(409).json({message: error.message, error: transforms.parseError(error)});
      } else {
        res.status(500).json({message: "Failed to send committee summary", error: transforms.parseError(error)});
      }
    }
  }
}
