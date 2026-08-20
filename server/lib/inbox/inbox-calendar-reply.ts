import { randomUUID } from "crypto";
import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { errorResponse } from "../shared/error-response";
import { dateTimeNow } from "../shared/dates";
import { objectBufferForKey } from "../aws/aws-controllers";
import { member as memberModel } from "../mongo/models/member";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../mongo/models/inbox-mailbox-connection";
import {
  CalendarPreviewEvent,
  CalendarRsvpStatus,
  InboxAttachment,
  InboxCalendarReplyRequest,
  InboxMailboxConnection,
  InboxMessage,
  InboxThread,
  InboxThreadFolder
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Member, MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import {
  calendarInviteCanRsvp,
  calendarReplyDocument,
  calendarRsvpSubject,
  isCalendarFile,
  parseIcsCalendar
} from "../../../projects/ngx-ramblers/src/app/functions/ics-calendar";
import { defaultTenantSlug, derivedAliasForRoleType } from "./inbox-aliases";
import { permittedToReadJunk, requireInboxRoleAccess } from "./inbox-access";
import { sendRfc822 } from "./gmail-inbox-reader";

const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace("inbox-calendar-reply"));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog("inbox-calendar-reply");

function replyStatusFrom(value: unknown): CalendarRsvpStatus | null {
  if (value === CalendarRsvpStatus.ACCEPTED) {
    return CalendarRsvpStatus.ACCEPTED;
  } else if (value === CalendarRsvpStatus.TENTATIVE) {
    return CalendarRsvpStatus.TENTATIVE;
  } else if (value === CalendarRsvpStatus.DECLINED) {
    return CalendarRsvpStatus.DECLINED;
  } else {
    return null;
  }
}

function rfcMessageId(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    return "";
  } else if (trimmed.startsWith("<")) {
    return trimmed;
  } else {
    return `<${trimmed}>`;
  }
}

