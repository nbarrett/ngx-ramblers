import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { recordRamblersUploadOutcome, rememberRamblersUploadWalks } from "./ramblers-upload-outcome";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { EventType } from "../../../projects/ngx-ramblers/src/app/models/walk.model";

const sandbox = sinon.createSandbox();

function stubWalkModel() {
  const walk = {_id: "walk-1", groupEvent: {title: "Seven Sisters"}, fields: {publishing: {ramblers: {publish: true}}}};
  sandbox.stub(extendedGroupEvent, "find").returns({lean: () => ({exec: async () => [walk]})} as any);
  return sandbox.stub(extendedGroupEvent, "updateOne").returns({exec: async () => ({modifiedCount: 1})} as any);
}

describe("recordRamblersUploadOutcome", () => {
  afterEach(() => sandbox.restore());

  it("records a failed upload on each walk without adding a published event", async () => {
    const updateOne = stubWalkModel();
    rememberRamblersUploadWalks("job-failed", {fileName: "walks.csv", localWalkIds: ["walk-1"], memberId: "member-1"});
    await recordRamblersUploadOutcome("job-failed", Status.ERROR);
    const update = updateOne.firstCall.args[1] as any;
    expect(update.$set["fields.ramblersUpload"]).toMatchObject({fileName: "walks.csv", succeeded: false});
    expect(update.$push).toBeUndefined();
  });

  it("records a successful upload and adds the published event once the upload has finished", async () => {
    const updateOne = stubWalkModel();
    rememberRamblersUploadWalks("job-succeeded", {fileName: "walks.csv", localWalkIds: ["walk-1"], memberId: "member-1"});
    await recordRamblersUploadOutcome("job-succeeded", Status.SUCCESS);
    const update = updateOne.firstCall.args[1] as any;
    expect(update.$set["fields.ramblersUpload"].succeeded).toBe(true);
    expect(update.$push.events).toMatchObject({eventType: EventType.PUBLISHED_TO_RAMBLERS, memberId: "member-1"});
  });

  it("does nothing for a job that was not a walks upload", async () => {
    const updateOne = stubWalkModel();
    await recordRamblersUploadOutcome("job-unknown", Status.SUCCESS);
    expect(updateOne.called).toBe(false);
  });
});
