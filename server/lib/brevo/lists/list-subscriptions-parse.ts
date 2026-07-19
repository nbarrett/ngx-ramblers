import debug from "debug";
import { Request, Response } from "express";
import * as fs from "fs";
import * as parse from "csv-parse/sync";
import { envConfig } from "../../env-config/env-config";
import { handleError, successfulResponse } from "../common/messages";
import { extractWorkbook } from "../../ramblers/workbook-reader";
import { STANDARD_CSV_PARSE_OPTIONS } from "../../../../projects/ngx-ramblers/src/app/functions/csv";
import {
  LIST_SUBSCRIPTIONS_SHEET_NAME,
  ListSubscriptionColumn,
  ListSubscriptionParseResponse,
  ListSubscriptionRow
} from "../../../../projects/ngx-ramblers/src/app/models/mail-list-subscription.model";

const messageType = "brevo:lists:list-subscriptions-parse";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

function asText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function rowFrom(source: Record<string, unknown>): ListSubscriptionRow {
  return {
    email: asText(source[ListSubscriptionColumn.EMAIL]),
    listName: asText(source[ListSubscriptionColumn.LIST_NAME]),
    subscribed: asText(source[ListSubscriptionColumn.SUBSCRIBED])
  };
}

function populated(row: ListSubscriptionRow): boolean {
  return !!(row.email || row.listName);
}

function isExcel(fileName: string): boolean {
  return fileName.toLowerCase().includes(".xls");
}

export async function listSubscriptionsParse(req: Request, res: Response): Promise<void> {
  try {
    const uploadedFile = (req.files as Express.Multer.File[])?.[0];
    if (!uploadedFile) {
      res.status(400).json({error: "No file was received. Attach an Excel or CSV file and try again"});
      return;
    }
    const contents = fs.readFileSync(uploadedFile.path);
    const sourceRows: Record<string, unknown>[] = isExcel(uploadedFile.originalname)
      ? (await extractWorkbook(contents, LIST_SUBSCRIPTIONS_SHEET_NAME)).rows
      : parse.parse(contents, STANDARD_CSV_PARSE_OPTIONS);
    const rows: ListSubscriptionRow[] = sourceRows.map(rowFrom).filter(populated);
    debugLog("parsed", rows.length, "usable rows from", uploadedFile.originalname);
    const response: ListSubscriptionParseResponse = {rows};
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
