import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { systemConfig } from "../config/system-config";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { GroupEventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { icalDocument, meetingIcalDocument } from "./ical";
import { publicImageBaseUrl } from "../social/public-base-url";
import { dateTimeNow } from "../shared/dates";
import committeeFile from "../mongo/models/committee-file";
import { queryKey } from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeFile, meetingHasVenue, meetingIsOnline } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { committeeFileMeetingTitle } from "../../../projects/ngx-ramblers/src/app/functions/committee-meeting-agenda";

const debugLog = debug(envConfig.logNamespace("calendar"));
debugLog.enabled = false;
const errorDebugLog = createErrorDebugLog("calendar");

const FEED_MONTHS_AHEAD = 12;
const MAXIMUM_FEED_EVENTS = 500;
const CACHE_CONTROL = "public, max-age=1800";
const CALENDAR_EVENT_SELECT = [
  GroupEventField.TITLE,
  GroupEventField.DESCRIPTION,
  GroupEventField.STATUS,
  GroupEventField.URL,
  GroupEventField.ITEM_TYPE,
  GroupEventField.START_DATE,
  GroupEventField.END_DATE_TIME,
  GroupEventField.START_LOCATION,
  GroupEventField.LOCATION,
  GroupEventField.DATE_UPDATED
].join(" ");

function calendarNameFor(config: SystemConfig): string {
  const siteName = config?.group?.shortName || config?.group?.longName || "Ramblers";
  return `${siteName} walks and events`;
}

function sendCalendar(res: Response, document: string, fileName: string): void {
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  res.setHeader("Cache-Control", CACHE_CONTROL);
  res.send(document);
}

export async function eventCalendar(req: Request, res: Response): Promise<void> {
  const eventId = req.params.eventId?.replace(/\.ics$/, "");
  try {
    const config: SystemConfig = await systemConfig();
    const event = await extendedGroupEvent.findById(eventId).lean().exec() as ExtendedGroupEvent;
    if (event) {
      const baseUrl = publicImageBaseUrl(req, config);
      sendCalendar(res, icalDocument([event], config, baseUrl, event.groupEvent?.title || calendarNameFor(config)), `${eventId}.ics`);
    } else {
      res.status(404).json({message: `No event found with id ${eventId}`});
    }
  } catch (error) {
    errorDebugLog("eventCalendar failed for", eventId, "error:", error);
    res.status(500).json({message: "Calendar generation failed"});
  }
}

function committeeSecretaryEmail(committeeConfig: CommitteeConfig | null): { name?: string; email?: string } {
  const roles = committeeConfig?.roles || [];
  const secretary = roles.find(role => role.type === "secretary") || roles.find(role => /secretary/i.test(role.description || ""));
  const withEmail = secretary?.email ? secretary : roles.find(role => !!role.email);
  return {name: withEmail?.fullName || withEmail?.description, email: withEmail?.email};
}

export async function meetingCalendarFile(committeeFileId: string, req: Request): Promise<{document: string; fileName: string} | null> {
  const id = (committeeFileId || "").replace(/\.ics$/i, "");
  const meetingFile = await committeeFile.findById(id).lean().exec() as unknown as CommitteeFile;
  if (!meetingFile?.meeting) {
    return null;
  } else {
    const config: SystemConfig = await systemConfig();
    const baseUrl = publicImageBaseUrl(req, config).replace(/\/+$/, "");
    const committeeConfigDoc = await queryKey(ConfigKey.COMMITTEE);
    const fallbackOrganiser = committeeSecretaryEmail(committeeConfigDoc?.value as CommitteeConfig || null);
    const host = baseUrl.replace(/^https?:\/\//, "") || "ngx-ramblers";
    const room = meetingFile.meeting.room;
    const joinLink = meetingIsOnline(meetingFile.meeting.format) && room
      ? `${baseUrl}/video-meetings/guest/${encodeURIComponent(room)}`
      : null;
    const venue = meetingHasVenue(meetingFile.meeting.format) ? meetingFile.meeting.location : null;
    const descriptionLines = [joinLink ? `Join the meeting: ${joinLink}` : null, venue ? `Location: ${venue}` : null].filter(Boolean);
    const attendees = (meetingFile.meeting.invitedRecipients || [])
      .filter(recipient => !!recipient?.email)
      .map(recipient => ({email: recipient.email, name: recipient.name}));
    const document = meetingIcalDocument({
      uid: `meeting-${id}@${host}`,
      title: committeeFileMeetingTitle(meetingFile),
      startTime: meetingFile.eventDate,
      durationMinutes: meetingFile.meeting.durationMinutes,
      description: descriptionLines.join("\n") || undefined,
      location: joinLink || venue || undefined,
      url: joinLink || undefined,
      organiserName: meetingFile.meeting.organiserName || fallbackOrganiser.name,
      organiserEmail: meetingFile.meeting.organiserEmail || fallbackOrganiser.email,
      attendees
    }, calendarNameFor(config));
    return {document, fileName: `${id}.ics`};
  }
}

export async function meetingInviteCalendar(req: Request, res: Response): Promise<void> {
  const id = req.params.id?.replace(/\.ics$/i, "");
  try {
    const file = await meetingCalendarFile(id, req);
    if (file) {
      sendCalendar(res, file.document, file.fileName);
    } else {
      res.status(404).json({message: `No meeting found for id ${id}`});
    }
  } catch (error) {
    errorDebugLog("meetingInviteCalendar failed for", id, "error:", error);
    res.status(500).json({message: "Calendar generation failed"});
  }
}

export async function eventsCalendarFeed(req: Request, res: Response): Promise<void> {
  try {
    const config: SystemConfig = await systemConfig();
    const baseUrl = publicImageBaseUrl(req, config);
    const events = await extendedGroupEvent
      .find({
        [GroupEventField.START_DATE]: {
          $gte: dateTimeNow().startOf("day").toISO(),
          $lte: dateTimeNow().plus({months: FEED_MONTHS_AHEAD}).toISO()
        }
      })
      .select(CALENDAR_EVENT_SELECT)
      .sort({[GroupEventField.START_DATE]: 1})
      .limit(MAXIMUM_FEED_EVENTS)
      .lean().exec() as ExtendedGroupEvent[];
    debugLog("calendar feed returning", events.length, "events");
    if (events.length === MAXIMUM_FEED_EVENTS) {
      debugLog("calendar feed truncated at", MAXIMUM_FEED_EVENTS, "events");
    }
    sendCalendar(res, icalDocument(events, config, baseUrl, calendarNameFor(config)), "walks-and-events.ics");
  } catch (error) {
    errorDebugLog("eventsCalendarFeed failed, error:", error);
    res.status(500).json({message: "Calendar generation failed"});
  }
}
