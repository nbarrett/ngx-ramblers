import expect from "expect";
import { describe, it } from "mocha";
import { dateTimeFromIsoWithZone, dateTimeFromMillis } from "../shared/dates";
import {
  expectedIntervalMs,
  isScheduledTaskOverdue,
  overdueGraceMs,
  parseCronSchedule,
  previousExpectedRun
} from "./scheduled-task-overdue";

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

describe("previousExpectedRun", () => {
  function previous(cronExpression: string, nextRunIso: string): string {
    const result = previousExpectedRun(cronExpression, dateTimeFromIsoWithZone(nextRunIso).toJSDate());
    return result ? dateTimeFromMillis(result.getTime()).toUTC().toISO({suppressMilliseconds: true}) : null;
  }

  it("steps back one calendar month for a day-of-month schedule", () => {
    expect(previous("0 5 1 * *", "2026-09-01T04:00:00.000Z")).toEqual("2026-08-01T04:00:00Z");
    expect(previous("0 5 1 * *", "2026-08-01T04:00:00.000Z")).toEqual("2026-07-01T04:00:00Z");
    expect(previous("0 5 1 * *", "2026-03-01T05:00:00.000Z")).toEqual("2026-02-01T05:00:00Z");
  });

  it("steps back one day for a daily schedule and one week for a weekly one", () => {
    expect(previous("0 3 * * *", "2026-07-26T02:00:00.000Z")).toEqual("2026-07-25T02:00:00Z");
    expect(previous("0 8 * * 1", "2026-07-27T07:00:00.000Z")).toEqual("2026-07-20T07:00:00Z");
  });

  it("handles step, list and range expressions", () => {
    expect(previous("*/5 * * * *", "2026-07-26T02:00:00.000Z")).toEqual("2026-07-26T01:55:00Z");
    expect(previous("15 */2 * * *", "2026-07-26T01:15:00.000Z")).toEqual("2026-07-25T23:15:00Z");
    expect(previous("0 9 * * MON,FRI", "2026-07-27T08:00:00.000Z")).toEqual("2026-07-24T08:00:00Z");
  });

  it("returns null when nothing matches within the look-back window", () => {
    expect(previous("0 5 30 2 *", "2026-07-01T04:00:00.000Z")).toBeNull();
  });
});

describe("parseCronSchedule", () => {
  it("records which day fields are restricted", () => {
    expect(parseCronSchedule("0 5 1 * *").dayOfMonthRestricted).toEqual(true);
    expect(parseCronSchedule("0 5 1 * *").dayOfWeekRestricted).toEqual(false);
    expect(parseCronSchedule("0 3 * * *").dayOfMonthRestricted).toEqual(false);
  });

  it("normalises day-of-week 7 to 0 and resolves names", () => {
    expect(parseCronSchedule("0 3 * * 7").daysOfWeek).toEqual([0]);
    expect(parseCronSchedule("0 3 * * SUN").daysOfWeek).toEqual([0]);
    expect(parseCronSchedule("0 3 * * 1-5").daysOfWeek).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns null for expressions it cannot parse", () => {
    expect(parseCronSchedule("too short")).toBeNull();
    expect(parseCronSchedule("0 99 * * *")).toBeNull();
  });
});

describe("monthly schedules are not repeatedly flagged as overdue", () => {
  const monthly = "0 5 1 * *";
  const nextRunAt = dateTimeFromIsoWithZone("2026-09-01T04:00:00.000Z").toJSDate();
  const ranOnSchedule = "2026-08-01T04:00:00.000Z";

  it("stays not overdue three days after a run that happened on schedule", () => {
    expect(isScheduledTaskOverdue({
      cronExpression: monthly,
      nextRunAt,
      lastCompletedAt: ranOnSchedule,
      nowMs: dateTimeFromIsoWithZone("2026-08-04T06:00:00.000Z").toMillis()
    })).toEqual(false);
  });

  it("stays not overdue right up to the next scheduled slot", () => {
    expect(isScheduledTaskOverdue({
      cronExpression: monthly,
      nextRunAt,
      lastCompletedAt: ranOnSchedule,
      nowMs: dateTimeFromIsoWithZone("2026-09-01T03:59:00.000Z").toMillis()
    })).toEqual(false);
  });

  it("is still overdue when the monthly run was genuinely missed", () => {
    expect(isScheduledTaskOverdue({
      cronExpression: monthly,
      nextRunAt,
      lastCompletedAt: "2026-07-01T04:00:00.000Z",
      nowMs: dateTimeFromIsoWithZone("2026-08-04T06:00:00.000Z").toMillis()
    })).toEqual(true);
  });

  it("is overdue for a brand new task that has never completed", () => {
    expect(isScheduledTaskOverdue({
      cronExpression: monthly,
      nextRunAt,
      lastCompletedAt: null,
      nowMs: dateTimeFromIsoWithZone("2026-08-04T06:00:00.000Z").toMillis()
    })).toEqual(true);
  });
});
