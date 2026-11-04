import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { notifyOrganiserByEmail } from "./meeting-minutes-document";
import * as minutesReadyMail from "../brevo/transactional-mail/send-meeting-minutes-ready-email";
import { CommitteeFile, CommitteeMeetingFormat } from "../../../projects/ngx-ramblers/src/app/models/committee.model";

function minutesFile(): CommitteeFile {
  return {
    id: "file-1",
    fileType: "Committee Minutes",
    document: {title: "Minutes - Video call"},
    meeting: {format: CommitteeMeetingFormat.ONLINE, createdBy: "m1", room: "video-call"}
  };
}

describe("notifyOrganiserByEmail", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("does not send when Built-in Processes mapping is None", async () => {
    const send = sandbox.stub(minutesReadyMail, "sendMeetingMinutesReadyEmail").resolves(false);
    expect(await notifyOrganiserByEmail(minutesFile(), "https://group.example.org.uk/admin/meetings/minutes/video-call")).toEqual(false);
    expect(send.calledOnce).toEqual(true);
  });

  it("sends through the mapped email configuration", async () => {
    const send = sandbox.stub(minutesReadyMail, "sendMeetingMinutesReadyEmail").resolves(true);
    const link = "https://group.example.org.uk/admin/meetings/minutes/video-call";
    const file = minutesFile();
    expect(await notifyOrganiserByEmail(file, link, "recorder-1")).toEqual(true);
    expect(send.calledOnce).toEqual(true);
    expect(send.firstCall.args[0]).toEqual({committeeFile: file, link, recorderMemberId: "recorder-1"});
  });
});
