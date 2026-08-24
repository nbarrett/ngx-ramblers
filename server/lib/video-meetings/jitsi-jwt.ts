import jwt from "jsonwebtoken";
import { IssueMeetingTokenOptions } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

export function issueMeetingToken(options: IssueMeetingTokenOptions): string {
  const {appId, appSecret, room, user, expirySeconds} = options;
  const payload = {
    aud: appId,
    iss: appId,
    sub: "*",
    room: room || "*",
    context: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email || undefined,
        avatar: user.avatar || undefined,
        moderator: !!user.moderator
      },
      features: {
        livestreaming: "false",
        recording: "false",
        transcription: "false",
        "outbound-call": "false"
      }
    }
  };
  return jwt.sign(payload, appSecret, {algorithm: "HS256", expiresIn: expirySeconds});
}
