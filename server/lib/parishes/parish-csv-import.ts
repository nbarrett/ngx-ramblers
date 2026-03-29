import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { parse } from "csv-parse/sync";
import { parishAllocation } from "../mongo/models/parish-allocation";
import { dateTimeNowAsValue } from "../shared/dates";
import { ParishAllocation, ParishStatus } from "../../../projects/ngx-ramblers/src/app/models/parish-map.model";
import { member } from "../mongo/models/member";

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

function normaliseStatus(raw: string): ParishStatus {
  const lower = raw?.toLowerCase()?.trim();
  if (lower === "vacant" || lower === "vacancy" || lower === "red") {
    return ParishStatus.VACANT;
  }
  return ParishStatus.ALLOCATED;
}

async function resolveMemberId(row: CsvRow): Promise<string> {
  if (row.assigneeMemberId?.trim()) {
    return row.assigneeMemberId.trim();
  }
  if (!row.assignee?.trim()) {
    return "";
  }
  const name = row.assignee.trim();
  const nameParts = name.split(/\s+/);
  if (nameParts.length >= 2) {
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");
    const found = await member.findOne({firstName: new RegExp(`^${firstName}$`, "i"), lastName: new RegExp(`^${lastName}$`, "i")});
    if (found) {
      debugLog(`Resolved assignee "${name}" to member ${found._id}`);
      return String(found._id);
    }
  }
  debugLog(`Could not resolve assignee "${name}" to a member`);
  return "";
}

export async function importParishAllocations(req: Request, res: Response) {
  try {
    const {csvData, groupCode, memberId} = req.body;

    if (!csvData || !groupCode) {
      return res.status(400).json({error: "csvData and groupCode are required"});
    }

    const rows: CsvRow[] = parse(csvData, {
      columns: true,
      delimiter: ",",
      escape: "\"",
      skip_empty_lines: true,
      trim: true
    });

    debugLog(`Parsed ${rows.length} rows from CSV for group ${groupCode}`);

    const now = dateTimeNowAsValue();
    const results = {created: 0, updated: 0, errors: 0, total: rows.length, errorDetails: [] as string[]};

    await Promise.all(rows.map(async (row) => {
      try {
        const parishName = row.parishName.trim();
        const parishCode = row.parishCode?.trim() || `csv-${parishName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        const status = normaliseStatus(row.status);
        const assigneeMemberId = await resolveMemberId(row);
        const filter = {groupCode, parishCode};
        const update: Partial<ParishAllocation> = {
          groupCode,
          parishCode,
          parishName,
          status,
          assignee: row.assignee?.trim() || "",
          assigneeMemberId,
          notes: row.notes?.trim() || "",
          updatedAt: now,
          updatedBy: memberId || ""
        };

        const existing = await parishAllocation.findOne(filter) || await parishAllocation.findOne({groupCode, parishName});
        if (existing) {
          await parishAllocation.updateOne({_id: existing._id}, {$set: update});
          results.updated++;
        } else {
          await parishAllocation.create(update);
          results.created++;
        }
      } catch (error) {
        const detail = `${row.parishName}: ${error.message}`;
        debugLog(`Error importing row ${detail}`);
        results.errors++;
        results.errorDetails.push(detail);
      }
    }));

    debugLog(`Import complete: ${results.created} created, ${results.updated} updated, ${results.errors} errors`);
    res.json(results);
  } catch (error) {
    debugLog(`CSV import failed: ${error.message}`);
    res.status(500).json({error: `CSV import failed: ${error.message}`});
  }
}
