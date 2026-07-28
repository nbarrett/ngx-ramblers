import { Request, Response } from "express";
import mongoose, { PipelineStage } from "mongoose";
import debug from "debug";
import { isArray, isNumber, isString } from "es-toolkit/compat";
import { memberBulkLoadAudit } from "../models/member-bulk-load-audit";
import { memberUpdateAudit } from "../models/member-update-audit";
import { MemberBulkLoadDateMap } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { envConfig } from "../../env-config/env-config";
import { pluraliseWithCount } from "../../shared/string-utils";
import * as transforms from "./transforms";
import { dateTimeFromMillis } from "../../shared/dates";

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
