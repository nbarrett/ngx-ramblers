import expect from "expect";
import { describe, it } from "mocha";
import { OS_MAPS_EXPORT_MAX_WAIT_MS, OsMapsExportJobResult, OsMapsExportJobStatus } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { osMapsExportResultWithActivity } from "./os-maps-export-result-store";

const queued: OsMapsExportJobResult = {
  jobId: "example-job", fileName: "example-export.gpx", status: OsMapsExportJobStatus.QUEUED,
  walkId: null, routeUrls: [], gpxFiles: [], error: null, createdAt: 1, completedAt: null
};

describe("OS Maps export inactivity", () => {
  const now = OS_MAPS_EXPORT_MAX_WAIT_MS * 10;

  it("keeps a long-running job active when activity is recent", () => {
    expect(osMapsExportResultWithActivity(queued, now - 1000, now).status).toEqual(OsMapsExportJobStatus.QUEUED);
  });

  it("reports inactivity without changing the stored result", () => {
    expect(osMapsExportResultWithActivity(queued, queued.createdAt, now).status).toEqual(OsMapsExportJobStatus.FAILED);
    expect(queued.status).toEqual(OsMapsExportJobStatus.QUEUED);
  });

  it("recovers either timeout message when activity resumes", () => {
    ["No result came back from the worker within 12 minutes", "No activity came back from the worker for 12 minutes"].forEach(error => {
      const result = {...queued, status: OsMapsExportJobStatus.FAILED, error, completedAt: now - 2000};
      expect(osMapsExportResultWithActivity(result, now - 1000, now)).toMatchObject({status: OsMapsExportJobStatus.QUEUED, error: null, completedAt: null});
      expect(result.status).toEqual(OsMapsExportJobStatus.FAILED);
    });
  });

  it("preserves completed, cancelled and genuinely failed jobs", () => {
    [
      {...queued, status: OsMapsExportJobStatus.COMPLETED},
      {...queued, status: OsMapsExportJobStatus.FAILED, error: "This conversion was stopped before it finished"},
      {...queued, status: OsMapsExportJobStatus.FAILED, error: "Export button unavailable"}
    ].forEach(result => expect(osMapsExportResultWithActivity(result, now - 1000, now)).toBe(result));
  });
});
