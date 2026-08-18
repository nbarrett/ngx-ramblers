import { JitsiJoinMode } from "../models/video-meeting.model";

export function jitsiJoinMode(publicHost: boolean): JitsiJoinMode {
  if (publicHost) {
    return JitsiJoinMode.HOST_PAGE;
  } else {
    return JitsiJoinMode.EMBED;
  }
}

export function jitsiHostPageUrl(host: string, room: string): string {
  const trimmedHost = (host || "").replace(/\/$/, "");
  return `${trimmedHost}/${encodeURIComponent(room || "")}`;
}
