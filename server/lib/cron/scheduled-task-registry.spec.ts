import expect from "expect";
import { describe, it } from "mocha";
import { cronScheduleDescription } from "./scheduled-task-registry";

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
