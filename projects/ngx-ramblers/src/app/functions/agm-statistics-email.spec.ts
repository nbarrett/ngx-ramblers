import { describe, expect, it } from "vitest";
import { agmStatisticsEmailCsv, agmStatisticsEmailHtml, agmStatisticsEmailMarkdown } from "./agm-statistics-email";
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

  it("puts the introductory text above the heading as escaped paragraphs", () => {
    const withIntro = {...data, introText: "Hello all,\nHere are the figures for the AGM.\n\nQuestions & comments welcome <before> Thursday."};
    const html = agmStatisticsEmailHtml([AgmStatsEmailSection.WALKS], withIntro);
    const introIndex = html.indexOf("Hello all,<br>Here are the figures for the AGM.");
    expect(introIndex).toBeGreaterThan(-1);
    expect(introIndex).toBeLessThan(html.indexOf("Committee statistics from"));
    expect(html).toContain("Questions &amp; comments welcome &lt;before&gt; Thursday.");
    expect(agmStatisticsEmailMarkdown([AgmStatsEmailSection.WALKS], withIntro).startsWith("Hello all,")).toBe(true);
  });

  it("builds a csv of the selected tables with one row per metric", () => {
    const csv = agmStatisticsEmailCsv([AgmStatsEmailSection.WALKS, AgmStatsEmailSection.EXPENSES], data);
    expect(csv.split("\r\n")).toEqual([
      "Section,Statistic,Previous,Current",
      "Walk statistics,Total Walks on Programme,20,24",
      "Expense statistics,Total Paid,£12.50,£25.00"
    ]);
  });

  it("quotes csv cells that contain commas or quotes", () => {
    const awkward = {...data, summaries: {...data.summaries, [AgmStatsEmailSection.WALKS]: [{metric: "Walks, \"long\"", values: [1, 2]}]}};
    expect(agmStatisticsEmailCsv([AgmStatsEmailSection.WALKS], awkward)).toContain("\"Walks, \"\"long\"\"\",1,2");
  });

  it("leaves the email unchanged when the introduction is blank", () => {
    expect(agmStatisticsEmailHtml([AgmStatsEmailSection.WALKS], {...data, introText: "  \n "})).toEqual(agmStatisticsEmailHtml([AgmStatsEmailSection.WALKS], data));
  });
});
