import expect from "expect";
import { describe, it } from "mocha";
import { SerenityFeature } from "../../../projects/ngx-ramblers/src/app/models/serenity-feature.model";
import { buildOsDataHubApiKeyJob, buildOsMapsExportJob, buildOsMapsListJob } from "./os-maps-export-job-builder";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { isOsDataHubApiKeyJob, isOsMapsWorkerJob } from "./serenity-job-environment";
import { OS_DATA_HUB_API_KEY_FILE, osDataHubApiKeyFromJobPath } from "../os-maps/os-data-hub-api-key-store";

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

  it("builds an OS Data Hub key job for a project that runs like the other OS worker jobs, and reads the key it saves", () => {
    const job = buildOsDataHubApiKeyJob("milton-keynes-district");
    expect(job.data.feature).toEqual(SerenityFeature.OS_DATA_HUB_API_KEY);
    expect(job.data.osDataHubProjectName).toEqual("milton-keynes-district");
    expect(job.data.fileName).toMatch(/^os-data-hub-api-key-.+\.json$/);
    expect(isOsDataHubApiKeyJob(job) && isOsMapsWorkerJob(job)).toBe(true);
    const jobPath = fs.mkdtempSync(path.join(os.tmpdir(), "os-data-hub-"));
    expect(osDataHubApiKeyFromJobPath(jobPath)).toBeUndefined();
    fs.writeFileSync(path.join(jobPath, OS_DATA_HUB_API_KEY_FILE), JSON.stringify({projectName: "milton-keynes-district", apiKey: "key-value"}));
    expect(osDataHubApiKeyFromJobPath(jobPath)).toEqual({projectName: "milton-keynes-district", apiKey: "key-value"});
    fs.rmSync(jobPath, {recursive: true, force: true});
  });

});
