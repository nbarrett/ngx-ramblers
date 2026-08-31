import debugLib from "debug";
import { randomUUID } from "crypto";
import { envConfig } from "../env-config/env-config";
import committeeFileModel from "../mongo/models/committee-file";
import { meetingTranscriptLine } from "../mongo/models/meeting-transcript";
import { transcriptTimeSpan } from "../../../projects/ngx-ramblers/src/app/functions/meeting-transcript";
import { MEETING_MINUTES_TEMPLATE_ID, MeetingTranscriptLine } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import { InboxMessage, InboxMessageDirection, InboxReaderProvider } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { meetingMinutesDocumentSlug } from "../../../projects/ngx-ramblers/src/app/functions/committee-documents-page";
import { member as memberModel } from "../mongo/models/member";
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
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { AdminPath } from "../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { senderForMemberId } from "./video-meetings-controllers";
import { renderMarkdownToHtml } from "../shared/markdown-renderer";
import { ensureCloudflareIngressConnection } from "../cloudflare/cloudflare-ingress-connection";
import { cloudflareIngressAliasesForMessage, connectionIdentifier } from "../inbox/inbox-aliases";
import { storeInboundMessage } from "../inbox/inbox-message-import";
import { htmlToPlainText } from "../shared/string-utils";

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
  return (system?.group?.href || envConfig.value(Environment.BASE_URL) || "").replace(/\/+$/, "");
}

function minutesDocumentSlug(committeeFile: CommitteeFile): string {
  return meetingMinutesDocumentSlug(committeeFile.meeting?.room || "");
}

async function minutesLink(committeeFile: CommitteeFile): Promise<string> {
  const base = await siteBase();
  const room = committeeFile.meeting?.room;
  return base && room ? `${base}/${AdminPath.MEETING_MINUTES}/${encodeURIComponent(room)}` : "";
}

async function organizerMember(memberId: string): Promise<Member | null> {
  if (!memberId) {
    return null;
  } else {
    const byMemberId = await memberModel.findOne({memberId}).lean().exec() as unknown as Member;
    if (byMemberId) {
      return byMemberId;
    } else {
      return await memberModel.findById(memberId).lean().exec().catch(() => null) as unknown as Member;
    }
  }
}

async function notifyOrganizerInInbox(committeeFile: CommitteeFile, link: string): Promise<boolean> {
  const memberId = committeeFile.meeting?.createdBy;
  const organizer = await organizerMember(memberId);
  const sender = await senderForMemberId(memberId);
  const recipientEmail = sender?.email;
  if (!recipientEmail) {
    debug("not notifying organiser: organiser has no NGX address", {memberId});
    return false;
  } else {
    const recipientName = [organizer?.firstName, organizer?.lastName].filter(Boolean).join(" ") || recipientEmail;
    const title = committeeFile.document?.title || "Meeting minutes";
    const minutesHtml = renderMarkdownToHtml(committeeFile.document?.markdown || "");
    const linkHtml = link ? `<p><a href="${link}">Review the draft minutes</a></p>` : "";
    const html = `<p>A draft of the minutes for "${title}" has been written up. Here they are:</p>`
      + `<div style="border-left:4px solid #f9b104;padding:4px 16px;margin:16px 0;background:#fbfbfb">${minutesHtml}</div>`
      + linkHtml
      + `<p>Edit the draft if you need to, then save it onto the committee documents page.</p>`;
    const now = dateTimeNowAsValue();
    const connection = await ensureCloudflareIngressConnection();
    const message: InboxMessage = {
      threadId: "",
      mailboxConnectionId: connectionIdentifier(connection),
      direction: InboxMessageDirection.INBOUND,
      messageId: `<meeting-minutes-${randomUUID()}@ngx-inbox>`,
      inReplyTo: null,
      references: [],
      from: {name: "NGX Ramblers", email: recipientEmail},
      replyTo: null,
      autoReply: false,
      to: [{name: recipientName, email: recipientEmail}],
      cc: [],
      subject: `Minutes ready: ${title}`,
      bodyHtml: html,
      bodyText: htmlToPlainText(html),
      receivedAt: now,
      sentAt: null,
      externalSource: InboxReaderProvider.EMAIL_COMPOSER,
      externalId: null,
      attachments: [],
      notifiedAt: now,
      conversationKey: null
    };
    const aliases = await cloudflareIngressAliasesForMessage(message, connection);
    await Promise.all(aliases.map(alias => storeInboundMessage(alias, {...message})));
    return aliases.length > 0;
  }
}

export async function publishMeetingMinutes(room: string, markdown: string, notify: boolean): Promise<{ link: string; emailed: boolean; path: string | null; slug: string } | null> {
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
        endedAt
      }
    });
    const savedFile = saved.toObject() as unknown as CommitteeFile;
    savedFile.id = saved.id;
    const slug = minutesDocumentSlug(savedFile);
    const link = await minutesLink(savedFile);
    const emailed = notify && !saved.meeting?.minutesEmailedAt
      ? await notifyOrganizerInInbox(savedFile, link)
      : false;
    if (emailed) {
      saved.set("meeting.minutesEmailedAt", dateTimeNowAsValue());
      await saved.save();
    }
    debug("published meeting minutes", {room, committeeFileId: saved.id, notify, emailed, link});
    return {link, emailed, path: saved.meeting?.committeePagePath || null, slug};
  }
}
