import {parse} from "csv-parse/sync";
import {STANDARD_CSV_PARSE_OPTIONS} from "../../../../projects/ngx-ramblers/src/app/functions/csv";
import {RecipientRow} from "./campaign-recipient-export.model";

export function exportDelimiter(headerLine: string): string {
  const unquoted = headerLine.replace(/"(?:[^"]|"")*"/g, "");
  const semicolons = (unquoted.match(/;/g) || []).length;
  const commas = (unquoted.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

function columnIndex(header: string[], aliases: string[]): number {
  const lowered = header.map(column => column.trim().toLowerCase().replace(/\s+/g, "_"));
  const wanted = aliases.map(alias => alias.toLowerCase().replace(/\s+/g, "_"));
  const exact = lowered.findIndex(column => wanted.includes(column));
  if (exact >= 0) {
    return exact;
  } else {
    return lowered.findIndex(column => wanted.some(alias => column === alias || column.startsWith(alias)));
  }
}

export function parseRecipientExportCsv(csv: string): RecipientRow[] {
  const delimiter = exportDelimiter(csv.split(/\r?\n/)[0] ?? "");
  const records = parse(csv, {...STANDARD_CSV_PARSE_OPTIONS, columns: false, delimiter}) as string[][];
  if (records.length <= 1) {
    return [];
  } else {
    const header = records[0];
    const idx = {
      email: columnIndex(header, ["Email_ID", "Email", "EMAIL", "EMAIL_ID", "email_id", "EMAIL ID"]),
      delivered: columnIndex(header, ["Delivered_Date", "Delivery_Date"]),
      open: columnIndex(header, ["Open_Date", "Opened_Date", "open_date"]),
      unsubscribe: columnIndex(header, ["Unsubscribe_Date", "unsubscribe_date"]),
      hardBounce: columnIndex(header, ["Hard_Bounce_Date", "HardBounce_Date", "hard_bounce_date"]),
      softBounce: columnIndex(header, ["Soft_Bounce_Date", "SoftBounce_Date", "soft_bounce_date"]),
      clicked: columnIndex(header, ["Clicked_Links_Count", "clicked_links_count"])
    };
    const complaintIndex = columnIndex(header, ["Complaint_date", "Complaint_Date"]);
    const linkColumns = header
      .map((columnHeader, index) => ({url: columnHeader.trim(), index}))
      .filter(column => complaintIndex >= 0 && column.index > complaintIndex && /^https?:\/\//i.test(column.url));
    const value = (columns: string[], index: number): string => index >= 0 ? (columns[index] ?? "").trim() : "";
    return records.slice(1)
      .map(columns => ({
        email: value(columns, idx.email),
        deliveredDate: value(columns, idx.delivered),
        openDate: value(columns, idx.open),
        unsubscribeDate: value(columns, idx.unsubscribe),
        hardBounceDate: value(columns, idx.hardBounce),
        softBounceDate: value(columns, idx.softBounce),
        clickedCount: Number(value(columns, idx.clicked)) || 0,
        clickedLinks: [...new Set(linkColumns.filter(column => value(columns, column.index).length > 0).map(column => column.url))]
      }))
      .filter(row => row.email.length > 0);
  }
}
