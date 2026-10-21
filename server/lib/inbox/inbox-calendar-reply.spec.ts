import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { CalendarRsvpStatus, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxThread } from "../mongo/models/inbox-thread";
import { inboxMessage } from "../mongo/models/inbox-message";
import { inboxMailboxConnection } from "../mongo/models/inbox-mailbox-connection";
import { member } from "../mongo/models/member";
import * as access from "./inbox-access";
import * as aliases from "./inbox-aliases";
import * as aws from "../aws/aws-controllers";
import * as gmail from "./gmail-inbox-reader";
import * as smtp from "../brevo/smtp-relay";
import { sendCalendarReply } from "./inbox-calendar-reply";

describe("sendCalendarReply", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  const invite = [
    "BEGIN:VCALENDAR",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "UID:meeting-1@example.org",
    "SUMMARY:Committee meeting",
    "ORGANIZER;CN=Alex Reed:mailto:alex.reed@example.com",
    "ATTENDEE;CN=Secretary:mailto:secretary@group.example.org.uk",
    "DTSTART:20261022T140000Z",
    "DTEND:20261022T143000Z",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  it("sends a Direct to inbox RSVP through SMTP when no Gmail mailbox is connected", async () => {
    sandbox.stub(inboxThread, "findOne").returns({lean: async () => ({
      id: "0123456789abcdef01234567",
      roleType: "secretary",
      folder: InboxThreadFolder.INBOX
    })} as any);
    sandbox.stub(access, "requireInboxRoleAccess").resolves(true);
    sandbox.stub(inboxMessage, "findOne").returns({lean: async () => ({
      threadId: "0123456789abcdef01234567",
      messageId: "<invite@example.com>",
      from: {name: "Alex Reed", email: "alex.reed@example.com"},
      attachments: [{filename: "invite.ics", contentType: "text/calendar", s3Key: "mail/invite.ics"}],
      references: []
    })} as any);
    sandbox.stub(aws, "objectBufferForKey").resolves(Buffer.from(invite, "utf8"));
    sandbox.stub(aliases, "derivedAliasForRoleType").resolves({
      roleType: "secretary",
      roleEmail: "secretary@group.example.org.uk",
      tenantSlug: "default"
    } as any);
    sandbox.stub(inboxMailboxConnection, "findOne").returns({lean: async () => null} as any);
    sandbox.stub(member, "findById").returns({select: () => ({lean: async () => ({email: "alex.reed@example.com", firstName: "Alex", lastName: "Reed"})})} as any);
    const gmailSend = sandbox.stub(gmail, "sendRfc822");
    const smtpSend = sandbox.stub(smtp, "relayRawMime").resolves();
    sandbox.stub(inboxMessage, "updateOne").resolves({} as any);
    const json = sandbox.spy();
    await sendCalendarReply({
      params: {id: "0123456789abcdef01234567"},
      body: {messageId: "<invite@example.com>", status: CalendarRsvpStatus.ACCEPTED},
      user: {memberId: "member-1"}
    } as any, {json, status: sandbox.stub().returnsThis()} as any);
    expect(gmailSend.called).toBe(false);
    expect(smtpSend.calledOnce).toBe(true);
    expect(smtpSend.firstCall.args[0].envelopeFrom).toEqual("secretary@group.example.org.uk");
    expect(smtpSend.firstCall.args[0].envelopeTo).toEqual("alex.reed@example.com");
    expect(json.firstCall.args[0].response).toEqual({status: CalendarRsvpStatus.ACCEPTED, attendeeEmail: "secretary@group.example.org.uk"});
  });
});
