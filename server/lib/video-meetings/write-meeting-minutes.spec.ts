import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { writeMeetingMinutes } from "./write-meeting-minutes";
import { meetingNote } from "../mongo/models/meeting-note";
import { meetingTranscriptLine } from "../mongo/models/meeting-transcript";
import * as aiConfig from "../ai/ai-config";
import * as aiGeneration from "../ai/ai-generation";
import * as minutesDocument from "./meeting-minutes-document";

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

function execChain(result: unknown) {
  return {sort: () => ({lean: () => ({exec: () => Promise.resolve(result)})})};
}

describe("writeMeetingMinutes", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(meetingNote, "find").returns(execChain([]) as any);
    sandbox.stub(meetingTranscriptLine, "find").returns(execChain([
      {room: "long-call", authorName: "Nick", text: "We agreed to move the walk.", at: 1}
    ]) as any);
    sandbox.stub(meetingNote, "findOne").returns({sort: () => ({exec: () => Promise.resolve(null)})} as any);
    sandbox.stub(meetingNote, "create").resolves({
      id: "note-1",
      room: "long-call",
      text: "record",
      toObject: () => ({id: "note-1", room: "long-call", text: "record"})
    } as any);
    sandbox.stub(meetingNote, "deleteOne").returns({exec: () => Promise.resolve({})} as any);
    sandbox.stub(aiConfig, "aiConfigFromEnvironment").returns({enabled: true} as any);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("saves the verbatim record and responds before summarising finishes", async () => {
    const hold: {resolve?: (value: string) => void} = {};
    sandbox.stub(aiGeneration, "generate").returns(new Promise(resolve => {
      hold.resolve = resolve;
    }));
    const publish = sandbox.stub(minutesDocument, "publishMeetingMinutes").resolves({
      link: "https://example.test/minutes",
      emailed: false,
      path: null,
      slug: "long-call"
    });
    sandbox.stub(minutesDocument, "minutesDraftStillPending").resolves(true);
    const res = mockResponse();
    await writeMeetingMinutes({
      body: {room: "long-call", transcript: "", chat: "", notify: true},
      user: {memberId: "m1"}
    } as any, res);
    expect(res.statusCode).toEqual(200);
    expect(res.body.slug).toEqual("long-call");
    expect(publish.calledOnce).toEqual(true);
    expect(publish.firstCall.args[1]).toContain("We agreed to move the walk.");
    expect(publish.firstCall.args[2]).toEqual(false);
    expect(hold.resolve).toBeTruthy();
    hold.resolve("## Discussion\n\nThe group agreed to move the walk.");
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(publish.callCount).toEqual(2);
    expect(publish.secondCall.args[1]).toContain("The group agreed to move the walk.");
    expect(publish.secondCall.args[2]).toEqual(true);
  });
});
