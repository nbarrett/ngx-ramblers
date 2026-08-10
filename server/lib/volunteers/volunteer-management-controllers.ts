import { Request, Response } from "express";
import debug from "debug";
import { omit } from "es-toolkit/compat";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  VolunteerAssignment,
  VolunteerAssignmentAuditAction,
  VolunteerAssignmentBulkAction,
  VolunteerAssignmentBulkRequest,
  VolunteerAssignmentRequest,
  VolunteerAssignmentScope,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerManagementSnapshot,
  VolunteerMapCoverage,
  VolunteerParish,
  VolunteerParishEligibility,
  VolunteerRoleType
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { envConfig } from "../env-config/env-config";
import { volunteerCoverageSummary } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-management";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { dateTimeNowAsValue } from "../shared/dates";
import { volunteerAssignment } from "../mongo/models/volunteer-assignment";
import { volunteerParish } from "../mongo/models/volunteer-parish";
import { recordVolunteerAssignmentAudit, recordVolunteerAssignmentAudits } from "./volunteer-assignment-audit-writer";
import * as transforms from "../mongo/controllers/transforms";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("volunteer-management"));
debugLog.enabled = false;
const errorDebugLog = createErrorDebugLog("volunteer-management");

function authenticatedMemberId(req: Request): string {
  return (req.user as Partial<MemberCookie>)?.memberId ?? "api";
}

export async function snapshot(req: Request, res: Response): Promise<void> {
  try {
    const groupCode = req.query.groupCode?.toString() ?? "";
    if (groupCode) {
      const [parishDocuments, assignmentDocuments] = await Promise.all([
        volunteerParish.find({groupCode}).sort({parishName: 1}).exec(),
        volunteerAssignment.find({groupCode}).sort({effectiveFrom: -1}).exec()
      ]);
      const parishes = parishDocuments.map(document => transforms.toObjectWithId(document)) as VolunteerParish[];
      const assignments = assignmentDocuments.map(document => transforms.toObjectWithId(document)) as VolunteerAssignment[];
      const response: VolunteerManagementSnapshot = {parishes, assignments, summary: volunteerCoverageSummary(parishes, assignments)};
      res.status(200).json({action: ApiAction.QUERY, response});
    } else {
      res.status(400).json({error: "groupCode is required"});
    }
  } catch (error) {
    errorDebugLog("snapshot failed", error);
    res.status(500).json({error: "Failed to load volunteer-management data", detail: transforms.parseError(error)});
  }
}

export async function coverage(req: Request, res: Response): Promise<void> {
  try {
    const groupCode = req.query.groupCode?.toString() ?? "";
    if (groupCode) {
      const [parishDocuments, assignmentDocuments] = await Promise.all([
        volunteerParish.find({groupCode}).sort({parishName: 1}).exec(),
        volunteerAssignment.find({
          groupCode,
          status: VolunteerAssignmentStatus.ACTIVE,
          roleType: {$in: [VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, VolunteerRoleType.LOCAL_FOOTPATH_OFFICER]},
          $or: [{scope: VolunteerAssignmentScope.PARISH}, {scope: {$exists: false}}]
        }).exec()
      ]);
      const parishes = parishDocuments.map(document => transforms.toObjectWithId(document)) as VolunteerParish[];
      const assignments = assignmentDocuments.map(document => {
        const assignment = transforms.toObjectWithId(document) as VolunteerAssignment;
        const nonPersonalFields = {
          id: assignment.id,
          parishCode: assignment.parishCode,
          roleType: assignment.roleType,
          coverage: assignment.coverage,
          status: assignment.status
        };
        return assignment.roleType === VolunteerRoleType.PARISH_FOOTPATH_OBSERVER ? {
          ...nonPersonalFields,
          supporterId: assignment.supporterId,
          unresolvedName: assignment.unresolvedName
        } : nonPersonalFields;
      });
      const response: VolunteerMapCoverage = {parishes, assignments};
      res.status(200).json({action: ApiAction.QUERY, response});
    } else {
      res.status(400).json({error: "groupCode is required"});
    }
  } catch (error) {
    errorDebugLog("coverage failed", error);
    res.status(500).json({error: "Failed to load volunteer coverage", detail: transforms.parseError(error)});
  }
}

