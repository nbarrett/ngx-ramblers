import { Member } from "../models/member.model";
import { VideoMeetingCancellationPerson, VideoMeetingInviteRecipient } from "../models/video-meeting.model";
import { memberFullName } from "./member-names";
import { normaliseEmail } from "./strings";

export function videoMeetingCancellationPeople(
  listMembers: Member[],
  guests: VideoMeetingInviteRecipient[]
): VideoMeetingCancellationPerson[] {
  const fromList = listMembers
    .map(member => {
      const email = (member.email || "").trim();
      return {
        key: member.id || normaliseEmail(email) || memberFullName(member),
        name: memberFullName(member, email || "Unknown member"),
        email,
        memberId: member.id || null
      };
    })
    .filter(person => person.memberId || person.email);
  const listEmails = new Set(
    fromList
      .map(person => normaliseEmail(person.email))
      .filter((email): email is string => !!email)
  );
  const fromGuests = guests
    .map(recipient => {
      const email = (recipient.email || "").trim();
      return {
        key: normaliseEmail(email) || email,
        name: (recipient.name || "").trim() || email,
        email,
        memberId: null as string | null
      };
    })
    .filter(person => person.email && !listEmails.has(normaliseEmail(person.email)));
  return [...fromList, ...fromGuests].sort((left, right) => left.name.localeCompare(right.name, "en-GB"));
}
