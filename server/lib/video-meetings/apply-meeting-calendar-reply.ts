import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { objectBufferForKey } from "../aws/aws-controllers";
import committeeFile from "../mongo/models/committee-file";
import { CommitteeFile } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxMessage } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { VideoMeetingRsvp } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import {
  calendarReplyResponses,
  committeeFileIdFromMeetingUid,
  isCalendarFile,
  meetingRoomFromCalendarEvent,
  parseIcsCalendar
} from "../../../projects/ngx-ramblers/src/app/functions/ics-calendar";
import { mergeMeetingRsvps } from "../../../projects/ngx-ramblers/src/app/functions/video-meeting-rsvp";
import { dateTimeNow } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("apply-meeting-calendar-reply"));
debugLog.enabled = true;

type StoredCommitteeFile = CommitteeFile & {_id?: unknown};

async function meetingFileForInvite(uid: string | null, room: string | null): Promise<StoredCommitteeFile | null> {
  const id = committeeFileIdFromMeetingUid(uid);
  const byId = id ? await committeeFile.findById(id).lean() as StoredCommitteeFile | null : null;
  if (byId?.meeting) {
    return byId;
  } else if (room) {
    return committeeFile.findOne({"meeting.room": room}).lean() as Promise<StoredCommitteeFile | null>;
  } else {
    return null;
  }
}

async function applyCalendarSource(source: string, respondedAt: number): Promise<number> {
  const invite = parseIcsCalendar(source);
  const responses = calendarReplyResponses(invite);
  const event = invite.events[0] || null;
  if (!event || responses.length === 0) {
    return 0;
  } else {
    const file = await meetingFileForInvite(event.uid, meetingRoomFromCalendarEvent(event));
    if (!file?.meeting) {
      debugLog("no meeting found for calendar reply uid", event.uid);
      return 0;
    } else {
      const incoming: VideoMeetingRsvp[] = responses.map(response => ({
        email: response.email,
        name: response.name || undefined,
        status: response.status,
        respondedAt
      }));
      const merged = mergeMeetingRsvps(file.meeting.rsvps || [], incoming);
      await committeeFile.updateOne({_id: file.id || file._id}, {$set: {"meeting.rsvps": merged}});
      debugLog("recorded", incoming.length, "meeting replies for", event.uid);
      return incoming.length;
    }
  }
}

export async function applyInboundMeetingCalendarReply(message: InboxMessage): Promise<number> {
  const attachments = (message.attachments || []).filter(item => isCalendarFile(item.filename, item.contentType) && item.s3Key);
  const respondedAt = message.receivedAt || message.sentAt || dateTimeNow().toMillis();
  return attachments.reduce(async (countPromise, attachment) => {
    const count = await countPromise;
    try {
      const source = (await objectBufferForKey(attachment.s3Key)).toString("utf8");
      return count + await applyCalendarSource(source, respondedAt);
    } catch (error) {
      debugLog("failed to apply calendar reply from", attachment.filename, (error as Error).message);
      return count;
    }
  }, Promise.resolve(0));
}
