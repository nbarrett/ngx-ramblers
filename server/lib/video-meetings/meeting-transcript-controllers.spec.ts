import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { deleteMeetingTranscript } from "./meeting-transcript-controllers";
import { meetingTranscriptLine } from "../mongo/models/meeting-transcript";
import { meetingNote } from "../mongo/models/meeting-note";

function mockResponse() {
  const res: any = {statusCode: undefined, body: undefined};
  res.status = sinon.stub().callsFake((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = sinon.stub().callsFake((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe("deleteMeetingTranscript", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("rejects a missing room", async () => {
    const res = mockResponse();
    await deleteMeetingTranscript({query: {}} as any, res);
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual("room is required");
  });

  it("deletes transcript lines and notes for the room", async () => {
    sandbox.stub(meetingTranscriptLine, "deleteMany").returns({exec: () => Promise.resolve({deletedCount: 4})} as any);
    sandbox.stub(meetingNote, "deleteMany").returns({exec: () => Promise.resolve({deletedCount: 1})} as any);
    const res = mockResponse();
    await deleteMeetingTranscript({query: {room: "video-call-sunday-30-august-2026-1234"}} as any, res);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({
      room: "video-call-sunday-30-august-2026-1234",
      transcriptDeleted: 4,
      notesDeleted: 1
    });
  });

  it("retries once when the database connection times out", async () => {
    const timeout = Object.assign(new Error("connection timed out"), {
      name: "MongoNetworkTimeoutError",
      hasErrorLabel: (label: string) => label === "RetryableWriteError"
    });
    const transcript = sandbox.stub(meetingTranscriptLine, "deleteMany");
    transcript.onFirstCall().returns({exec: () => Promise.reject(timeout)} as any);
    transcript.onSecondCall().returns({exec: () => Promise.resolve({deletedCount: 2})} as any);
    sandbox.stub(meetingNote, "deleteMany").returns({exec: () => Promise.resolve({deletedCount: 0})} as any);
    const res = mockResponse();
    await deleteMeetingTranscript({query: {room: "video-call-sunday-30-august-2026-1234"}} as any, res);
    expect(transcript.callCount).toEqual(2);
    expect(res.statusCode).toEqual(200);
    expect(res.body.transcriptDeleted).toEqual(2);
  });
});
