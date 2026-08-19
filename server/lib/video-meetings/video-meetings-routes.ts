import express, { Request, Response } from "express";
import * as authConfig from "../auth/auth-config";
import { jitsiJwtCredentials, resolveVideoMeetingRuntime } from "./video-meetings-config";
import { mintMeetingToken } from "./jitsi-jwt";
import { sendGuestInviteEmail } from "./send-guest-invite-email";
import { writeMeetingMinutes } from "./write-meeting-minutes";
import { videoMeeting } from "../mongo/models/video-meeting";
import { systemConfig } from "../config/system-config";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";

const MEETING_TOKEN_EXPIRY_SECONDS = 60 * 60 * 4;
const GUEST_TOKEN_EXPIRY_SECONDS = 60 * 60 * 12;

function isModerator(member: MemberCookie): boolean {
  return !!(member?.committee || member?.memberAdmin || member?.contentAdmin || member?.walkAdmin ||
    member?.socialAdmin || member?.financeAdmin || member?.treasuryAdmin || member?.fileAdmin || member?.volunteerAdmin);
}

function memberName(member: MemberCookie): string {
  return [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName || "Member";
}

function mintGuestToken(room: string, name: string): string {
  const {appId, appSecret} = jitsiJwtCredentials();
  return mintMeetingToken({
    appId,
    appSecret,
    room,
    user: {id: `guest-${room}`, name: name || "Guest", moderator: false},
    expirySeconds: GUEST_TOKEN_EXPIRY_SECONDS
  });
}

async function buildGuestLink(room: string, token: string | null): Promise<string> {
  const system = await systemConfig();
  const base = (system?.group?.href || envConfig.value(Environment.BASE_URL) || "").replace(/\/+$/, "");
  const tokenQuery = token ? `?t=${encodeURIComponent(token)}` : "";
  return `${base}/video-meetings/guest/${encodeURIComponent(room)}${tokenQuery}`;
}

function guestInviteHtml(link: string, inviterName: string, brandName: string): string {
  return `<p>${inviterName} has invited you to a ${brandName} video meeting.</p>`
    + `<p><a href="${link}">Join the meeting</a></p>`
    + `<p>Or paste this link into your browser:<br>${link}</p>`
    + `<p>No account is needed — click the link, allow your camera and microphone, and you are in.</p>`;
}

const router = express.Router();

router.get("/config", authConfig.optionalAuthenticate(), async (_req: Request, res: Response) => {
  try {
    const runtime = await resolveVideoMeetingRuntime();
    res.status(200).json(runtime);
  } catch (error) {
    res.status(500).json({message: "Failed to resolve video meeting config", error: String(error)});
  }
});

router.post("/token", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const room: string = (req.body?.room || "").trim();
    if (!room) {
      res.status(400).json({message: "room is required"});
    } else {
      const runtime = await resolveVideoMeetingRuntime();
      const member = req.user as MemberCookie;
      const moderator = isModerator(member);
      if (runtime.jwtRequired) {
        const {appId, appSecret} = jitsiJwtCredentials();
        const token = mintMeetingToken({
          appId,
          appSecret,
          room,
          user: {
            id: member?.memberId || member?.userName || "member",
            name: memberName(member),
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
});

router.post("/invite", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const room: string = (req.body?.room || "").trim();
    const email: string = (req.body?.email || "").trim();
    const name: string = (req.body?.name || "").trim();
    if (!room || !email) {
      res.status(400).json({message: "room and email are required"});
    } else {
      const runtime = await resolveVideoMeetingRuntime();
      const token = runtime.jwtRequired ? mintGuestToken(room, name) : null;
      const link = await buildGuestLink(room, token);
      const inviter = memberName(req.user as MemberCookie);
      const html = guestInviteHtml(link, inviter, runtime.brandName);
      const sent = await sendGuestInviteEmail(email, name, `You are invited to a ${runtime.brandName} video meeting`, html);
      res.status(200).json({sent, link, room});
    }
  } catch (error) {
    res.status(500).json({message: "Failed to send guest invite", error: String(error)});
  }
});

router.post("/minutes", authConfig.authenticate(), writeMeetingMinutes);

router.post("/guest-token", async (req: Request, res: Response) => {
  try {
    const room: string = (req.body?.room || "").trim();
    if (!room) {
      res.status(400).json({message: "room is required"});
    } else {
      const runtime = await resolveVideoMeetingRuntime();
      if (!runtime.jwtRequired) {
        res.status(200).json({token: null, host: runtime.host, room});
      } else {
        const planned = await videoMeeting.findOne({room}).lean().exec();
        if (planned) {
          res.status(200).json({token: mintGuestToken(room, "Guest"), host: runtime.host, room});
        } else {
          res.status(200).json({token: null, host: runtime.host, room});
        }
      }
    }
  } catch (error) {
    res.status(500).json({message: "Failed to issue guest token", error: String(error)});
  }
});

export const videoMeetingsRoutes = router;
