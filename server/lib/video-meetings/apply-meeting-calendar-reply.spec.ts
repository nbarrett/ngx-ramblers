import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { CalendarRsvpStatus, InboxMessage, InboxMessageDirection, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { applyInboundMeetingCalendarReply } from "./apply-meeting-calendar-reply";
import * as aws from "../aws/aws-controllers";
import committeeFile from "../mongo/models/committee-file";

const MEETING_ID = "507f1f77bcf86cd799439011";

function replyIcs(status: string): string {
  return [
    "BEGIN:VCALENDAR",
    "METHOD:REPLY",
    "BEGIN:VEVENT",
    `UID:meeting-${MEETING_ID}@example.co.uk`,
    `ATTENDEE;CN=Jordan Guest;PARTSTAT=${status}:mailto:guest@example.com`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function message(): InboxMessage {
  return {
    id: "m1",
    threadId: "t1",
    mailboxConnectionId: "c1",
    messageId: "msg-1",
    inReplyTo: null,
    references: [],
    from: {email: "guest@example.com", name: "Jordan Guest"},
    to: [{email: "secretary@example.co.uk", name: "Secretary"}],
    cc: [],
    subject: "Accepted: Committee meeting",
    bodyHtml: null,
    bodyText: "accepted",
    receivedAt: 1000,
    sentAt: null,
    direction: InboxMessageDirection.INBOUND,
    externalSource: InboxReaderProvider.GMAIL_API,
    externalId: "ext-1",
    attachments: [{filename: "invite.ics", contentType: "text/calendar", sizeBytes: 120, s3Key: "inbox/invite.ics", contentId: null}]
  };
}

describe("applyInboundMeetingCalendarReply", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("writes an accepted reply onto the meeting that sent the invite", async () => {
    sandbox.stub(aws, "objectBufferForKey").resolves(Buffer.from(replyIcs("ACCEPTED")));
    sandbox.stub(committeeFile, "findById").returns({lean: () => Promise.resolve({
      _id: MEETING_ID,
      meeting: {format: "online", room: "committee-meeting", rsvps: []}
    })} as any);
    const update = sandbox.stub(committeeFile, "updateOne").resolves({modifiedCount: 1} as any);

    const applied = await applyInboundMeetingCalendarReply(message());

    expect(applied).toEqual(1);
    expect(update.calledOnce).toEqual(true);
    expect(update.firstCall.args[1]).toEqual({
      $set: {
        "meeting.rsvps": [{
          email: "guest@example.com",
          name: "Jordan Guest",
          status: CalendarRsvpStatus.ACCEPTED,
          respondedAt: 1000
        }]
      }
    });
  });

  it("does nothing when the calendar file is not a reply to a meeting", async () => {
    sandbox.stub(aws, "objectBufferForKey").resolves(Buffer.from("BEGIN:VCALENDAR\nMETHOD:PUBLISH\nEND:VCALENDAR"));
    const find = sandbox.stub(committeeFile, "findById");
    const applied = await applyInboundMeetingCalendarReply(message());
    expect(applied).toEqual(0);
    expect(find.called).toEqual(false);
  });

});
