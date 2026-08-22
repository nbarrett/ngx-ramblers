import { describe, expect, it } from "vitest";
import { Member } from "../models/member.model";
import { videoMeetingCancellationPeople } from "./video-meeting-cancellation";

function member(partial: Partial<Member> & Pick<Member, "firstName" | "lastName">): Member {
  return partial as Member;
}

describe("videoMeetingCancellationPeople", () => {

  it("hides people with no email or member id", () => {
    expect(videoMeetingCancellationPeople(
      [member({firstName: "Pat", lastName: "Lee"})],
      [{email: "", name: "Ghost"}]
    )).toEqual([]);
  });

  it("lists list members and guests by name, guests who are already on the list once", () => {
    const people = videoMeetingCancellationPeople(
      [
        member({id: "m2", firstName: "Sam", lastName: "Jones", email: "sam@example.com"}),
        member({id: "m1", firstName: "Alex", lastName: "Brown", email: "alex@example.com"})
      ],
      [
        {email: "alex@example.com", name: "Alex Brown"},
        {email: "guest@example.com", name: "Jordan Guest"}
      ]
    );
    expect(people.map(person => person.name)).toEqual(["Alex Brown", "Jordan Guest", "Sam Jones"]);
    expect(people.find(person => person.email === "guest@example.com")?.memberId).toBeNull();
  });

  it("uses the guest email when they have no name", () => {
    const people = videoMeetingCancellationPeople([], [{email: "guest@example.com"}]);
    expect(people).toEqual([{
      key: "guest@example.com",
      name: "guest@example.com",
      email: "guest@example.com",
      memberId: null
    }]);
  });
});
