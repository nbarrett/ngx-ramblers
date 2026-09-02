import { AGM_STATS_CURRENCY_METRICS, AgmStatsDetailColumnKind, AgmStatsDetailTable, AgmStatsEmailData, AgmStatsEmailSection, SummaryRow } from "../models/agm-stats.model";
import { detailCellText, isDetailLink } from "./agm-statistics-details";

const SECTION_TITLES: Record<AgmStatsEmailSection, string> = {
  [AgmStatsEmailSection.WALKS]: "Walk statistics",
  [AgmStatsEmailSection.SOCIALS]: "Social statistics",
  [AgmStatsEmailSection.MEMBERSHIP]: "Membership statistics",
  [AgmStatsEmailSection.EXPENSES]: "Expense statistics"
};

const FONT = "'Assistant', Arial, Helvetica, sans-serif";
const GRANITE = "#404141";
const MUTED = "#6c757d";
const HEADER_BG = "#e1efe6";
const HEADER_BORDER = "rgba(155, 200, 171, 0.45)";
const ROW_BORDER = "#e9ecef";
const ROW_ALT = "#f8f9fa";

export function agmStatisticsEmailMarkdown(selectedSections: AgmStatsEmailSection[], data: AgmStatsEmailData): string {
  const intro = (data.introText || "").trim();
  const heading = `Committee statistics from ${data.fromDateLabel} to ${data.toDateLabel}`;
  const sections = selectedSections.map(section => [
    summaryMarkdown(section, data.periodLabels, data.summaries[section] || []),
    ...detailTablesFor(data, section).map(detailMarkdown)
  ].join("\n\n"));
  return [intro, heading, ...sections].filter(Boolean).join("\n\n");
}

function detailTablesFor(data: AgmStatsEmailData, section: AgmStatsEmailSection): AgmStatsDetailTable[] {
  return data.details?.[section] || [];
}

function detailMarkdown(table: AgmStatsDetailTable): string {
  const header = table.columns.map(item => item.label).map(markdownCell).join(" | ");
  const divider = table.columns.map(item => item.kind === AgmStatsDetailColumnKind.TEXT || !item.kind ? "---" : "---:").join(" | ");
  const body = table.rows.map(row => row.map((value, index) => {
    const text = markdownCell(detailCellText(value, table.columns[index]?.kind));
    return isDetailLink(value) ? `[${text}](${value.href})` : text;
  }).join(" | "));
  return [`### ${table.title}`, `| ${header} |`, `| ${divider} |`, ...body.map(line => `| ${line} |`)].join("\n");
}

export function agmStatisticsEmailCsv(selectedSections: AgmStatsEmailSection[], data: AgmStatsEmailData): string {
  const header = ["Section", "Statistic", ...data.periodLabels].map(csvCell).join(",");
  const rows = selectedSections.flatMap(section => (data.summaries[section] || []).map(row =>
    [SECTION_TITLES[section], row.metric, ...row.values.map(value => displayValue(section, row.metric, value))].map(csvCell).join(",")
  ));
  const detailBlocks = selectedSections.flatMap(section => detailTablesFor(data, section).map(table => [
    "",
    csvCell(`${SECTION_TITLES[section]}: ${table.title}`),
    table.columns.map(item => csvCell(item.label)).join(","),
    ...table.rows.map(row => row.map((value, index) => csvCell(detailCellText(value, table.columns[index]?.kind))).join(","))
  ].join("\r\n")));
  return [header, ...rows, ...detailBlocks].join("\r\n");
}

function csvCell(value: string): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

