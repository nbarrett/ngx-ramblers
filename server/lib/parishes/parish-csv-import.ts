import debug from "debug";
import { Request, Response } from "express";
import { parse } from "csv-parse/sync";
import { STANDARD_CSV_PARSE_OPTIONS } from "../../../projects/ngx-ramblers/src/app/functions/csv";
import {
  VolunteerAssignmentCoverage,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentStatus,
  VolunteerImportCoverageStatus,
  VolunteerParishEligibility,
  VolunteerRoleType
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { envConfig } from "../env-config/env-config";
import { member } from "../mongo/models/member";
import { volunteerAssignment } from "../mongo/models/volunteer-assignment";
import { volunteerParish } from "../mongo/models/volunteer-parish";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("parish-csv-import"));
debugLog.enabled = true;

interface CsvRow {
  parishName: string;
  parishCode?: string;
  status: string;
  assignee?: string;
  assigneeMemberId?: string;
  notes?: string;
}

interface ImportProgress {
  created: number;
  updated: number;
  errors: number;
  errorDetails: string[];
}

function normaliseStatus(raw: string): VolunteerImportCoverageStatus {
  const lower = raw?.toLowerCase()?.trim();
  return lower === "vacant" || lower === "vacancy" || lower === "red" ? VolunteerImportCoverageStatus.VACANT : VolunteerImportCoverageStatus.ALLOCATED;
}

async function resolveSupporterId(row: CsvRow): Promise<string | null> {
  const suppliedId = row.assigneeMemberId?.trim() || null;
  if (suppliedId) {
    return suppliedId;
  } else if (row.assignee?.trim()) {
    const nameParts = row.assignee.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");
      const found = await member.findOne({firstName: new RegExp(`^${firstName}$`, "i"), lastName: new RegExp(`^${lastName}$`, "i")});
      return found?._id?.toString() ?? null;
    } else {
      return null;
    }
  } else {
    return null;
  }
}

async function importRow(row: CsvRow, groupCode: string, importedBy: string, now: number): Promise<keyof Pick<ImportProgress, "created" | "updated">> {
  const parishName = row.parishName.trim();
  const parishCode = row.parishCode?.trim() || `csv-${parishName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const existingParish = await volunteerParish.findOne({groupCode, $or: [{parishCode}, {parishName}]});
  await volunteerParish.findOneAndUpdate(
    {groupCode, parishCode},
    {$set: {groupCode, parishCode, parishName, eligibility: VolunteerParishEligibility.ACTIVE, notes: row.notes?.trim() || null, updatedAt: now, updatedBy: importedBy}},
    {upsert: true, runValidators: true}
  );
  const activeRoleCriteria = {groupCode, parishCode, roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER, status: VolunteerAssignmentStatus.ACTIVE};
  if (normaliseStatus(row.status) === VolunteerImportCoverageStatus.VACANT) {
    await volunteerAssignment.updateMany(activeRoleCriteria, {$set: {status: VolunteerAssignmentStatus.ENDED, effectiveTo: now, updatedAt: now, updatedBy: importedBy}});
  } else {
    const supporterId = await resolveSupporterId(row);
    const activeAssignment = await volunteerAssignment.findOne(activeRoleCriteria);
    if (!activeAssignment) {
      await volunteerAssignment.create({
        groupCode,
        parishCode,
        supporterId,
        unresolvedName: supporterId ? null : row.assignee?.trim() || "Existing allocated coverage",
        identityStatus: supporterId ? VolunteerAssignmentIdentityStatus.LINKED : VolunteerAssignmentIdentityStatus.UNRESOLVED,
        roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER,
        coverage: VolunteerAssignmentCoverage.PERMANENT,
        status: VolunteerAssignmentStatus.ACTIVE,
        effectiveFrom: now,
        createdAt: now,
        createdBy: importedBy,
        updatedAt: now,
        updatedBy: importedBy
      });
    }
  }
  return existingParish ? "updated" : "created";
}

export async function importParishAllocations(req: Request, res: Response): Promise<void> {
  try {
    const csvData = req.body?.csvData;
    const groupCode = req.body?.groupCode;
    const importedBy = req.body?.memberId || "api";
    if (csvData && groupCode) {
      const rows = parse(csvData, STANDARD_CSV_PARSE_OPTIONS) as CsvRow[];
      const now = dateTimeNowAsValue();
      const progress = await rows.reduce(async (previousPromise, row) => {
        const previous = await previousPromise;
        try {
          const outcome = await importRow(row, groupCode, importedBy, now);
          return {...previous, [outcome]: previous[outcome] + 1};
        } catch (error) {
          const detail = `${row.parishName}: ${error instanceof Error ? error.message : String(error)}`;
          return {...previous, errors: previous.errors + 1, errorDetails: [...previous.errorDetails, detail]};
        }
      }, Promise.resolve<ImportProgress>({created: 0, updated: 0, errors: 0, errorDetails: []}));
      debugLog("imported volunteer parishes", progress);
      res.status(200).json({...progress, total: rows.length});
    } else {
      res.status(400).json({error: "csvData and groupCode are required"});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog("CSV import failed", message);
    res.status(500).json({error: `CSV import failed: ${message}`});
  }
}
