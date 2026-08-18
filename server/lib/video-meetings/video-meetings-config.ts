import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { systemConfig } from "../config/system-config";
import { VideoMeetingRuntimeConfig, VideoMeetingsConfig } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

const DEFAULT_PUBLIC_HOST = "https://meet.jit.si";

export function isPublicJitsiHost(host: string): boolean {
  try {
    const hostname = new URL(host).hostname.toLowerCase();
    return hostname === "meet.jit.si" || hostname.endsWith(".meet.jit.si") || hostname === "8x8.vc" || hostname.endsWith(".8x8.vc");
  } catch {
    return false;
  }
}

export async function resolveVideoMeetingRuntime(): Promise<VideoMeetingRuntimeConfig> {
  const config: VideoMeetingsConfig = (await systemConfig())?.videoMeetings;
  const envHost = envConfig.value(Environment.JITSI_HOST_URL);
  const host = (envHost || config?.hostUrl || DEFAULT_PUBLIC_HOST).replace(/\/$/, "");
  const {appId, appSecret} = jitsiJwtCredentials();
  const publicHost = isPublicJitsiHost(host);
  const jwtRequired = !!(appId && appSecret) && !publicHost;
  return {
    enabled: config?.enabled ?? true,
    host,
    jwtRequired,
    publicHost,
    roomPrefix: config?.roomPrefix || "ngx",
    brandName: config?.brandName || "Ramblers Video Meetings",
    startWithAudioMuted: config?.startWithAudioMuted ?? false,
    startWithVideoMuted: config?.startWithVideoMuted ?? false,
    enableNotes: config?.enableNotes ?? true,
    enableLobby: config?.enableLobby ?? false
  };
}

export function jitsiJwtCredentials(): { appId: string; appSecret: string } {
  return {
    appId: envConfig.value(Environment.JITSI_JWT_APP_ID),
    appSecret: envConfig.value(Environment.JITSI_JWT_APP_SECRET)
  };
}