export function agmStatisticsEmailIntroHtml(introText: string | undefined): string {
  return (introText || "")
    .trim()
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => !!paragraph)
    .map(paragraph => `<p style="font-family:${FONT};margin:0 0 14px 0;color:${GRANITE};font-size:15px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function agmStatisticsEmailHtml(selectedSections: AgmStatsEmailSection[], data: AgmStatsEmailData): string {
  const intro = agmStatisticsEmailIntroHtml(data.introText);
  const heading = `Committee statistics from ${escapeHtml(data.fromDateLabel)} to ${escapeHtml(data.toDateLabel)}`;
  const sections = selectedSections.map(section => [
    summaryHtml(section, data.periodLabels, data.summaries[section] || []),
    ...detailTablesFor(data, section).map(detailHtml)
  ].join("")).join("");
  return `<div style="font-family:${FONT};color:${GRANITE};font-size:15px;line-height:1.45;background:#ffffff;padding:4px 0 8px;">
  ${intro}
  <p style="font-family:${FONT};margin:0 0 20px 0;color:${MUTED};font-size:14px;">${heading}</p>
  ${sections}
</div>`;
}

function summaryMarkdown(section: AgmStatsEmailSection, periodLabels: string[], rows: SummaryRow[]): string {
  const header = ["Statistic", ...periodLabels].map(markdownCell).join(" | ");
  const divider = ["---", ...periodLabels.map(() => "---:")].join(" | ");
  const body = rows.map(row => [row.metric, ...row.values.map(value => displayValue(section, row.metric, value))].map(markdownCell).join(" | "));
  return [`## ${SECTION_TITLES[section]}`, `| ${header} |`, `| ${divider} |`, ...body.map(line => `| ${line} |`)].join("\n");
}

function summaryHtml(section: AgmStatsEmailSection, periodLabels: string[], rows: SummaryRow[]): string {
  const headerCells = ["Statistic", ...periodLabels].map((label, index) =>
    `<th style="${headerCellStyle(index === 0)}">${escapeHtml(label)}</th>`
  ).join("");
  const bodyRows = rows.map((row, rowIndex) => {
    const background = rowIndex % 2 === 0 ? "#ffffff" : ROW_ALT;
    const metricCell = `<td style="${bodyCellStyle(true, background)}">${escapeHtml(row.metric)}</td>`;
    const valueCells = row.values.map(value =>
      `<td style="${bodyCellStyle(false, background)}">${escapeHtml(displayValue(section, row.metric, value))}</td>`
    ).join("");
    return `<tr>${metricCell}${valueCells}</tr>`;
  }).join("");
  return `<h2 style="font-family:${FONT};font-size:18px;font-weight:700;color:${GRANITE};margin:0 0 10px 0;padding:0;">${escapeHtml(SECTION_TITLES[section])}</h2>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 28px 0;">
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>`;
}

function detailHtml(table: AgmStatsDetailTable): string {
  const headerCells = table.columns.map((item, index) =>
    `<th style="${headerCellStyle(index === 0 || item.kind === AgmStatsDetailColumnKind.TEXT || !item.kind)}">${escapeHtml(item.label)}</th>`
  ).join("");
  const bodyRows = table.rows.map((row, rowIndex) => {
    const background = rowIndex % 2 === 0 ? "#ffffff" : ROW_ALT;
    const cells = row.map((value, index) => {
      const kind = table.columns[index]?.kind;
      const text = escapeHtml(detailCellText(value, kind));
      const content = isDetailLink(value) ? `<a href="${escapeHtml(value.href)}" style="color:${GRANITE};">${text}</a>` : text;
      return `<td style="${bodyCellStyle(index === 0 || kind === AgmStatsDetailColumnKind.TEXT || !kind, background)}">${content}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  const emptyRow = `<tr><td colspan="${table.columns.length}" style="${bodyCellStyle(true, "#ffffff")}color:${MUTED};">Nothing to show</td></tr>`;
  return `<h3 style="font-family:${FONT};font-size:15px;font-weight:700;color:${GRANITE};margin:0 0 8px 0;padding:0;">${escapeHtml(table.title)}</h3>
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 24px 0;">
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows || emptyRow}</tbody>
</table>`;
}

function headerCellStyle(firstColumn: boolean): string {
  const align = firstColumn ? "left" : "right";
  return `font-family:${FONT};background:${HEADER_BG};color:${GRANITE};font-weight:600;text-align:${align};padding:10px 12px;border-bottom:2px solid ${HEADER_BORDER};font-size:13px;white-space:nowrap;`;
}

function bodyCellStyle(firstColumn: boolean, background: string): string {
  const align = firstColumn ? "left" : "right";
  return `font-family:${FONT};background:${background};color:${GRANITE};text-align:${align};padding:9px 12px;border-bottom:1px solid ${ROW_BORDER};font-size:14px;`;
}

function displayValue(section: AgmStatsEmailSection, metric: string, value: number): string {
  return section === AgmStatsEmailSection.EXPENSES && AGM_STATS_CURRENCY_METRICS.includes(metric)
    ? new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP"}).format(value || 0)
    : String(value ?? 0);
}

function markdownCell(value: string): string {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
