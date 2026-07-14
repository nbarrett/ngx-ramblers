import type * as ExcelJs from "exceljs";
import type { Cell, CellFormulaValue, CellHyperlinkValue, CellRichTextValue, Row, ValueType, Worksheet } from "exceljs";
import { first, isObject, keys } from "es-toolkit/compat";
import { WorkbookExtract, WorkbookRow, WorkbookValue } from "./workbook-reader.model";

export const RAMBLERS_SHEET_TOKEN = "Full List";

const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MILLISECONDS_PER_DAY = 86400000;

type CellValueTypes = typeof ValueType;
type ExcelJsModule = typeof ExcelJs;
type ImportedExcelJsModule = ExcelJsModule & { default?: ExcelJsModule };

export function exceljsFrom(imported: ImportedExcelJsModule): ExcelJsModule {
  return imported?.Workbook ? imported : imported?.default;
}

export function excelSerialFromDate(date: Date): number {
  return date.getTime() / MILLISECONDS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS;
}

export async function extractWorkbook(workbookContents: Buffer, preferredSheetToken: string = RAMBLERS_SHEET_TOKEN): Promise<WorkbookExtract> {
  const {Workbook, ValueType: cellValueTypes} = exceljsFrom(await import("exceljs"));
  const workbook = new Workbook();
  await workbook.xlsx.load(workbookContents);
  const sheetNames: string[] = workbook.worksheets.map(worksheet => worksheet.name);
  const matchedSheet = sheetNames.find(sheet => sheet.includes(preferredSheetToken));
  const selectedSheet = matchedSheet ?? first(sheetNames);
  const worksheet: Worksheet = selectedSheet ? workbook.getWorksheet(selectedSheet) : null;
  const rows: WorkbookRow[] = worksheet ? rowsFrom(worksheet, cellValueTypes) : [];
  return {sheetNames, selectedSheet, matchedPreferredSheet: !!matchedSheet, rows};
}

function rowsFrom(worksheet: Worksheet, cellValueTypes: CellValueTypes): WorkbookRow[] {
  const headings: Map<number, string> = headingsFrom(worksheet, cellValueTypes);
  const rows: WorkbookRow[] = [];
  worksheet.eachRow({includeEmpty: false}, (row: Row, rowNumber: number) => {
    if (rowNumber > 1) {
      const workbookRow: WorkbookRow = {};
      headings.forEach((heading: string, columnNumber: number) => {
        const value: WorkbookValue = valueFrom(row.getCell(columnNumber), cellValueTypes);
        if (value !== undefined) {
          workbookRow[heading] = value;
        }
      });
      if (keys(workbookRow).length > 0) {
        rows.push(workbookRow);
      }
    }
  });
  return rows;
}

function headingsFrom(worksheet: Worksheet, cellValueTypes: CellValueTypes): Map<number, string> {
  const headings = new Map<number, string>();
  worksheet.getRow(1).eachCell({includeEmpty: false}, (cell: Cell, columnNumber: number) => {
    const heading: WorkbookValue = valueFrom(cell, cellValueTypes);
    if (heading !== undefined && String(heading).length > 0) {
      headings.set(columnNumber, String(heading));
    }
  });
  return headings;
}

function valueFrom(cell: Cell, cellValueTypes: CellValueTypes): WorkbookValue {
  switch (cell.type) {
    case cellValueTypes.Number:
    case cellValueTypes.String:
    case cellValueTypes.SharedString:
    case cellValueTypes.Boolean:
      return cell.value as WorkbookValue;
    case cellValueTypes.Date:
      return excelSerialFromDate(cell.value as Date);
    case cellValueTypes.Hyperlink:
      return (cell.value as CellHyperlinkValue).text;
    case cellValueTypes.RichText:
      return (cell.value as CellRichTextValue).richText.map(fragment => fragment.text).join("");
    case cellValueTypes.Formula:
      return formulaResultFrom(cell.value as CellFormulaValue);
    default:
      return undefined;
  }
}

function formulaResultFrom(cellValue: CellFormulaValue): WorkbookValue {
  const result = cellValue.result;
  if (result === undefined || result === null) {
    return undefined;
  }
  if (result instanceof Date) {
    return excelSerialFromDate(result);
  }
  if (isObject(result)) {
    return undefined;
  }
  return result as WorkbookValue;
}