export async function saveParish(req: Request, res: Response): Promise<void> {
  try {
    const now = dateTimeNowAsValue();
    const updatedBy = authenticatedMemberId(req);
    const parish = req.body as VolunteerParish;
    if (parish.groupCode && parish.parishCode && parish.parishName) {
      const document = await volunteerParish.findOneAndUpdate(
        {groupCode: parish.groupCode, parishCode: parish.parishCode},
        {$set: {...omit(parish, ["id"]), eligibility: parish.eligibility ?? VolunteerParishEligibility.ACTIVE, updatedAt: now, updatedBy}},
        {new: true, upsert: true, runValidators: true}
      ).exec();
      res.status(200).json({action: parish.id ? ApiAction.UPDATE : ApiAction.CREATE, response: transforms.toObjectWithId(document)});
    } else {
      res.status(400).json({error: "groupCode, parishCode and parishName are required"});
    }
  } catch (error) {
    errorDebugLog("saveParish failed", error);
    res.status(500).json({error: "Failed to save parish", detail: transforms.parseError(error)});
  }
}

export async function createAssignment(req: Request, res: Response): Promise<void> {
  try {
    const now = dateTimeNowAsValue();
    const createdBy = authenticatedMemberId(req);
    const input = req.body as VolunteerAssignmentRequest;
    const scopedTarget = input.scope === VolunteerAssignmentScope.RIGHTS_OF_WAY_GROUP ? input.rightsOfWayGroupCode
      : input.scope === VolunteerAssignmentScope.SECTOR ? input.sectorCode
        : input.parishCode;
    if (input.groupCode && scopedTarget && input.roleType) {
      const document = await volunteerAssignment.create({
        ...omit(input, ["id", "createdAt", "createdBy", "updatedAt", "updatedBy", "effectiveTo"]),
        coverage: input.coverage ?? VolunteerAssignmentCoverage.PERMANENT,
        identityStatus: input.supporterId ? VolunteerAssignmentIdentityStatus.LINKED : VolunteerAssignmentIdentityStatus.UNRESOLVED,
        status: VolunteerAssignmentStatus.ACTIVE,
        effectiveFrom: input.effectiveFrom ?? null,
        effectiveTo: input.effectiveTo ?? null,
        createdAt: now,
        createdBy,
        updatedAt: now,
        updatedBy: createdBy
      });
      const created = transforms.toObjectWithId(document) as VolunteerAssignment;
      await recordVolunteerAssignmentAudit(VolunteerAssignmentAuditAction.CREATED, null, created, createdBy);
      res.status(200).json({action: ApiAction.CREATE, response: created});
    } else {
      res.status(400).json({error: "groupCode, roleType and a parish, rights-of-way group or sector are required"});
    }
  } catch (error) {
    errorDebugLog("createAssignment failed", error);
    res.status(500).json({error: "Failed to create volunteer assignment", detail: transforms.parseError(error)});
  }
}

export async function updateAssignment(req: Request, res: Response): Promise<void> {
  try {
    const now = dateTimeNowAsValue();
    const updatedBy = authenticatedMemberId(req);
    const input = req.body as VolunteerAssignmentRequest;
    const existing = await volunteerAssignment.findById(req.params.id).exec();
    const document = await volunteerAssignment.findByIdAndUpdate(
      req.params.id,
      {$set: {...omit(input, ["id", "createdAt", "createdBy"]), identityStatus: input.supporterId ? VolunteerAssignmentIdentityStatus.LINKED : VolunteerAssignmentIdentityStatus.UNRESOLVED, updatedAt: now, updatedBy}},
      {new: true, runValidators: true}
    ).exec();
    if (document) {
      const updated = transforms.toObjectWithId(document) as VolunteerAssignment;
      const before = existing ? transforms.toObjectWithId(existing) as VolunteerAssignment : null;
      await recordVolunteerAssignmentAudit(VolunteerAssignmentAuditAction.UPDATED, before, updated, updatedBy);
      res.status(200).json({action: ApiAction.UPDATE, response: updated});
    } else {
      res.status(404).json({error: "Volunteer assignment not found"});
    }
  } catch (error) {
    errorDebugLog("updateAssignment failed", error);
    res.status(500).json({error: "Failed to update volunteer assignment", detail: transforms.parseError(error)});
  }
}

