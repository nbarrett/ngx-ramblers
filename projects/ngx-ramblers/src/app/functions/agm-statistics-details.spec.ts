import { describe, expect, it } from "vitest";
import { agmStatisticsDetailTables, detailCellText } from "./agm-statistics-details";
import { AgmStatsDetailColumnKind, AgmStatsEmailSection } from "../models/agm-stats.model";
import { agmStatisticsEmailCsv, agmStatisticsEmailHtml, agmStatisticsEmailMarkdown } from "./agm-statistics-email";
import { YearComparison } from "../models/group-event.model";

const year = {
  year: 2026,
  periodFrom: 1,
  periodTo: 2,
  expenses: {
    payees: [{id: "p1", name: "Jon Inglett", claimCount: 2, totalItems: 3, totalCost: 56.39, items: [{description: "Refreshments", cost: 20, paidDate: 1}]}]
  }
} as unknown as YearComparison;

const tables = agmStatisticsDetailTables({
  formatDate: millis => `day-${millis}`,
  walkUrl: walk => walk.url ? `https://www.ekwg.co.uk${walk.url}` : null,
  socialUrl: event => `https://www.ekwg.co.uk/social/${event.id}`,
  walks: {
    unfilledSlots: [{id: "w1", title: "", startDate: 5, walkDate: "", distance: undefined}],
    morningWalks: [{id: "w2", title: "Stelling Minnis", startDate: 6, walkDate: "", walkLeader: "Amanda", distance: 8, url: "/walks/stelling-minnis"}],
    cancelledWalks: [],
    eveningWalks: [],
    newLeaders: [{id: "l1", name: "Rachel", email: "", walkCount: 1, totalMiles: 6}],
    currentLeaders: [{id: "l2", name: "Kerry", email: "", walkCount: 4, totalMiles: 30, rank: 1}],
    aggregateLeaders: [],
    aggregateYearsLabel: "3 years"
  },
  socials: {
    events: [{id: "a-kentish-murder", date: 7, description: "A Kentish Murder", organiserName: "Andrew"}],
    organisers: [{name: "Andrew", eventCount: 7}]
  },
  expenses: {
    unpaid: [{id: "e1", claimantName: "Nick", description: "Zoom", cost: 12.5, expenseDate: 8}],
    yearlyStats: [year],
    periodLabel: (from, to) => `${from}-${to}`
  }
});

describe("agmStatisticsDetailTables", () => {
  it("builds the walk tables with the same columns as the report", () => {
    const walks = tables[AgmStatsEmailSection.WALKS];
    expect(walks.map(table => table.title)).toEqual([
      "Walk Slots Not Filled (1)", "Morning Walks (1)", "Cancelled Walks (0)", "Evening Walks (0)",
      "New Walk Leaders (Current Year)", "Top Walk Leaders (Current Year)", "Aggregate Walk Leaders (3 years)"
    ]);
    expect(walks[0].rows).toEqual([["day-5", "Untitled", null]]);
    expect(walks[1].rows).toEqual([["day-6", {text: "Stelling Minnis", href: "https://www.ekwg.co.uk/walks/stelling-minnis"}, "Amanda", 8]]);
    expect(walks[5].rows).toEqual([[1, "Kerry", 4, 30]]);
  });

  it("builds the social and expense tables, keeping money as numbers", () => {
    expect(tables[AgmStatsEmailSection.SOCIALS][0].rows).toEqual([["day-7", {text: "A Kentish Murder", href: "https://www.ekwg.co.uk/social/a-kentish-murder"}, "Andrew"]]);
    const expenses = tables[AgmStatsEmailSection.EXPENSES];
    expect(expenses[0].rows).toEqual([["Nick", "Zoom", 12.5, "day-8"]]);
    expect(expenses[0].columns[2].kind).toEqual(AgmStatsDetailColumnKind.CURRENCY);
    expect(expenses[1].title).toEqual("Paid Expenses by Claimant 1-2");
    expect(expenses[1].rows).toEqual([["Jon Inglett", 2, 3, 56.39, "Refreshments - £20.00"]]);
  });

  it("formats currency cells as pounds and leaves blanks empty", () => {
    expect(detailCellText(56.39, AgmStatsDetailColumnKind.CURRENCY)).toEqual("£56.39");
    expect(detailCellText(null, AgmStatsDetailColumnKind.NUMBER)).toEqual("");
    expect(detailCellText("Kerry", undefined)).toEqual("Kerry");
  });

  it("renders detail tables after the summary in the email and the csv", () => {
    const data = {
      fromDateLabel: "a", toDateLabel: "b", periodLabels: ["Current"],
      summaries: {
        [AgmStatsEmailSection.WALKS]: [{metric: "Total Walks on Programme", values: [1]}],
        [AgmStatsEmailSection.SOCIALS]: [], [AgmStatsEmailSection.MEMBERSHIP]: [], [AgmStatsEmailSection.EXPENSES]: []
      },
      details: tables
    };
    const html = agmStatisticsEmailHtml([AgmStatsEmailSection.WALKS], data);
    expect(html.indexOf("Total Walks on Programme")).toBeLessThan(html.indexOf("Morning Walks (1)"));
    expect(html).toContain("<a href=\"https://www.ekwg.co.uk/walks/stelling-minnis\"");
    expect(html).toContain("Stelling Minnis</a>");
    expect(html).toContain("Nothing to show");
    expect(agmStatisticsEmailMarkdown([AgmStatsEmailSection.WALKS], data)).toContain("[Stelling Minnis](https://www.ekwg.co.uk/walks/stelling-minnis)");
    const csv = agmStatisticsEmailCsv([AgmStatsEmailSection.EXPENSES], {...data, details: tables});
    expect(csv).toContain("Expense statistics: Unpaid Expenses (1)");
    expect(csv).toContain("Nick,Zoom,£12.50,day-8");
    expect(agmStatisticsEmailHtml([AgmStatsEmailSection.WALKS], {...data, details: undefined})).not.toContain("Morning Walks");
  });
});
