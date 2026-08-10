import { Request, Response } from "express";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { VolunteerExportAuditRequest } from "../../../projects/ngx-ramblers/src/app/models/volunteer-import.model";
import { volunteerImportAudit } from "../mongo/models/volunteer-import-audit";
import { volunteerExportAudit } from "../mongo/models/volunteer-export-audit";
import { dateTimeNowAsValue } from "../shared/dates";
import { createErrorDebugLog } from "../shared/error-debug-log";
import * as transforms from "../mongo/controllers/transforms";

const errorDebugLog = createErrorDebugLog("volunteer-audit");
const AUDIT_LIST_LIMIT = 50;

function performedBy(req: Request): string {
  return (req.user as Partial<MemberCookie>)?.memberId ?? "api";
}

export async function importAudits(req: Request, res: Response): Promise<void> {
  try {
    const groupCode = req.query.groupCode?.toString() ?? "";
    if (groupCode) {
      const documents = await volunteerImportAudit.find({groupCode}).sort({createdAt: -1}).limit(AUDIT_LIST_LIMIT).exec();
      res.status(200).json({action: ApiAction.QUERY, response: documents.map(document => transforms.toObjectWithId(document))});
    } else {
      res.status(400).json({error: "groupCode is required"});
    }
  } catch (error) {
    errorDebugLog("importAudits failed", error);
    res.status(500).json({error: "Import history could not be read", detail: transforms.parseError(error)});
  }
}

export async function exportAudits(req: Request, res: Response): Promise<void> {
  try {
    const groupCode = req.query.groupCode?.toString() ?? "";
    if (groupCode) {
      const documents = await volunteerExportAudit.find({groupCode}).sort({createdAt: -1}).limit(AUDIT_LIST_LIMIT).exec();
      res.status(200).json({action: ApiAction.QUERY, response: documents.map(document => transforms.toObjectWithId(document))});
    } else {
      res.status(400).json({error: "groupCode is required"});
    }
  } catch (error) {
    errorDebugLog("exportAudits failed", error);
    res.status(500).json({error: "Export history could not be read", detail: transforms.parseError(error)});
  }
}

export async function recordExportAudit(req: Request, res: Response): Promise<void> {
  try {
    const request: VolunteerExportAuditRequest = req.body ?? {};
    if (request.groupCode && request.reportType && request.fileName) {
      const created = await volunteerExportAudit.create({
        groupCode: request.groupCode,
        reportType: request.reportType,
        fileName: request.fileName,
        rowCount: request.rowCount ?? 0,
        createdAt: dateTimeNowAsValue(),
        createdBy: performedBy(req)
      });
      res.status(200).json({action: ApiAction.CREATE, response: transforms.toObjectWithId(created)});
    } else {
      res.status(400).json({error: "groupCode, reportType and fileName are required"});
    }
  } catch (error) {
    errorDebugLog("recordExportAudit failed", error);
    res.status(500).json({error: "The export could not be audited", detail: transforms.parseError(error)});
  }
}
