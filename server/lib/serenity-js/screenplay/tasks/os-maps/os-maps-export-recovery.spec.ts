import expect from "expect";
import { describe, it } from "mocha";
import { PerformsActivities } from "@serenity-js/core";
import { errors, Locator } from "playwright-core";
import { OsMapsExportClickOutcome, osMapsExportProgressFromMessage, requestedOsMapsRouteFixture } from "../../../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { clickOsMapsExportButton } from "./click-os-maps-export-button";
import { rememberOsMapsExportOutcome } from "./os-maps-export-outcome-store";
import { StartOsMapsGpxDownload } from "./start-os-maps-gpx-download";
import { ExportRequestedOsMapsRoutes } from "./export-requested-os-maps-routes";

describe("OS Maps export recovery", () => {
  it("checks for the click outcome after a timeout but propagates other click failures", async () => {
    await expect(clickOsMapsExportButton({click: async () => {
      throw new errors.TimeoutError("Click timed out");
    }} as unknown as Locator)).resolves.toBeUndefined();
    await expect(clickOsMapsExportButton({click: async () => {
      throw new Error("Browser closed");
    }} as unknown as Locator)).rejects.toThrow("Browser closed");
  });

  it("retries an unresponsive click and rearms the download listener", async () => {
    const counts = {clicks: 0, listeners: 0};
    const actor = {attemptsTo: async (...activities) => {
      activities.forEach(activity => {
        const description = activity.toString();
        if (description.includes("starts listening")) {
          counts.listeners += 1;
        } else if (description.includes("clicks Export GPX")) {
          counts.clicks += 1;
        } else if (description.includes("waits to see")) {
          rememberOsMapsExportOutcome(counts.clicks === 1 ? OsMapsExportClickOutcome.NO_DIALOG_APPEARED : OsMapsExportClickOutcome.DOWNLOAD_STARTED);
        }
      });
    }} as PerformsActivities;
    await StartOsMapsGpxDownload.now().performAs(actor);
    expect(counts).toEqual({clicks: 2, listeners: 2});
  });

  it("retries when the export confirmation click fails", async () => {
    const counts = {clicks: 0, confirms: 0, dismissed: 0};
    const actor = {attemptsTo: async (...activities) => {
      activities.forEach(activity => {
        const description = activity.toString();
        if (description.includes("clicks Export GPX")) {
          counts.clicks += 1;
        } else if (description.includes("waits to see")) {
          rememberOsMapsExportOutcome(counts.clicks === 1 ? OsMapsExportClickOutcome.CONFIRMATION_SHOWN : OsMapsExportClickOutcome.DOWNLOAD_STARTED);
        } else if (description.includes("confirms the OS Maps export")) {
          counts.confirms += 1;
          if (counts.confirms === 1) {
            throw new errors.TimeoutError("locator.click: Timeout 10000ms exceeded.");
          }
        } else if (description.includes("dismisses any OS Maps")) {
          counts.dismissed += 1;
        }
      });
    }} as PerformsActivities;
    await StartOsMapsGpxDownload.now().performAs(actor);
    expect(counts).toEqual({clicks: 2, confirms: 1, dismissed: 1});
  });

  it("fails explicitly after the bounded click attempts", async () => {
    const counts = {clicks: 0};
    const actor = {attemptsTo: async (...activities) => {
      activities.forEach(activity => {
        if (activity.toString().includes("clicks Export GPX")) {
          counts.clicks += 1;
        } else if (activity.toString().includes("waits to see")) {
          rememberOsMapsExportOutcome(OsMapsExportClickOutcome.NO_DIALOG_APPEARED);
        }
      });
    }} as PerformsActivities;
    await expect(StartOsMapsGpxDownload.now().performAs(actor)).rejects.toThrow("after 3 attempts");
    expect(counts.clicks).toBe(3);
  });

  it("continues with later routes after a failed export and reports accurate totals", async () => {
    const routes = [101, 102, 103].map(id => ({...requestedOsMapsRouteFixture(`https://group.example.org.uk/routes/${id}`), id}));
    const attempted: string[] = [];
    const summaries: string[] = [];
    const actor = {attemptsTo: async (...activities) => {
      const descriptions = activities.map(activity => activity.toString());
      const summary = descriptions.find(description => osMapsExportProgressFromMessage(description));
      if (summary) {
        summaries.push(summary);
      } else if (descriptions.some(description => description.includes("waiting for DOMContentLoaded"))) {
        attempted.push(descriptions[0]);
        if (descriptions[0].includes("/102")) {
          throw new errors.TimeoutError("Export click timed out");
        }
      }
    }} as PerformsActivities;
    await expect(ExportRequestedOsMapsRoutes.from(routes).performAs(actor)).rejects.toThrow("2 of 3 routes converted; 1 failed");
    expect(attempted).toHaveLength(3);
    expect(attempted[2]).toContain("/103");
    expect(osMapsExportProgressFromMessage(summaries[summaries.length - 1])).toEqual({converted: 2, failed: 1, total: 3});
  });
});
