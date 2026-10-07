import { describe, expect, it } from "vitest";
import { RoleType } from "../models/committee.model";
import { Member } from "../models/member.model";
import {
  meetingInviteBodyMarkdown,
  meetingInviteCommitteeRoleSendOffered,
  meetingInviteRecipientMember,
  personalisedGuestJoinUrl,
  personaliseJoinLinkHtml
} from "./video-meeting-invite";

describe("meetingInviteBodyMarkdown", () => {

  it("includes a short note in the body so the meeting title can stay short", () => {
    const body = meetingInviteBodyMarkdown({
      dateLabel: "Wednesday 2 September 2026",
      timeLabel: "9:00 am",
      joinUrl: "https://example.org/video-meetings/guest/room-1",
      location: "",
      note: "Please have the walk reports to hand.",
      guestInstructions: "Allow the camera and microphone.",
      signoff: "Kind regards\n\nNick Barrett"
    });
    expect(body).toContain("You are invited to a committee meeting.");
    expect(body).toContain("Please have the walk reports to hand.");
    expect(body).toContain("**When:** Wednesday 2 September 2026 at 9:00 am");
    expect(body).toContain("**Join:** [https://example.org/video-meetings/guest/room-1](https://example.org/video-meetings/guest/room-1)");
    expect(body).toContain("Kind regards");
    expect(body.indexOf("Please have the walk reports to hand.")).toBeLessThan(body.indexOf("**When:**"));
  });

  it("omits the note when none is given", () => {
    const body = meetingInviteBodyMarkdown({
      dateLabel: "Wednesday 2 September 2026",
      timeLabel: "9:00 am",
      joinUrl: "",
      location: "Village Hall",
      note: "  ",
      guestInstructions: "Allow the camera and microphone.",
      signoff: ""
    });
    expect(body).toContain("**Where:** Village Hall");
    expect(body).not.toContain("Please");
    expect(body).toContain("We look forward to seeing you there.");
  });

});

describe("meetingInviteCommitteeRoleSendOffered", () => {
  const chair = {
    type: "chair",
    description: "Chair",
    fullName: "Alex Reed",
    email: "chair@group.example.org.uk",
    memberId: "m1",
    roleType: RoleType.COMMITTEE_MEMBER
  };
  const alex = {id: "m1", firstName: "Alex", lastName: "Reed", email: "alex.reed@example.com"} as Member;
  const walker = {id: "m2", firstName: "Sam", lastName: "Walker", email: "sam.walker@example.com"} as Member;

  it("is offered when every chosen person holds a committee role", () => {
    expect(meetingInviteCommitteeRoleSendOffered(
      [{email: alex.email, name: "Alex Reed", memberId: alex.id}],
      [alex, walker],
      [chair]
    )).toEqual(true);
  });

  it("is still offered after the chip has been rewritten to the role mailbox", () => {
    expect(meetingInviteCommitteeRoleSendOffered(
      [{email: chair.email, name: "Alex Reed", memberId: alex.id}],
      [alex, walker],
      [chair]
    )).toEqual(true);
    expect(meetingInviteRecipientMember(
      {email: chair.email, name: "Chair"},
      [alex, walker],
      [chair]
    )?.id).toEqual(alex.id);
  });

  it("is not offered for a mixed invite of committee and other members", () => {
    expect(meetingInviteCommitteeRoleSendOffered(
      [
        {email: alex.email, name: "Alex Reed", memberId: alex.id},
        {email: walker.email, name: "Sam Walker", memberId: walker.id}
      ],
      [alex, walker],
      [chair]
    )).toEqual(false);
  });

  it("is not offered for a previously saved personal address that is not a group member", () => {
    expect(meetingInviteCommitteeRoleSendOffered(
      [{email: "guest@example.com", name: "Alex"}],
      [alex, walker],
      [chair]
    )).toEqual(false);
  });
});

describe("personalisedGuestJoinUrl", () => {

  it("carries the invitee name and email as merge fields so each person joins as themselves", () => {
    expect(personalisedGuestJoinUrl("https://example.org/video-meetings/guest/room-1"))
      .toEqual("https://example.org/video-meetings/guest/room-1?name={{params.memberMergeFields.FULL_NAME}}&email={{params.memberMergeFields.EMAIL}}");
  });

  it("is blank when there is no join link", () => {
    expect(personalisedGuestJoinUrl("")).toEqual("");
  });

});

describe("personaliseJoinLinkHtml", () => {

  it("rewrites only the link target, leaving the visible address as sent", () => {
    const joinUrl = "https://example.org/video-meetings/guest/room-1";
    const html = `<p><strong>Join:</strong> <a href="${joinUrl}">${joinUrl}</a></p>`;
    expect(personaliseJoinLinkHtml(html, joinUrl))
      .toEqual(`<p><strong>Join:</strong> <a href="${joinUrl}?name={{params.memberMergeFields.FULL_NAME}}&amp;email={{params.memberMergeFields.EMAIL}}">${joinUrl}</a></p>`);
  });

  it("leaves the html alone for an in-person meeting with no link", () => {
    const html = "<p><strong>Where:</strong> Village Hall</p>";
    expect(personaliseJoinLinkHtml(html, "")).toEqual(html);
  });

});
