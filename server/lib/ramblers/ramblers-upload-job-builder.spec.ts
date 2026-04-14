import expect from "expect";
import { describe, it } from "mocha";
import { buildRamblersUploadJob } from "./ramblers-upload-job-builder";
import { RamblersUploadJobState } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";

describe("buildRamblersUploadJob", () => {
  it("builds a queued job with walks upload data", () => {
    const request: RamblersWalksUploadRequest = {
      fileName: "walks.csv",
      walkIdDeletionList: ["1"],
      walkIdUploadList: [{ walkId: "2", date: "2026-03-14", title: "Test walk" }],
      walkCancellations: [{ walkId: "3", reason: "Weather" }],
      walkUncancellations: ["4"],
      headings: ["Title"],
      rows: [{}],
      ramblersUser: "nick@example.com"
    };

    const result = buildRamblersUploadJob(request);

    expect(result.jobId).toBeTruthy();
    expect(result.createdAt).toEqual(expect.any(Number));
    expect(result.state).toEqual(RamblersUploadJobState.QUEUED);
    expect(result.data.fileName).toEqual("walks.csv");
    expect(result.data.feature).toEqual("walks-upload.ts");
    expect(result.data.walkIdDeletionList).toEqual(["1"]);
    expect(result.data.walkUncancellations).toEqual(["4"]);
    expect(result.data.walkIdUploadList[0].title).toEqual("Test walk");
  });
});