export async function endAssignment(req: Request, res: Response): Promise<void> {
  try {
    const now = dateTimeNowAsValue();
    const updatedBy = authenticatedMemberId(req);
    const existing = await volunteerAssignment.findById(req.params.id).exec();
    const document = await volunteerAssignment.findByIdAndUpdate(req.params.id, {$set: {
      status: VolunteerAssignmentStatus.ENDED,
      effectiveTo: now,
      updatedAt: now,
      updatedBy
    }}, {new: true, runValidators: true}).exec();
    if (document) {
      const ended = transforms.toObjectWithId(document) as VolunteerAssignment;
      const before = existing ? transforms.toObjectWithId(existing) as VolunteerAssignment : null;
      await recordVolunteerAssignmentAudit(VolunteerAssignmentAuditAction.ENDED, before, ended, updatedBy);
      res.status(200).json({action: ApiAction.UPDATE, response: ended});
    } else {
      res.status(404).json({error: "Volunteer assignment not found"});
    }
  } catch (error) {
    errorDebugLog("endAssignment failed", error);
    res.status(500).json({error: "Failed to end volunteer assignment", detail: transforms.parseError(error)});
  }
}

interface BulkUpdatePlan {
  update: Record<string, any>;
  auditAction: VolunteerAssignmentAuditAction;
}

function bulkUpdatePlanFor(input: VolunteerAssignmentBulkRequest, now: number): BulkUpdatePlan | null {
  if (input.action === VolunteerAssignmentBulkAction.REPLACE_SUPPORTER) {
    return input.supporterId ? {
      update: {supporterId: input.supporterId, unresolvedName: null, identityStatus: VolunteerAssignmentIdentityStatus.LINKED},
      auditAction: VolunteerAssignmentAuditAction.SUPPORTER_REPLACED
    } : null;
  } else if (input.action === VolunteerAssignmentBulkAction.MARK_PERMANENT) {
    return {update: {coverage: VolunteerAssignmentCoverage.PERMANENT}, auditAction: VolunteerAssignmentAuditAction.COVERAGE_CHANGED};
  } else if (input.action === VolunteerAssignmentBulkAction.MARK_TEMPORARY) {
    return {update: {coverage: VolunteerAssignmentCoverage.TEMPORARY}, auditAction: VolunteerAssignmentAuditAction.COVERAGE_CHANGED};
  } else if (input.action === VolunteerAssignmentBulkAction.END) {
    return {update: {status: VolunteerAssignmentStatus.ENDED, effectiveTo: now}, auditAction: VolunteerAssignmentAuditAction.ENDED};
  } else {
    return null;
  }
}

export async function bulkUpdateAssignments(req: Request, res: Response): Promise<void> {
  try {
    const now = dateTimeNowAsValue();
    const updatedBy = authenticatedMemberId(req);
    const input = req.body as VolunteerAssignmentBulkRequest;
    const plan = bulkUpdatePlanFor(input, now);
    if (input.groupCode && (input.assignmentIds?.length ?? 0) > 0 && plan) {
      const criteria = {_id: {$in: input.assignmentIds}, groupCode: input.groupCode};
      const before = (await volunteerAssignment.find(criteria).exec()).map(document => transforms.toObjectWithId(document)) as VolunteerAssignment[];
      await volunteerAssignment.updateMany(criteria, {$set: {...plan.update, updatedAt: now, updatedBy}}, {runValidators: true}).exec();
      const assignments = (await volunteerAssignment.find(criteria).exec()).map(document => transforms.toObjectWithId(document)) as VolunteerAssignment[];
      await recordVolunteerAssignmentAudits(plan.auditAction, before, assignments, updatedBy);
      res.status(200).json({action: ApiAction.UPDATE, response: {updated: assignments.length, assignments}});
    } else {
      res.status(400).json({error: "groupCode, a supported action and at least one assignmentId are required"});
    }
  } catch (error) {
    errorDebugLog("bulkUpdateAssignments failed", error);
    res.status(500).json({error: "Failed to update volunteer assignments", detail: transforms.parseError(error)});
  }
}

export async function deleteGroupData(req: Request, res: Response): Promise<void> {
  try {
    const groupCode = req.body?.groupCode?.toString() ?? "";
    if (groupCode) {
      const [parishes, assignments] = await Promise.all([
        volunteerParish.deleteMany({groupCode}).exec(),
        volunteerAssignment.deleteMany({groupCode}).exec()
      ]);
      res.status(200).json({action: ApiAction.DELETE, response: {parishes: parishes.deletedCount, assignments: assignments.deletedCount}});
    } else {
      res.status(400).json({error: "groupCode is required"});
    }
  } catch (error) {
    errorDebugLog("deleteGroupData failed", error);
    res.status(500).json({error: "Failed to clear volunteer-management data", detail: transforms.parseError(error)});
  }
}
