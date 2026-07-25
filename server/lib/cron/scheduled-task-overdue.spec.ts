import expect from "expect";
import { describe, it } from "mocha";
import { dateTimeFromIsoWithZone, dateTimeFromMillis } from "../shared/dates";
import { expectedIntervalMs, isScheduledTaskOverdue, overdueGraceMs } from "./scheduled-task-overdue";

describe("expectedIntervalMs", () => {
  it("parses common schedules", () => {
    expect(expectedIntervalMs("*/5 * * * *")).toEqual(5 * 60 * 1000);
    expect(expectedIntervalMs("15 * * * *")).toEqual(60 * 60 * 1000);
    expect(expectedIntervalMs("0 */6 * * *")).toEqual(6 * 60 * 60 * 1000);
    expect(expectedIntervalMs("0 3 * * *")).toEqual(24 * 60 * 60 * 1000);
    expect(expectedIntervalMs("0 8 * * 1")).toEqual(7 * 24 * 60 * 60 * 1000);
    expect(expectedIntervalMs("0 9 1 * *")).toEqual(28 * 24 * 60 * 60 * 1000);
  });

  it("returns null for expressions it cannot size", () => {
    expect(expectedIntervalMs("0 9 * 1 1")).toBeNull();
    expect(expectedIntervalMs("too short")).toBeNull();
  });
});

describe("isScheduledTaskOverdue", () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const nextRunAt = dateTimeFromIsoWithZone("2026-07-26T02:00:00.000Z").toJSDate();

  it("is not overdue before the previous expected slot plus grace", () => {
    const previousExpected = nextRunAt.getTime() - dayMs;
    const nowMs = previousExpected + overdueGraceMs(dayMs) - 1000;
    expect(isScheduledTaskOverdue({
      cronExpression: "0 3 * * *",
      nextRunAt,
      lastCompletedAt: null,
      nowMs
    })).toEqual(false);
  });

  it("is overdue when the previous slot has passed and there is no completed run", () => {
    const previousExpected = nextRunAt.getTime() - dayMs;
    const nowMs = previousExpected + overdueGraceMs(dayMs) + 1000;
    expect(isScheduledTaskOverdue({
      cronExpression: "0 3 * * *",
      nextRunAt,
      lastCompletedAt: null,
      nowMs
    })).toEqual(true);
  });

  it("is overdue when the last completed run is before the previous expected slot", () => {
    const previousExpected = nextRunAt.getTime() - dayMs;
    const nowMs = previousExpected + overdueGraceMs(dayMs) + 1000;
    expect(isScheduledTaskOverdue({
      cronExpression: "0 3 * * *",
      nextRunAt,
      lastCompletedAt: dateTimeFromMillis(previousExpected - dayMs).toISO(),
      nowMs
    })).toEqual(true);
  });

  it("is not overdue when the last completed run covers the previous expected slot", () => {
    const previousExpected = nextRunAt.getTime() - dayMs;
    const nowMs = previousExpected + overdueGraceMs(dayMs) + 1000;
    expect(isScheduledTaskOverdue({
      cronExpression: "0 3 * * *",
      nextRunAt,
      lastCompletedAt: dateTimeFromMillis(previousExpected + 1000).toISO(),
      nowMs
    })).toEqual(false);
  });
});
