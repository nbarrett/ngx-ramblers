export enum MediaPermissionOutcome {
  GRANTED = "granted",
  DENIED = "denied",
  UNAVAILABLE = "unavailable",
  UNSUPPORTED = "unsupported"
}

export interface MediaPermissions {
  audio: MediaPermissionOutcome;
  video: MediaPermissionOutcome;
}

const DENIED_ERRORS = ["NotAllowedError", "PermissionDeniedError", "SecurityError"];

function outcomeFromError(error: unknown): MediaPermissionOutcome {
  const name = (error as { name?: string })?.name || "";
  return DENIED_ERRORS.includes(name) ? MediaPermissionOutcome.DENIED : MediaPermissionOutcome.UNAVAILABLE;
}

function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}

async function request(win: Window, constraints: MediaStreamConstraints): Promise<MediaPermissionOutcome> {
  try {
    stopTracks(await win.navigator.mediaDevices.getUserMedia(constraints));
    return MediaPermissionOutcome.GRANTED;
  } catch (error) {
    return outcomeFromError(error);
  }
}

export async function requestMediaPermissions(win: Window): Promise<MediaPermissions> {
  if (!win.navigator?.mediaDevices?.getUserMedia) {
    return {audio: MediaPermissionOutcome.UNSUPPORTED, video: MediaPermissionOutcome.UNSUPPORTED};
  } else {
    const both = await request(win, {audio: true, video: true});
    if (both === MediaPermissionOutcome.GRANTED) {
      return {audio: both, video: both};
    } else {
      const audio = await request(win, {audio: true});
      return {audio, video: both};
    }
  }
}

export function mediaPermissionsDenied(permissions: MediaPermissions): boolean {
  return permissions.audio === MediaPermissionOutcome.DENIED || permissions.video === MediaPermissionOutcome.DENIED;
}
