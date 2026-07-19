import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { handleError } from "../common/messages";
import { exceljsFrom } from "../../ramblers/workbook-reader";
import {
  LIST_SUBSCRIPTION_COLUMNS,
  LIST_SUBSCRIPTIONS_SHEET_NAME,
  ListSubscriptionExportRequest,
  ListSubscriptionRow
} from "../../../../projects/ngx-ramblers/src/app/models/mail-list-subscription.model";

const messageType = "brevo:lists:list-subscriptions-export";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const DEFAULT_FILE_NAME = "list-subscriptions.xlsx";
const COLUMN_WIDTHS = [38, 30, 14];

export async function listSubscriptionsExport(req: Request, res: Response): Promise<void> {
  try {
    const exportRequest: ListSubscriptionExportRequest = req.body;
    const rows: ListSubscriptionRow[] = exportRequest?.rows || [];
    debugLog("export requested for", rows.length, "rows");
    const {Workbook} = exceljsFrom(await import("exceljs"));
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(LIST_SUBSCRIPTIONS_SHEET_NAME);
    worksheet.columns = LIST_SUBSCRIPTION_COLUMNS.map((header, index) => ({header, width: COLUMN_WIDTHS[index]}));
    worksheet.getRow(1).font = {bold: true};
    rows.forEach(row => worksheet.addRow([row.email, row.listName, row.subscribed]));
    worksheet.autoFilter = {from: {row: 1, column: 1}, to: {row: 1, column: LIST_SUBSCRIPTION_COLUMNS.length}};
    worksheet.views = [{state: "frozen", ySplit: 1}];
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${exportRequest?.fileName || DEFAULT_FILE_NAME}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
