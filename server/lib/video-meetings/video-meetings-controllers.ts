import { Request, Response } from "express";
import { jitsiJwtCredentials, resolveVideoMeetingRuntime } from "./video-meetings-config";
import { issueMeetingToken } from "./jitsi-jwt";
import { sendGuestInviteEmail } from "./send-guest-invite-email";
import committeeFile from "../mongo/models/committee-file";
import { systemConfig } from "../config/system-config";
import { queryKey } from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { EmailAddress } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { guestMeetingOccupantId, nameFromEmailAddress } from "../../../projects/ngx-ramblers/src/app/functions/video-meeting-join";

const MEETING_TOKEN_EXPIRY_SECONDS = 60 * 60 * 4;
const GUEST_TOKEN_EXPIRY_SECONDS = 60 * 60 * 12;

function isModerator(member: MemberCookie): boolean {
  return !!(member?.committee || member?.memberAdmin || member?.contentAdmin || member?.walkAdmin ||
    member?.socialAdmin || member?.financeAdmin || member?.treasuryAdmin || member?.fileAdmin || member?.volunteerAdmin);
}

function memberName(member: MemberCookie): string {
  const fullName = [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim();
  return fullName || nameFromEmailAddress(member?.userName || "") || (member?.userName || "").trim() || "Member";
}

export function guestDisplayName(name: string, email: string): string {
  return (name || "").trim() || nameFromEmailAddress(email) || "Guest";
}

export function memberFromRequest(req: Request): MemberCookie {
  return (req as Request & { user?: MemberCookie }).user;
}

function issueGuestToken(room: string, name: string, email = ""): string {
  const {appId, appSecret} = jitsiJwtCredentials();
  const occupantEmail = (email || "").trim();
  return issueMeetingToken({
    appId,
    appSecret,
    room,
    user: {
      id: guestMeetingOccupantId(room, occupantEmail),
      name: name || "Guest",
      email: occupantEmail || undefined,
      moderator: false
    },
    expirySeconds: GUEST_TOKEN_EXPIRY_SECONDS
  });
}

export async function senderForMemberId(memberId: string): Promise<EmailAddress | null> {
  if (!memberId) {
    return null;
  } else {
    const committeeConfigDoc = await queryKey(ConfigKey.COMMITTEE);
    const roles: CommitteeMember[] = (committeeConfigDoc?.value as CommitteeConfig)?.roles || [];
    const role = roles.find(candidate => candidate.memberId === memberId && !!candidate.email);
    return role ? {name: role.fullName, email: role.email} : null;
  }
}

async function senderForMember(member: MemberCookie): Promise<EmailAddress | null> {
  return senderForMemberId(member?.memberId);
}

async function buildGuestLink(room: string, token: string | null): Promise<string> {
  const system = await systemConfig();
  const base = (system?.group?.href || envConfig.value(Environment.BASE_URL) || "").replace(/\/+$/, "");
  const tokenQuery = token ? `?t=${encodeURIComponent(token)}` : "";
  return `${base}/video-meetings/guest/${encodeURIComponent(room)}${tokenQuery}`;
}

function guestInviteHtml(link: string, inviterName: string, brandName: string, guestInstructions: string): string {
  return `<p>${inviterName} has invited you to a ${brandName} video meeting.</p>`
    + `<p><a href="${link}">Join the meeting</a></p>`
    + `<p>Or paste this link into your browser:<br>${link}</p>`
    + `<p>${guestInstructions}</p>`;
}

export async function getVideoMeetingConfig(_req: Request, res: Response): Promise<void> {
  try {
    const runtime = await resolveVideoMeetingRuntime();
    res.status(200).json(runtime);
  } catch (error) {
    res.status(500).json({message: "Failed to resolve video meeting config", error: String(error)});
  }
}

export async function issueMemberToken(req: Request, res: Response): Promise<void> {
  try {
    const room: string = (req.body?.room || "").trim();
    if (!room) {
      res.status(400).json({message: "room is required"});
    } else {
      const runtime = await resolveVideoMeetingRuntime();
      const member = memberFromRequest(req);
      const moderator = isModerator(member);
      if (runtime.jwtRequired) {
        const {appId, appSecret} = jitsiJwtCredentials();
        const token = issueMeetingToken({
          appId,
          appSecret,
          room,
          user: {
            id: member?.memberId || member?.userName || "member",
            name: memberName(member),
            email: (member?.userName || "").trim() || undefined,
            moderator
          },
          expirySeconds: MEETING_TOKEN_EXPIRY_SECONDS
        });
        res.status(200).json({token, host: runtime.host, room, moderator});
      } else {
        res.status(200).json({token: null, host: runtime.host, room, moderator});
      }
    }
  } catch (error) {
    res.status(500).json({message: "Failed to mint meeting token", error: String(error)});
  }
}

export async function handleGuestInvite(req: Request, res: Response): Promise<void> {
  try {
    const room: string = (req.body?.room || "").trim();
    const email: string = (req.body?.email || "").trim();
    const name: string = (req.body?.name || "").trim();
    if (!room || !email) {
      res.status(400).json({message: "room and email are required"});
    } else {
      const runtime = await resolveVideoMeetingRuntime();
      const displayName = guestDisplayName(name, email);
      const token = runtime.jwtRequired ? issueGuestToken(room, displayName, email) : null;
      const link = await buildGuestLink(room, token);
      const member = memberFromRequest(req);
      const inviter = memberName(member);
      const html = guestInviteHtml(link, inviter, runtime.brandName, runtime.guestInstructions);
      const sender = await senderForMember(member);
      const sent = await sendGuestInviteEmail(sender, email, displayName, `You are invited to a ${runtime.brandName} video meeting`, html);
      res.status(200).json({sent, link, room});
    }
  } catch (error) {
    res.status(500).json({message: "Failed to send guest invite", error: String(error)});
  }
}

export async function issueGuestTokenForRoom(req: Request, res: Response): Promise<void> {
  try {
    const room: string = (req.body?.room || "").trim();
    if (!room) {
      res.status(400).json({message: "room is required"});
    } else {
      const runtime = await resolveVideoMeetingRuntime();
      if (!runtime.jwtRequired) {
        res.status(200).json({token: null, host: runtime.host, room});
      } else {
        const planned = await committeeFile.findOne({"meeting.room": room}).lean().exec();
        if (planned) {
          res.status(200).json({token: issueGuestToken(room, "Guest"), host: runtime.host, room});
        } else {
          res.status(200).json({token: null, host: runtime.host, room});
        }
      }
    }
  } catch (error) {
    res.status(500).json({message: "Failed to issue guest token", error: String(error)});
  }
}
