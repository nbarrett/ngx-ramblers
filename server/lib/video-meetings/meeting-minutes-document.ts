import debugLib from "debug";
import { envConfig } from "../env-config/env-config";
import committeeFileModel from "../mongo/models/committee-file";
import { meetingTranscriptLine } from "../mongo/models/meeting-transcript";
import { transcriptTimeSpan } from "../../../projects/ngx-ramblers/src/app/functions/meeting-transcript";
import { MEETING_MINUTES_TEMPLATE_ID, MeetingTranscriptLine } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import { meetingMinutesDocumentSlug } from "../../../projects/ngx-ramblers/src/app/functions/committee-documents-page";
import { systemConfig } from "../config/system-config";
import { queryKey } from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  CommitteeConfig,
  CommitteeFile,
  CommitteeMeetingFormat,
  committeeMeetingTypesFromFileTypes
} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import {
  committeeMeetingHeading,
  committeeMeetingLocationLine,
  committeeMeetingMinutesMarkdown
} from "../../../projects/ngx-ramblers/src/app/functions/committee-meeting-agenda";
import { meetingMinutesDateLabel } from "../../../projects/ngx-ramblers/src/app/functions/video-meeting-minutes";
import { dateTimeFromMillis, dateTimeNowAsValue, formatDateTime } from "../shared/dates";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { AdminPath } from "../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { sendMeetingMinutesReadyEmail } from "../brevo/transactional-mail/send-meeting-minutes-ready-email";
import { stripTrailingSlash } from "../../../projects/ngx-ramblers/src/app/functions/strings";

const debug = debugLib(envConfig.logNamespace("video-meetings:minutes-document"));
debug.enabled = true;

const DEFAULT_MINUTES_FILE_TYPE = "Meeting minutes";

function titleFromRoom(room: string): string {
  return (room || "").replace(/-\d{3,}$/, "").replace(/-/g, " ").replace(/\b\w/g, character => character.toUpperCase()).trim();
}

async function minutesFileContext(sourceFile: CommitteeFile | null): Promise<{fileType: string; heading: string}> {
  const committeeConfig = (await queryKey(ConfigKey.COMMITTEE))?.value as CommitteeConfig;
  const meetingTypes = committeeMeetingTypesFromFileTypes(committeeConfig?.fileTypes || []);
  const agendaType = sourceFile?.fileType;
  const matched = meetingTypes.find(type => type.agendaFileType === agendaType || type.minutesFileType === agendaType);
  return {
    fileType: matched?.minutesFileType || DEFAULT_MINUTES_FILE_TYPE,
    heading: committeeMeetingHeading(sourceFile?.meeting?.title || sourceFile?.document?.title || "", matched?.description)
  };
}

async function siteBase(): Promise<string> {
  const system = await systemConfig();
  return stripTrailingSlash(system?.group?.href || envConfig.value(Environment.BASE_URL));
}

function minutesDocumentSlug(committeeFile: CommitteeFile): string {
  return meetingMinutesDocumentSlug(committeeFile.meeting?.room || "");
}

async function minutesLink(committeeFile: CommitteeFile): Promise<string> {
  const base = await siteBase();
  const room = committeeFile.meeting?.room;
  return base && room ? `${base}/${AdminPath.MEETING_MINUTES}/${encodeURIComponent(room)}` : "";
}

export async function notifyOrganiserByEmail(committeeFile: CommitteeFile, link: string, recorderMemberId?: string): Promise<boolean> {
  return sendMeetingMinutesReadyEmail({committeeFile, link, recorderMemberId});
}

export async function minutesDraftStillPending(room: string): Promise<boolean> {
  const target = await committeeFileModel.findOne({
    "meeting.room": room,
    "document.templateId": MEETING_MINUTES_TEMPLATE_ID
  }).lean().exec() as unknown as CommitteeFile;
  return target?.meeting?.minutesSummaryPending !== false;
}

export async function publishMeetingMinutes(room: string, markdown: string, notify: boolean, summaryPending = false, recorderMemberId?: string): Promise<{ link: string; emailed: boolean; path: string | null; slug: string } | null> {
  if (!room || !markdown?.trim()) {
    return null;
  } else {
    const plannedFile = await committeeFileModel.findOne({
      "meeting.room": room,
      "document.templateId": {$ne: MEETING_MINUTES_TEMPLATE_ID}
    }).sort({createdDate: 1}).lean().exec() as unknown as CommitteeFile;
    const meetingTitle = plannedFile?.meeting?.title || plannedFile?.document?.title || titleFromRoom(room);
    const eventDate = plannedFile?.eventDate || dateTimeNowAsValue();
    const storedLines = await meetingTranscriptLine.find({room}).sort({at: 1}).lean().exec() as unknown as MeetingTranscriptLine[];
    const span = transcriptTimeSpan(storedLines);
    const startedAt = span.startedAt || eventDate;
    const endedAt = span.endedAt || dateTimeNowAsValue();
    const documentTitle = `Minutes - ${meetingTitle}`;
    const fileContext = await minutesFileContext(plannedFile);
    const fileType = fileContext.fileType;
    const dateLine = meetingMinutesDateLabel(
      startedAt,
      endedAt,
      value => formatDateTime(dateTimeFromMillis(value), UIDateFormat.DISPLAY_DATE_NO_COMMA),
      value => formatDateTime(dateTimeFromMillis(value), UIDateFormat.DISPLAY_TIME)
    );
    const headedMarkdown = committeeMeetingMinutesMarkdown({
      heading: fileContext.heading || committeeMeetingHeading(meetingTitle, null),
      dateLine,
      location: committeeMeetingLocationLine(plannedFile?.meeting?.format || CommitteeMeetingFormat.ONLINE, plannedFile?.meeting?.location || ""),
      bodyMarkdown: markdown
    });
    const document = {title: documentTitle, markdown: headedMarkdown, templateId: MEETING_MINUTES_TEMPLATE_ID};
    const target = await committeeFileModel.findOne({"meeting.room": room, "document.templateId": MEETING_MINUTES_TEMPLATE_ID}).exec();
    if (target) {
      target.document = document;
      target.fileType = fileType;
      target.eventDate = eventDate;
      target.set("meeting.startedAt", startedAt);
      target.set("meeting.endedAt", endedAt);
      target.set("meeting.minutesSummaryPending", summaryPending);
      await target.save();
    }
    const saved = target || await committeeFileModel.create({
      createdDate: dateTimeNowAsValue(),
      eventDate,
      fileType,
      document,
      meeting: {
        format: plannedFile?.meeting?.format || CommitteeMeetingFormat.ONLINE,
        room,
        title: meetingTitle,
        location: plannedFile?.meeting?.location,
        createdBy: plannedFile?.meeting?.createdBy,
        createdByName: plannedFile?.meeting?.createdByName,
        startedAt,
        endedAt,
        minutesSummaryPending: summaryPending
      }
    });
    const savedFile = saved.toObject() as unknown as CommitteeFile;
    savedFile.id = saved.id;
    const slug = minutesDocumentSlug(savedFile);
    const link = await minutesLink(savedFile);
    const emailed = notify && !saved.meeting?.minutesEmailedAt
      ? await notifyOrganiserByEmail(savedFile, link, recorderMemberId)
      : false;
    if (emailed) {
      saved.set("meeting.minutesEmailedAt", dateTimeNowAsValue());
      await saved.save();
    }
    debug("published meeting minutes", {room, committeeFileId: saved.id, notify, emailed, link});
    return {link, emailed, path: saved.meeting?.committeePagePath || null, slug};
  }
}
