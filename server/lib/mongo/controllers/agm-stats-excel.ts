import debug from "debug";
import { Request, Response } from "express";
import type { Workbook } from "exceljs";
import { envConfig } from "../../env-config/env-config";
import { exceljsFrom } from "../../ramblers/workbook-reader";
import {
  AGM_STATS_CURRENCY_METRICS,
  AGM_STATS_EMAIL_SECTION_OPTIONS,
  AgmStatsEmailData,
  AgmStatsExcelExportRequest,
  SummaryRow
} from "../../../../projects/ngx-ramblers/src/app/models/agm-stats.model";

const messageType = "agm-stats-excel";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const DEFAULT_FILE_NAME = "committee-statistics.xlsx";
const METRIC_COLUMN_WIDTH = 32;
const PERIOD_COLUMN_WIDTH = 18;
const CURRENCY_FORMAT = '"£"#,##0.00';

export async function buildAgmStatsWorkbook(data: AgmStatsEmailData): Promise<Workbook> {
  const {Workbook: WorkbookType} = exceljsFrom(await import("exceljs"));
  const workbook = new WorkbookType();
  workbook.title = `Committee statistics from ${data.fromDateLabel} to ${data.toDateLabel}`;
  AGM_STATS_EMAIL_SECTION_OPTIONS.forEach(option => {
    addSummarySheet(workbook, option.label, data.periodLabels || [], data.summaries?.[option.key] || []);
  });
  return workbook;
}

export async function agmStatsExcel(req: Request, res: Response): Promise<void> {
  try {
    const exportRequest: AgmStatsExcelExportRequest = req.body;
    if (!exportRequest?.data) {
      res.status(400).json({message: "Statistics data is required"});
    } else {
      debugLog("export requested for", exportRequest.data.fromDateLabel, "to", exportRequest.data.toDateLabel);
      const workbook = await buildAgmStatsWorkbook(exportRequest.data);
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${exportRequest.fileName || DEFAULT_FILE_NAME}"`);
      res.send(Buffer.from(buffer));
    }
  } catch (error) {
    debugLog("agmStatsExcel error:", error);
    res.status(500).json({error: error.message});
  }
}

function addSummarySheet(workbook: Workbook, sheetName: string, periodLabels: string[], rows: SummaryRow[]): void {
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = [
    {header: "Metric", width: METRIC_COLUMN_WIDTH},
    ...periodLabels.map(label => ({header: label, width: PERIOD_COLUMN_WIDTH}))
  ];
  worksheet.getRow(1).font = {bold: true};
  rows.forEach(row => {
    const added = worksheet.addRow([row.metric, ...row.values]);
    if (AGM_STATS_CURRENCY_METRICS.includes(row.metric)) {
      row.values.forEach((_, index) => {
        added.getCell(index + 2).numFmt = CURRENCY_FORMAT;
      });
    }
  });
  worksheet.autoFilter = {from: {row: 1, column: 1}, to: {row: 1, column: 1 + periodLabels.length}};
  worksheet.views = [{state: "frozen", ySplit: 1}];
}
