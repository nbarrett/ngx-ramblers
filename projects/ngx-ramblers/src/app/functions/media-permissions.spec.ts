import { MediaPermissionOutcome, mediaPermissionsDenied, requestMediaPermissions } from "./media-permissions";

function fakeWindow(getUserMedia: ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null): Window {
  const mediaDevices = getUserMedia ? {getUserMedia} : {};
  return {navigator: {mediaDevices}} as unknown as Window;
}

function stream(): MediaStream {
  return {getTracks: () => [{stop: () => undefined}]} as unknown as MediaStream;
}

function rejection(name: string): Promise<MediaStream> {
  const error = new Error(name);
  error.name = name;
  return Promise.reject(error);
}

describe("requestMediaPermissions", () => {
  it("reports both granted when the browser allows camera and microphone", async () => {
    const permissions = await requestMediaPermissions(fakeWindow(() => Promise.resolve(stream())));
    expect(permissions).toEqual({audio: MediaPermissionOutcome.GRANTED, video: MediaPermissionOutcome.GRANTED});
    expect(mediaPermissionsDenied(permissions)).toBe(false);
  });

  it("falls back to audio only when there is no camera", async () => {
    const permissions = await requestMediaPermissions(fakeWindow(constraints => constraints.video ? rejection("NotFoundError") : Promise.resolve(stream())));
    expect(permissions).toEqual({audio: MediaPermissionOutcome.GRANTED, video: MediaPermissionOutcome.UNAVAILABLE});
    expect(mediaPermissionsDenied(permissions)).toBe(false);
  });

  it("reports a refusal so the room can explain how to allow access", async () => {
    const permissions = await requestMediaPermissions(fakeWindow(() => rejection("NotAllowedError")));
    expect(permissions).toEqual({audio: MediaPermissionOutcome.DENIED, video: MediaPermissionOutcome.DENIED});
    expect(mediaPermissionsDenied(permissions)).toBe(true);
  });

  it("reports unsupported when the browser has no media devices API", async () => {
    const permissions = await requestMediaPermissions(fakeWindow(null));
    expect(permissions.audio).toBe(MediaPermissionOutcome.UNSUPPORTED);
    expect(mediaPermissionsDenied(permissions)).toBe(false);
  });
});
