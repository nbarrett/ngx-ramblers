import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { systemConfig } from "../config/system-config";
import { configuredEnvironments } from "../environments/environments-config";
import { JitsiConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
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
  const global: JitsiConfig = (await configuredEnvironments())?.jitsi;
  const perSite: VideoMeetingsConfig = (await systemConfig())?.videoMeetings;
  const envHost = envConfig.value(Environment.JITSI_HOST_URL);
  const host = (envHost || global?.hostUrl || DEFAULT_PUBLIC_HOST).replace(/\/$/, "");
  const {appId, appSecret} = jitsiJwtCredentials();
  const publicHost = isPublicJitsiHost(host);
  const jwtRequired = !!(appId && appSecret) && !publicHost;
  return {
    enabled: global?.enabled ?? false,
    host,
    jwtRequired,
    publicHost,
    roomPrefix: global?.roomPrefix || "ngx",
    brandName: perSite?.brandName || "Ramblers Video Meetings",
    startWithAudioMuted: global?.startWithAudioMuted ?? false,
    startWithVideoMuted: global?.startWithVideoMuted ?? false,
    enableNotes: global?.enableNotes ?? true,
    enableLobby: global?.enableLobby ?? false
  };
}

export function jitsiJwtCredentials(): { appId: string; appSecret: string } {
  return {
    appId: envConfig.value(Environment.JITSI_JWT_APP_ID),
    appSecret: envConfig.value(Environment.JITSI_JWT_APP_SECRET)
  };
}