function escapeHeaderName(raw: string): string {
  if (/[",<>]/.test(raw)) {
    return `"${raw.replace(/"/g, "\\\"")}"`;
  } else {
    return raw;
  }
}

function pickAttendee(
  event: CalendarPreviewEvent,
  candidates: {email: string; name: string | null}[]
): {email: string; name: string | null} {
  const attendees = event.attendees || [];
  const matched = candidates.find(candidate => {
    const email = normaliseEmail(candidate.email);
    return email && attendees.some(attendee => normaliseEmail(attendee.email) === email);
  });
  if (matched) {
    return matched;
  } else {
    return candidates.find(candidate => !!candidate.email) || {email: "", name: null};
  }
}

function replyBody(status: CalendarRsvpStatus, title: string | null, attendeeName: string | null): string {
  const who = attendeeName || "This mailbox";
  const meeting = title || "this meeting";
  if (status === CalendarRsvpStatus.ACCEPTED) {
    return `${who} has accepted the invitation to ${meeting}.`;
  } else if (status === CalendarRsvpStatus.TENTATIVE) {
    return `${who} has tentatively accepted the invitation to ${meeting}.`;
  } else {
    return `${who} has declined the invitation to ${meeting}.`;
  }
}

function buildReplyRfc822(input: {
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  toName: string | null;
  subject: string;
  body: string;
  ics: string;
  inReplyTo: string;
  references: string[];
}): string {
  const boundary = `ngx-calendar-${randomUUID()}`;
  const sentAt = dateTimeNow().toUTC().toRFC2822();
  const outboundId = `<calendar-reply-${randomUUID()}@ngx-ramblers>`;
  const fromHeader = input.fromName
    ? `From: ${escapeHeaderName(input.fromName)} <${input.fromEmail}>`
    : `From: ${input.fromEmail}`;
  const toHeader = input.toName
    ? `To: ${escapeHeaderName(input.toName)} <${input.toEmail}>`
    : `To: ${input.toEmail}`;
  const referenceLine = [input.inReplyTo, ...input.references].filter(Boolean).join(" ");
  return [
    fromHeader,
    toHeader,
    `Subject: ${input.subject}`,
    `Date: ${sentAt}`,
    `Message-ID: ${outboundId}`,
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    referenceLine ? `References: ${referenceLine}` : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    input.body,
    `--${boundary}`,
    "Content-Type: text/calendar; method=REPLY; charset=UTF-8",
    "Content-Disposition: attachment; filename=\"invite.ics\"",
    "",
    input.ics.trimEnd(),
    `--${boundary}--`,
    ""
  ].filter(line => line !== null).join("\r\n");
}

async function accessibleThread(req: Request, res: Response, threadId: string): Promise<InboxThread | null> {
  const thread = await inboxThreadModel.findOne({_id: threadId, tenantSlug: defaultTenantSlug()}).lean() as InboxThread | null;
  if (!thread) {
    res.status(404).json({request: {messageType}, error: `Thread ${threadId} not found`});
    return null;
  } else if (thread.folder === InboxThreadFolder.JUNK) {
    if (await permittedToReadJunk(req)) {
      return thread;
    } else {
      res.status(403).json({request: {messageType}, error: "You do not have access to junk mail"});
      return null;
    }
  } else {
    const accessible = await requireInboxRoleAccess(req, res, thread.roleType);
    return accessible ? thread : null;
  }
}

async function connectionForThread(thread: InboxThread, message: InboxMessage): Promise<InboxMailboxConnection | null> {
  const alias = await derivedAliasForRoleType(thread.roleType);
  const viaAlias = alias?.mailboxConnectionId
    ? await inboxMailboxConnectionModel.findOne({
      _id: alias.mailboxConnectionId,
      tenantSlug: alias.tenantSlug
    }).lean() as InboxMailboxConnection | null
    : null;
  if (viaAlias) {
    return viaAlias;
  } else if (!message.mailboxConnectionId) {
    return null;
  } else {
    return inboxMailboxConnectionModel.findOne({
      _id: message.mailboxConnectionId,
      tenantSlug: defaultTenantSlug()
    }).lean() as Promise<InboxMailboxConnection | null>;
  }
}

export async function sendCalendarReply(req: Request, res: Response): Promise<void> {
  try {
    const status = replyStatusFrom((req.body as InboxCalendarReplyRequest)?.status);
    const messageId = (req.body as InboxCalendarReplyRequest)?.messageId;
    const thread = await accessibleThread(req, res, req.params.id);
    if (thread && !status) {
      res.status(400).json({request: {messageType}, error: "Choose Accept, Tentative or Decline"});
    } else if (thread && !messageId) {
      res.status(400).json({request: {messageType}, error: "No message was specified"});
    } else if (thread) {
      const message = await inboxMessageModel.findOne({threadId: req.params.id, messageId}).lean() as InboxMessage | null;
      if (!message) {
        res.status(404).json({request: {messageType}, error: "No message found on this thread"});
      } else {
        const attachment = (message.attachments ?? []).find(item => isCalendarFile(item.filename, item.contentType) && item.s3Key) as InboxAttachment | undefined;
        if (!attachment?.s3Key) {
          res.status(404).json({request: {messageType}, error: "This message has no calendar file to reply to"});
        } else {
          const source = (await objectBufferForKey(attachment.s3Key)).toString("utf8");
          const invite = parseIcsCalendar(source);
          const event = invite.events[0] ?? null;
          if (!event || !calendarInviteCanRsvp(invite)) {
            res.status(400).json({request: {messageType}, error: "This calendar file is not a meeting invitation you can reply to"});
          } else {
            const connection = await connectionForThread(thread, message);
            if (!connection?.gmailAccountEmail) {
              res.status(404).json({request: {messageType}, error: "No Gmail mailbox is connected for this conversation"});
            } else {
              const alias = await derivedAliasForRoleType(thread.roleType);
              const memberId = (req.user as Partial<MemberCookie>).memberId;
              const loggedIn = memberId
                ? await memberModel.findById(memberId).select("email firstName lastName").lean() as Pick<Member, "email" | "firstName" | "lastName"> | null
                : null;
              const memberName = loggedIn ? [loggedIn.firstName, loggedIn.lastName].filter(Boolean).join(" ").trim() || null : null;
              const attendee = pickAttendee(event, [
                {email: alias?.roleEmail || "", name: memberName},
                {email: connection.gmailAccountEmail, name: memberName},
                {email: loggedIn?.email || "", name: memberName}
              ]);
              if (!attendee.email) {
                res.status(400).json({request: {messageType}, error: "Could not work out which mailbox should reply"});
              } else {
                const toEmail = event.organiserEmail || message.from?.email;
                if (!toEmail) {
                  res.status(400).json({request: {messageType}, error: "This invitation has no organiser to reply to"});
                } else {
                  const ics = calendarReplyDocument(event, attendee, status, dateTimeNow().toMillis());
                  const rfc822 = buildReplyRfc822({
                    fromEmail: connection.gmailAccountEmail,
                    fromName: attendee.name,
                    toEmail,
                    toName: event.organiser,
                    subject: calendarRsvpSubject(status, event.title),
                    body: replyBody(status, event.title, attendee.name),
                    ics,
                    inReplyTo: rfcMessageId(message.messageId),
                    references: (message.references ?? []).map(rfcMessageId).filter(Boolean)
                  });
                  const sentId = await sendRfc822(connection, rfc822);
                  await inboxMessageModel.updateOne(
                    {threadId: req.params.id, messageId},
                    {$set: {calendarRsvp: status}}
                  );
                  debugLog(`calendar reply ${status} sent as ${sentId} from ${connection.gmailAccountEmail} to ${toEmail} for thread ${req.params.id}`);
                  res.json({
                    request: {messageType},
                    response: {status, attendeeEmail: attendee.email}
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    errorDebugLog("calendar reply failed:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}
