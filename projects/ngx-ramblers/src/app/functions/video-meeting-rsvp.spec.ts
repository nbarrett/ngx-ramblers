import { describe, expect, it } from "vitest";
import { CalendarRsvpStatus } from "../models/inbox.model";
import { Member } from "../models/member.model";
import { mergeMeetingRsvps, videoMeetingRsvpLabel, videoMeetingRsvpPeople } from "./video-meeting-rsvp";

function member(partial: Partial<Member> & Pick<Member, "firstName" | "lastName">): Member {
  return partial as Member;
}

describe("videoMeetingRsvpLabel", () => {

  it("uses Maybe for a tentative reply, matching Gmail", () => {
    expect(videoMeetingRsvpLabel(CalendarRsvpStatus.ACCEPTED)).toEqual("Accepted");
    expect(videoMeetingRsvpLabel(CalendarRsvpStatus.TENTATIVE)).toEqual("Maybe");
    expect(videoMeetingRsvpLabel(CalendarRsvpStatus.DECLINED)).toEqual("Declined");
    expect(videoMeetingRsvpLabel(null)).toEqual("Awaiting reply");
  });

});

describe("mergeMeetingRsvps", () => {

  it("updates an existing reply for the same email and keeps earlier ones", () => {
    const merged = mergeMeetingRsvps(
      [{email: "alex@example.com", name: "Alex", status: CalendarRsvpStatus.TENTATIVE, respondedAt: 1}],
      [{email: "Alex@example.com", status: CalendarRsvpStatus.ACCEPTED, respondedAt: 2}]
    );
    expect(merged).toEqual([{
      email: "Alex@example.com",
      name: "Alex",
      status: CalendarRsvpStatus.ACCEPTED,
      respondedAt: 2
    }]);
  });

  it("appends a reply from someone who was not already on the list", () => {
    const merged = mergeMeetingRsvps(
      [{email: "alex@example.com", status: CalendarRsvpStatus.ACCEPTED, respondedAt: 1}],
      [{email: "jordan@example.com", name: "Jordan", status: CalendarRsvpStatus.DECLINED, respondedAt: 2}]
    );
    expect(merged.map(rsvp => rsvp.email)).toEqual(["alex@example.com", "jordan@example.com"]);
  });

});

describe("videoMeetingRsvpPeople", () => {

  it("joins replies onto the invited list and keeps extra respondents", () => {
    const people = videoMeetingRsvpPeople(
      [member({id: "m1", firstName: "Alex", lastName: "Brown", email: "alex@example.com"})],
      [{email: "guest@example.com", name: "Jordan Guest"}],
      [
        {email: "alex@example.com", status: CalendarRsvpStatus.ACCEPTED, respondedAt: 10},
        {email: "extra@example.com", name: "Pat Extra", status: CalendarRsvpStatus.DECLINED, respondedAt: 11}
      ]
    );
    expect(people.map(person => [person.name, videoMeetingRsvpLabel(person.status)])).toEqual([
      ["Alex Brown", "Accepted"],
      ["Jordan Guest", "Awaiting reply"],
      ["Pat Extra", "Declined"]
    ]);
  });

});
