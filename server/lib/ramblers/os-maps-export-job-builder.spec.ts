import expect from "expect";
import { describe, it } from "mocha";
import { SerenityFeature } from "../../../projects/ngx-ramblers/src/app/models/serenity-feature.model";
import { buildOsMapsExportJob, buildOsMapsListJob } from "./os-maps-export-job-builder";

describe("os-maps-export-job-builder", () => {

  it("includes the selected route URLs", () => {
    const job = buildOsMapsExportJob(["https://explore.osmaps.com/route/1/one"]);
    expect(job.data.feature).toEqual(SerenityFeature.OS_MAPS_EXPORT);
    expect(job.data.osMapsRouteUrl).toEqual("https://explore.osmaps.com/route/1/one");
    expect(job.data.osMapsRouteUrls).toEqual(["https://explore.osmaps.com/route/1/one"]);
    expect(job.data.osMapsWalkId).toBeUndefined();
    expect(job.data.fileName).toMatch(/^os-maps-export-.+\.gpx$/);
  });

  it("includes a walk id when attaching the exported GPX", () => {
    const job = buildOsMapsExportJob(["https://explore.osmaps.com/route/1/one"], "walk-123");
    expect(job.data.osMapsWalkId).toEqual("walk-123");
  });

  it("includes the logged-in member as the Serenity actor", () => {
    const job = buildOsMapsExportJob(["https://explore.osmaps.com/route/1/one"], undefined, "Nick");
    expect(job.data.ramblersUser).toEqual("Nick");
  });

  it("builds a list job without route URLs", () => {
    const job = buildOsMapsListJob();
    expect(job.data.feature).toEqual(SerenityFeature.OS_MAPS_LIST);
    expect(job.data.osMapsRouteUrls).toBeUndefined();
  });

});
