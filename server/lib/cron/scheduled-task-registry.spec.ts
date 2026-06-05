import expect from "expect";
import { describe, it } from "mocha";
import * as cron from "node-cron";
import { ScheduledTasksConfiguration } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import { carryForwardConfiguration, cronScheduleDescription } from "./scheduled-task-registry";

function partInZone(date: Date, type: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date).find(part => part.type === type)!.value;
}

describe("cronScheduleDescription", () => {
  it("describes each registered task schedule", () => {
    expect(cronScheduleDescription("0 */6 * * *")).toEqual("Every 6 hours at 00 minutes past");
    expect(cronScheduleDescription("0 8 * * *")).toEqual("Daily at 8:00 am");
    expect(cronScheduleDescription("15 */2 * * *")).toEqual("Every 2 hours at 15 minutes past");
    expect(cronScheduleDescription("5 0 * * *")).toEqual("Daily at 12:05 am");
  });

  it("describes common edited weekly and monthly schedules", () => {
    expect(cronScheduleDescription("30 9 * * 1")).toEqual("Weekly on Monday at 9:30 am");
    expect(cronScheduleDescription("0 9 * * 1-5")).toEqual("Weekly on Monday to Friday at 9:00 am");
    expect(cronScheduleDescription("10 18 1 * *")).toEqual("Monthly on day 1 at 6:10 pm");
  });

  it("identifies custom cron schedules that do not map to common display patterns", () => {
    expect(cronScheduleDescription("0 9 * 1 1")).toEqual("Custom cron schedule (0 9 * 1 1)");
  });
});

describe("scheduled task timezone", () => {
  it("resolves '0 3 * * *' to the next 03:00 in Europe/London regardless of the host timezone", () => {
    const task = cron.createTask("0 3 * * *", async () => {}, {timezone: "Europe/London"});
    task.start();
    const next = task.getNextRun();
    task.destroy();
    expect(next).toBeTruthy();
    expect(partInZone(next!, "hour")).toEqual("03");
    expect(partInZone(next!, "minute")).toEqual("00");
  });
});

describe("carryForwardConfiguration", () => {
  it("carries a previously-enabled task forward so a renamed id stays enabled", () => {
    const current: ScheduledTasksConfiguration = {
      enabled: {"all-environments-backup": true},
      cronExpressions: {"all-environments-backup": "0 3 * * *"},
      settings: {"all-environments-backup": {mongoDumpConcurrency: 2}}
    };
    const {sourceId, migrated} = carryForwardConfiguration(current, "backups", ["all-environments-backup"]);
    expect(sourceId).toEqual("all-environments-backup");
    expect(migrated.enabled["backups"]).toEqual(true);
    expect(migrated.cronExpressions["backups"]).toEqual("0 3 * * *");
    expect(migrated.settings!["backups"]).toEqual({mongoDumpConcurrency: 2});
    expect(migrated.enabled["all-environments-backup"]).toEqual(true);
  });

  it("does not overwrite configuration already saved under the current id", () => {
    const current: ScheduledTasksConfiguration = {
      enabled: {"backups": false, "all-environments-backup": true},
      cronExpressions: {},
      settings: {}
    };
    const {sourceId, migrated} = carryForwardConfiguration(current, "backups", ["all-environments-backup"]);
    expect(sourceId).toBeNull();
    expect(migrated).toBe(current);
    expect(migrated.enabled["backups"]).toEqual(false);
  });

  it("makes no change when no legacy id has saved configuration", () => {
    const current: ScheduledTasksConfiguration = {enabled: {}, cronExpressions: {}, settings: {}};
    const {sourceId, migrated} = carryForwardConfiguration(current, "backups", ["all-environments-backup"]);
    expect(sourceId).toBeNull();
    expect(migrated).toBe(current);
  });
});
