import expect from "expect";
import { describe, it } from "mocha";
import { AgmStatsEmailData, AgmStatsEmailSection } from "../../../../projects/ngx-ramblers/src/app/models/agm-stats.model";
import { buildAgmStatsWorkbook } from "./agm-stats-excel";

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

describe("buildAgmStatsWorkbook", () => {
  it("writes a sheet for each report area with metric rows", async () => {
    const workbook = await buildAgmStatsWorkbook(data);
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(["Walks", "Socials", "Membership", "Expenses"]);
    const walks = workbook.getWorksheet("Walks");
    expect(walks).toBeTruthy();
    expect(walks.getRow(1).values).toEqual([undefined, "Statistic", "Previous", "Current"]);
    expect(walks.getRow(2).values).toEqual([undefined, "Total Walks on Programme", 20, 24]);
    const expenses = workbook.getWorksheet("Expenses");
    expect(expenses).toBeTruthy();
    expect(expenses.getRow(2).getCell(3).numFmt).toEqual("\"£\"#,##0.00");
    expect(workbook.title).toEqual("Committee statistics from 1 June 2026 to 2 September 2026");
  });
});
