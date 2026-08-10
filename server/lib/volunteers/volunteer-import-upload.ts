import { Request, Response } from "express";
import { readFile, unlink } from "fs/promises";
import { isObject, trim, values } from "es-toolkit/compat";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  LegacyAssignmentRecord,
  LegacyCouncilContactRecord,
  LegacyParishRecord,
  LegacyVolunteerRecord,
  VolunteerImportPayload,
  VolunteerImportUploadResult,
  VolunteerWorkbookParseStats
} from "../../../projects/ngx-ramblers/src/app/models/volunteer-import.model";
import { VolunteerAssignmentScope, VolunteerParishType } from "../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { envConfig } from "../env-config/env-config";
import { exceljsFrom } from "../ramblers/workbook-reader";
import * as transforms from "../mongo/controllers/transforms";
import { createErrorDebugLog } from "../shared/error-debug-log";
import debug from "debug";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("volunteer-import-upload"));
debugLog.enabled = false;
const errorDebugLog = createErrorDebugLog("volunteer-import-upload");

type Row = Record<string, string>;

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  } else if (isObject(value) && "text" in value) {
    return String((value as {text: unknown}).text ?? "").trim();
  } else if (isObject(value) && "result" in value) {
    return String((value as {result: unknown}).result ?? "").trim();
  } else {
    return String(value).trim();
  }
}

function yes(value: string): boolean {
  const normalised = value.trim().toLowerCase();
  return normalised === "yes" || normalised === "true" || normalised === "y" || normalised === "1";
}

function splitName(fullName: string): {firstName?: string; lastName: string} {
  const parts = fullName.trim().split(/\s+/).filter(part => part);
  if (parts.length > 1) {
    return {firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1]};
  } else {
    return {lastName: fullName.trim()};
  }
}

function parishTypeFrom(value: string): VolunteerParishType | undefined {
  const normalised = value.trim().toLowerCase();
  if (normalised === "1" || normalised === "parish") {
    return VolunteerParishType.PARISH;
  } else if (normalised === "2" || normalised.includes("non-parished") || normalised.includes("non parished") || normalised === "area") {
    return VolunteerParishType.NON_PARISHED_AREA;
  } else if (normalised === "3" || normalised === "ward") {
    return VolunteerParishType.WARD;
  } else {
    return undefined;
  }
}

function scopeFrom(value: string): VolunteerAssignmentScope {
  const normalised = value.trim().toLowerCase();
  if (normalised.includes("group")) {
    return VolunteerAssignmentScope.RIGHTS_OF_WAY_GROUP;
  } else if (normalised.includes("sector")) {
    return VolunteerAssignmentScope.SECTOR;
  } else {
    return VolunteerAssignmentScope.PARISH;
  }
}

async function sheetsFrom(buffer: Buffer): Promise<Map<string, Row[]>> {
  const {Workbook} = exceljsFrom(await import("exceljs"));
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets = new Map<string, Row[]>();
  workbook.worksheets.forEach(sheet => {
    const header = (sheet.getRow(1).values as unknown[]).map(value => cellText(value).toLowerCase());
    const rows: Row[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const record: Row = {};
        header.forEach((key, index) => {
          if (key) {
            record[key] = cellText(row.getCell(index).value);
          }
        });
        if (values(record).some(value => value)) {
          rows.push(record);
        }
      }
    });
    sheets.set(sheet.name.trim().toLowerCase(), rows);
  });
  return sheets;
}

export function parishesFrom(rows: Row[]): LegacyParishRecord[] {
  return rows
    .map(row => ({
      reference: row["parish code"],
      parishCode: row["parish code"],
      parishName: row["parish name"],
      localAuthorityName: row["local authority"] || undefined,
      sectorCode: row["sector"] || undefined,
      rightsOfWayGroupCode: row["rights of way group"] || undefined,
      membershipGroupCode: row["membership group"] || undefined,
      parishType: parishTypeFrom(row["type"] ?? row["parish type"] ?? ""),
      noPublicRightsOfWay: yes(row["no public rights of way"] ?? ""),
      notes: row["notes"] || undefined
    }))
    .filter(parish => parish.parishCode);
}

