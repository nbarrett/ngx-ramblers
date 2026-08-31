import { Member } from "../models/member.model";
import { CalendarRsvpStatus } from "../models/inbox.model";
import {
  VideoMeetingInviteRecipient,
  VideoMeetingRsvp,
  VideoMeetingRsvpPerson
} from "../models/video-meeting.model";
import { videoMeetingCancellationPeople } from "./video-meeting-cancellation";
import { normaliseEmail } from "./strings";

export function videoMeetingRsvpLabel(status: CalendarRsvpStatus | null): string {
  if (status === CalendarRsvpStatus.ACCEPTED) {
    return "Accepted";
  } else if (status === CalendarRsvpStatus.TENTATIVE) {
    return "Maybe";
  } else if (status === CalendarRsvpStatus.DECLINED) {
    return "Declined";
  } else {
    return "Awaiting reply";
  }
}

export function mergeMeetingRsvps(existing: VideoMeetingRsvp[], incoming: VideoMeetingRsvp[]): VideoMeetingRsvp[] {
  const merged = new Map((existing || []).map(rsvp => [normaliseEmail(rsvp.email), rsvp]));
  (incoming || []).forEach(rsvp => {
    const email = normaliseEmail(rsvp.email);
    if (email) {
      const previous = merged.get(email);
      merged.set(email, {
        email: rsvp.email || previous?.email || email,
        name: rsvp.name || previous?.name,
        status: rsvp.status,
        respondedAt: rsvp.respondedAt
      });
    }
  });
  return [...merged.values()];
}

export function videoMeetingRsvpPeople(
  listMembers: Member[],
  guests: VideoMeetingInviteRecipient[],
  rsvps: VideoMeetingRsvp[]
): VideoMeetingRsvpPerson[] {
  const invited = videoMeetingCancellationPeople(listMembers, guests);
  const invitedEmails = new Set(
    invited
      .map(person => normaliseEmail(person.email))
      .filter((email): email is string => !!email)
  );
  const byEmail = new Map((rsvps || []).map(rsvp => [normaliseEmail(rsvp.email), rsvp]));
  const fromInvited = invited.map(person => {
    const rsvp = byEmail.get(normaliseEmail(person.email));
    return {
      ...person,
      status: rsvp?.status ?? null,
      respondedAt: rsvp?.respondedAt ?? null
    };
  });
  const extras = (rsvps || [])
    .filter(rsvp => {
      const email = normaliseEmail(rsvp.email);
      return !!email && !invitedEmails.has(email);
    })
    .map(rsvp => ({
      key: normaliseEmail(rsvp.email) || rsvp.email,
      name: (rsvp.name || "").trim() || rsvp.email,
      email: rsvp.email,
      memberId: null as string | null,
      status: rsvp.status,
      respondedAt: rsvp.respondedAt ?? null
    }));
  return [...fromInvited, ...extras].sort((left, right) => left.name.localeCompare(right.name, "en-GB"));
}
