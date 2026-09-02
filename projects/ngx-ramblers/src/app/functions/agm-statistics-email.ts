import { AGM_STATS_CURRENCY_METRICS, AgmStatsEmailData, AgmStatsEmailSection, SummaryRow } from "../models/agm-stats.model";

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
  const heading = `Committee statistics from ${data.fromDateLabel} to ${data.toDateLabel}`;
  const sections = selectedSections.map(section => summaryMarkdown(section, data.periodLabels, data.summaries[section] || []));
  return [heading, ...sections].filter(Boolean).join("\n\n");
}

export function agmStatisticsEmailHtml(selectedSections: AgmStatsEmailSection[], data: AgmStatsEmailData): string {
  const heading = `Committee statistics from ${escapeHtml(data.fromDateLabel)} to ${escapeHtml(data.toDateLabel)}`;
  const sections = selectedSections.map(section => summaryHtml(section, data.periodLabels, data.summaries[section] || [])).join("");
  return `<div style="font-family:${FONT};color:${GRANITE};font-size:15px;line-height:1.45;background:#ffffff;padding:4px 0 8px;">
  <p style="font-family:${FONT};margin:0 0 20px 0;color:${MUTED};font-size:14px;">${heading}</p>
  ${sections}
</div>`;
}

function summaryMarkdown(section: AgmStatsEmailSection, periodLabels: string[], rows: SummaryRow[]): string {
  const header = ["Metric", ...periodLabels].map(markdownCell).join(" | ");
  const divider = ["---", ...periodLabels.map(() => "---:")].join(" | ");
  const body = rows.map(row => [row.metric, ...row.values.map(value => displayValue(section, row.metric, value))].map(markdownCell).join(" | "));
  return [`## ${SECTION_TITLES[section]}`, `| ${header} |`, `| ${divider} |`, ...body.map(line => `| ${line} |`)].join("\n");
}

function summaryHtml(section: AgmStatsEmailSection, periodLabels: string[], rows: SummaryRow[]): string {
  const headerCells = ["Metric", ...periodLabels].map((label, index) =>
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
