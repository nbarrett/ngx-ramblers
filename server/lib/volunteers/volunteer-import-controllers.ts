import { Request, Response } from "express";
import debug from "debug";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  VolunteerImportPayload,
  VolunteerImportPlan,
  VolunteerImportResult
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-import.model";
import {
  VolunteerAssignmentStatus,
  VolunteerParish,
  VolunteerSupporterIdentity
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ExternalRecipient } from "../../../projects/ngx-ramblers/src/app/models/external-recipient.model";
import { volunteerImportPlan } from "../../../projects/ngx-ramblers/src/app/functions/volunteer-import";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { dateTimeNowAsValue } from "../shared/dates";
import { volunteerAssignment } from "../mongo/models/volunteer-assignment";
import { volunteerParish } from "../mongo/models/volunteer-parish";
import { volunteerImportAudit } from "../mongo/models/volunteer-import-audit";
import { externalRecipient } from "../mongo/models/external-recipient";
import { member } from "../mongo/models/member";
import * as transforms from "../mongo/controllers/transforms";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("volunteer-import"));
debugLog.enabled = false;
const errorDebugLog = createErrorDebugLog("volunteer-import");

function importedBy(req: Request): string {
  return (req.user as Partial<MemberCookie>)?.memberId ?? "api";
}


function payloadFrom(req: Request): VolunteerImportPayload {
  const body = req.body ?? {};
  return {
    groupCode: body.groupCode?.toString() ?? "",
    volunteers: body.volunteers ?? [],
    parishes: body.parishes ?? [],
    assignments: body.assignments ?? [],
    councilContacts: body.councilContacts ?? []
  };
}

async function planFor(payload: VolunteerImportPayload): Promise<VolunteerImportPlan> {
  const [parishDocuments, memberDocuments, contactDocuments] = await Promise.all([
    volunteerParish.find({groupCode: payload.groupCode}).exec(),
    member.find({}, {firstName: 1, lastName: 1, displayName: 1, email: 1}).exec(),
    externalRecipient.find({}).exec()
  ]);
  return volunteerImportPlan(payload, {
    parishes: parishDocuments.map(document => transforms.toObjectWithId(document)) as VolunteerParish[],
    supporters: memberDocuments.map(document => transforms.toObjectWithId(document)) as VolunteerSupporterIdentity[],
    contacts: contactDocuments.map(document => transforms.toObjectWithId(document)) as ExternalRecipient[]
  }, dateTimeNowAsValue());
}

export async function dryRunImport(req: Request, res: Response): Promise<void> {
  try {
    const payload = payloadFrom(req);
    if (payload.groupCode) {
      const plan = await planFor(payload);
      const response: VolunteerImportResult = {
        dryRun: true,
        summary: plan.summary,
        reviewQueue: plan.reviewQueue,
        parishesWritten: 0,
        assignmentsWritten: 0,
        contactsWritten: 0,
        errors: []
      };
      res.status(200).json({action: ApiAction.QUERY, response});
    } else {
      res.status(400).json({error: "groupCode is required"});
    }
  } catch (error) {
    errorDebugLog("dryRunImport failed", error);
    res.status(500).json({error: "Volunteer import dry run failed", detail: transforms.parseError(error)});
  }
}

export async function applyImport(req: Request, res: Response): Promise<void> {
  try {
    const payload = payloadFrom(req);
    if (payload.groupCode) {
      const now = dateTimeNowAsValue();
      const performedBy = importedBy(req);
      const plan = await planFor(payload);
      const errors: string[] = [];

      const parishesWritten = await Promise.all(plan.parishes.map(parish => volunteerParish.findOneAndUpdate(
        {groupCode: parish.groupCode, parishCode: parish.parishCode},
        {$set: {...parish, updatedAt: now, updatedBy: performedBy}},
        {new: true, upsert: true, runValidators: true}
      ).exec().catch(error => {
        errors.push(`Parish ${parish.parishCode}: ${transforms.parseError(error)}`);
        return null;
      })));

      const assignmentsWritten = await Promise.all(plan.assignments.map(assignment => volunteerAssignment.findOneAndUpdate(
        {sourceReference: assignment.sourceReference},
        {$set: {
          ...assignment,
          status: VolunteerAssignmentStatus.ACTIVE,
          effectiveTo: null,
          updatedAt: now,
          updatedBy: performedBy
        }, $setOnInsert: {createdAt: now, createdBy: performedBy}},
        {new: true, upsert: true, runValidators: true}
      ).exec().catch(error => {
        errors.push(`Assignment ${assignment.sourceReference}: ${transforms.parseError(error)}`);
        return null;
      })));

      const contactsWritten = await Promise.all(plan.contacts.map(contact => externalRecipient.findOneAndUpdate(
        {email: contact.email.toLowerCase()},
        {$set: {...contact, email: contact.email.toLowerCase(), updatedAt: now, updatedBy: performedBy}, $setOnInsert: {createdBy: performedBy, createdAt: now}},
        {new: true, upsert: true, runValidators: true}
      ).exec().catch(error => {
        errors.push(`Contact ${contact.email}: ${transforms.parseError(error)}`);
        return null;
      })));

      const response: VolunteerImportResult = {
        dryRun: false,
        summary: plan.summary,
        reviewQueue: plan.reviewQueue,
        parishesWritten: parishesWritten.filter(written => written).length,
        assignmentsWritten: assignmentsWritten.filter(written => written).length,
        contactsWritten: contactsWritten.filter(written => written).length,
        errors
      };
      await volunteerImportAudit.create({
        groupCode: payload.groupCode,
        fileNames: (req.body?.fileNames ?? []).map((fileName: unknown) => String(fileName)),
        summary: response.summary,
        reviewQueue: response.reviewQueue,
        parishesWritten: response.parishesWritten,
        assignmentsWritten: response.assignmentsWritten,
        contactsWritten: response.contactsWritten,
        errors: response.errors,
        createdAt: now,
        createdBy: performedBy
      }).catch(error => errorDebugLog("failed to record import audit", error));
      res.status(200).json({action: ApiAction.CREATE, response});
    } else {
      res.status(400).json({error: "groupCode is required"});
    }
  } catch (error) {
    errorDebugLog("applyImport failed", error);
    res.status(500).json({error: "Volunteer import failed", detail: transforms.parseError(error)});
  }
}
