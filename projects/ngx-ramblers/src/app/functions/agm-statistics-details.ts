import { LeaderStats, UnpaidExpenseItem, WalkListItem, YearComparison } from "../models/group-event.model";
import { AgmStatsDetailCell, AgmStatsDetailColumn, AgmStatsDetailColumnKind, AgmStatsDetailLink, AgmStatsDetailTable, AgmStatsEmailSection, RankedLeaderRow, SocialRow } from "../models/agm-stats.model";
import { isObject } from "es-toolkit/compat";

export interface AgmStatsDetailInput {
  formatDate: (millis: number) => string;
  walkUrl: (walk: WalkListItem) => string | null;
  socialUrl: (event: SocialRow) => string | null;
  walks: {
    unfilledSlots: WalkListItem[];
    morningWalks: WalkListItem[];
    cancelledWalks: WalkListItem[];
    eveningWalks: WalkListItem[];
    newLeaders: LeaderStats[];
    currentLeaders: RankedLeaderRow[];
    aggregateLeaders: RankedLeaderRow[];
    aggregateYearsLabel: string;
  };
  socials: {
    events: SocialRow[];
    organisers: {name: string; eventCount: number}[];
  };
  expenses: {
    unpaid: UnpaidExpenseItem[];
    yearlyStats: YearComparison[];
    periodLabel: (from: number, to: number) => string;
  };
}

function column(label: string, kind: AgmStatsDetailColumnKind = AgmStatsDetailColumnKind.TEXT): AgmStatsDetailColumn {
  return {label, kind};
}

function linkCell(text: string, href: string | null): AgmStatsDetailCell {
  return href ? {text, href} : text;
}

export function isDetailLink(value: AgmStatsDetailCell): value is AgmStatsDetailLink {
  return isObject(value) && "href" in value;
}

function walkTable(title: string, walks: WalkListItem[], input: AgmStatsDetailInput, withLeader: boolean): AgmStatsDetailTable {
  return {
    title: `${title} (${walks.length})`,
    columns: [
      column("Date"),
      column("Title"),
      ...(withLeader ? [column("Leader")] : []),
      column("Distance (miles)", AgmStatsDetailColumnKind.NUMBER)
    ],
    rows: walks.map(walk => [
      input.formatDate(walk.startDate),
      linkCell(walk.title || "Untitled", input.walkUrl(walk)),
      ...(withLeader ? [walk.walkLeader || "-"] : []),
      walk.distance ?? null
    ])
  };
}

function leaderTable(title: string, leaders: (LeaderStats & {rank?: number})[], ranked: boolean): AgmStatsDetailTable {
  return {
    title,
    columns: [
      ...(ranked ? [column("Rank", AgmStatsDetailColumnKind.NUMBER)] : []),
      column("Leader"),
      column("Walks Led", AgmStatsDetailColumnKind.NUMBER),
      column("Miles Led", AgmStatsDetailColumnKind.NUMBER)
    ],
    rows: leaders.map(leader => [
      ...(ranked ? [leader.rank ?? null] : []),
      leader.name,
      leader.walkCount,
      leader.totalMiles
    ])
  };
}

export function agmStatisticsDetailTables(input: AgmStatsDetailInput): Partial<Record<AgmStatsEmailSection, AgmStatsDetailTable[]>> {
  const walks = input.walks;
  const expensePayeeTables: AgmStatsDetailTable[] = input.expenses.yearlyStats.map(year => ({
    title: `Paid Expenses by Claimant ${input.expenses.periodLabel(year.periodFrom, year.periodTo)}`,
    columns: [
      column("Claimant"),
      column("Claims", AgmStatsDetailColumnKind.NUMBER),
      column("Items", AgmStatsDetailColumnKind.NUMBER),
      column("Total Paid", AgmStatsDetailColumnKind.CURRENCY),
      column("Transactions")
    ],
    rows: (year.expenses?.payees || []).map(payee => [
      payee.name,
      payee.claimCount,
      payee.totalItems,
      payee.totalCost,
      (payee.items || []).map(item => `${item.description} - ${formatPounds(item.cost)}`).join("; ") || "No items"
    ])
  }));
  return {
    [AgmStatsEmailSection.WALKS]: [
      walkTable("Walk Slots Not Filled", walks.unfilledSlots, input, false),
      walkTable("Morning Walks", walks.morningWalks, input, true),
      walkTable("Cancelled Walks", walks.cancelledWalks, input, true),
      walkTable("Evening Walks", walks.eveningWalks, input, true),
      leaderTable("New Walk Leaders (Current Year)", walks.newLeaders, false),
      leaderTable("Top Walk Leaders (Current Year)", walks.currentLeaders, true),
      leaderTable(`Aggregate Walk Leaders (${walks.aggregateYearsLabel})`, walks.aggregateLeaders, true)
    ],
    [AgmStatsEmailSection.SOCIALS]: [
      {
        title: `Social Events (${input.socials.events.length})`,
        columns: [column("Date"), column("Description"), column("Organiser")],
        rows: input.socials.events.map(event => [input.formatDate(event.date), linkCell(event.description, input.socialUrl(event)), event.organiserName || "Unknown"])
      },
      {
        title: "Social Organisers",
        columns: [column("Organiser"), column("Events Organised", AgmStatsDetailColumnKind.NUMBER)],
        rows: input.socials.organisers.map(organiser => [organiser.name, organiser.eventCount])
      }
    ],
    [AgmStatsEmailSection.EXPENSES]: [
      {
        title: `Unpaid Expenses (${input.expenses.unpaid.length})`,
        columns: [column("Claimant"), column("Description"), column("Amount", AgmStatsDetailColumnKind.CURRENCY), column("Date")],
        rows: input.expenses.unpaid.map(expense => [expense.claimantName, expense.description, expense.cost, input.formatDate(expense.expenseDate)])
      },
      ...expensePayeeTables
    ]
  };
}

export function formatPounds(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-GB", {style: "currency", currency: "GBP"}).format(value || 0);
}

export function detailCellText(value: AgmStatsDetailCell, kind: AgmStatsDetailColumnKind | undefined): string {
  if (value === null || value === undefined) {
    return "";
  } else if (isDetailLink(value)) {
    return value.text;
  } else if (kind === AgmStatsDetailColumnKind.CURRENCY) {
    return formatPounds(Number(value));
  } else {
    return String(value);
  }
}
