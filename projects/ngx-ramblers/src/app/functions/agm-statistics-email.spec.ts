import { describe, expect, it } from "vitest";
import { agmStatisticsEmailHtml, agmStatisticsEmailMarkdown } from "./agm-statistics-email";
import { AgmStatsEmailData, AgmStatsEmailSection } from "../models/agm-stats.model";

const data: AgmStatsEmailData = {
  fromDateLabel: "1 June 2026",
  toDateLabel: "2 September 2026",
  periodLabels: ["Previous", "Current"],
  summaries: {
    [AgmStatsEmailSection.WALKS]: [{metric: "Total Walks on Programme", values: [20, 24]}],
    [AgmStatsEmailSection.SOCIALS]: [{metric: "Total Social Events", values: [4, 6]}],
    [AgmStatsEmailSection.MEMBERSHIP]: [{metric: "Total Members", values: [150, 162]}],
    [AgmStatsEmailSection.EXPENSES]: [{metric: "Total Paid", values: [12.5, 25]}]
  }
};

describe("agmStatisticsEmailMarkdown", () => {
  it("includes only the selected report sections", () => {
    const markdown = agmStatisticsEmailMarkdown([AgmStatsEmailSection.WALKS, AgmStatsEmailSection.MEMBERSHIP], data);
    expect(markdown).toContain("Committee statistics from 1 June 2026 to 2 September 2026");
    expect(markdown).toContain("## Walk statistics");
    expect(markdown).toContain("Total Members | 150 | 162");
    expect(markdown).not.toContain("Social statistics");
    expect(markdown).not.toContain("Total Paid");
  });

  it("formats expense totals as pounds", () => {
    const markdown = agmStatisticsEmailMarkdown([AgmStatsEmailSection.EXPENSES], data);
    expect(markdown).toContain("Total Paid | £12.50 | £25.00");
  });

  it("renders a styled html table for the selected sections", () => {
    const html = agmStatisticsEmailHtml([AgmStatsEmailSection.WALKS], data);
    expect(html).toContain("Walk statistics");
    expect(html).toContain("Assistant");
    expect(html).toContain("Total Walks on Programme");
    expect(html).toContain("24");
    expect(html).not.toContain("Total Paid");
  });
});