export function assignmentsFrom(rows: Row[]): {assignments: LegacyAssignmentRecord[]; volunteers: LegacyVolunteerRecord[]} {
  const volunteerByEmail = new Map<string, LegacyVolunteerRecord>();
  const assignments = rows.map((row, index) => {
    const email = (row["volunteer email"] ?? "").trim();
    const emailReference = email.toLowerCase();
    if (emailReference && !volunteerByEmail.has(emailReference)) {
      const names = splitName(row["volunteer name"] ?? "");
      volunteerByEmail.set(emailReference, {reference: emailReference, email, firstName: names.firstName, lastName: names.lastName || email});
    }
    const scope = scopeFrom(row["scope"] ?? "");
    const covers = (row["covers"] ?? "").trim();
    return {
      reference: `row-${index + 1}`,
      parishReference: scope === VolunteerAssignmentScope.PARISH ? covers : "",
      volunteerReference: emailReference,
      role: row["role"] ?? "",
      scope,
      scopeReference: scope === VolunteerAssignmentScope.PARISH ? undefined : covers,
      temporary: (row["cover"] ?? "").trim().toLowerCase() === "temporary",
      notes: row["notes"] || undefined
    } as LegacyAssignmentRecord;
  });
  return {assignments, volunteers: Array.from(volunteerByEmail.values())};
}

export function contactsFrom(rows: Row[]): LegacyCouncilContactRecord[] {
  return rows.map((row, index) => ({
    reference: `contact-${index + 1}`,
    parishReference: row["parish code"] || undefined,
    organisationName: row["organisation"] || undefined,
    contactName: row["contact name"] || undefined,
    roleTitle: row["role"] || undefined,
    email: row["email"] || undefined,
    telephone: row["telephone"] || undefined,
    postalAddress: row["postal address"] || undefined,
    notes: row["notes"] || undefined
  })).filter(contact => contact.email || contact.organisationName);
}

interface UploadedFile {
  path: string;
  originalname: string;
}

function uploadedWorkbook(req: Request): UploadedFile | undefined {
  return (req as unknown as {file?: UploadedFile}).file;
}

export async function uploadImportFiles(req: Request, res: Response): Promise<void> {
  const workbookFile = uploadedWorkbook(req);
  try {
    const groupCode = trim(req.body?.groupCode?.toString() ?? "");
    if (!groupCode) {
      res.status(400).json({error: "groupCode is required"});
    } else if (!workbookFile) {
      res.status(400).json({error: "Upload the volunteer structure workbook (.xlsx) with Parishes, Assignments and Contacts sheets"});
    } else {
      const buffer = await readFile(workbookFile.path);
      await unlink(workbookFile.path).catch(() => undefined);
      const sheets = await sheetsFrom(buffer);
      const parishes = parishesFrom(sheets.get("parishes") ?? []);
      const {assignments, volunteers} = assignmentsFrom(sheets.get("assignments") ?? []);
      const councilContacts = contactsFrom(sheets.get("contacts") ?? []);
      const payload: VolunteerImportPayload = {groupCode, volunteers, parishes, assignments, councilContacts};
      const parse: VolunteerWorkbookParseStats = {
        fileName: workbookFile.originalname,
        parishes: parishes.length,
        assignments: assignments.length,
        volunteers: volunteers.length,
        contacts: councilContacts.length,
        contactsWithEmail: councilContacts.filter(contact => contact.email).length,
        missingSheets: ["parishes", "assignments", "contacts"].filter(name => !sheets.has(name))
      };
      const response: VolunteerImportUploadResult = {payload, parse};
      res.status(200).json({action: ApiAction.QUERY, response});
    }
  } catch (error) {
    errorDebugLog("uploadImportFiles failed", error);
    res.status(500).json({error: "The uploaded workbook could not be read", detail: transforms.parseError(error)});
  }
}
