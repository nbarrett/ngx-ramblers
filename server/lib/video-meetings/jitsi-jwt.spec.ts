import expect from "expect";
import { describe, it } from "mocha";
import jwt from "jsonwebtoken";
import { issueMeetingToken } from "./jitsi-jwt";

const APP_ID = "ngx-app";
const APP_SECRET = "test-secret";

function decode(token: string): any {
  return jwt.verify(token, APP_SECRET) as any;
}

describe("issueMeetingToken", () => {

  it("issues a JWT signed with the app secret, carrying the app id as audience and issuer", () => {
    const token = issueMeetingToken({
      appId: APP_ID, appSecret: APP_SECRET, room: "committee-2026",
      user: {id: "m1", name: "Nick Barrett", moderator: true}, expirySeconds: 3600
    });
    const payload = decode(token);
    expect(payload.aud).toEqual(APP_ID);
    expect(payload.iss).toEqual(APP_ID);
    expect(payload.sub).toEqual("*");
    expect(payload.room).toEqual("committee-2026");
  });

  it("carries the user identity and a boolean moderator flag in the Jitsi context", () => {
    const token = issueMeetingToken({
      appId: APP_ID, appSecret: APP_SECRET, room: "r",
      user: {id: "m1", name: "Nick Barrett", email: "nick@example.com", moderator: true}, expirySeconds: 3600
    });
    const payload = decode(token);
    expect(payload.context.user.id).toEqual("m1");
    expect(payload.context.user.name).toEqual("Nick Barrett");
    expect(payload.context.user.email).toEqual("nick@example.com");
    expect(payload.context.user.moderator).toEqual(true);
    expect(payload.context.features.transcription).toEqual("false");
    expect(payload.context.features.recording).toEqual("false");
  });

  it("marks a non-moderator guest with boolean moderator false so token moderation denies controls", () => {
    const token = issueMeetingToken({
      appId: APP_ID, appSecret: APP_SECRET, room: "r",
      user: {id: "guest-r", name: "Guest", moderator: false}, expirySeconds: 600
    });
    expect(decode(token).context.user.moderator).toEqual(false);
  });

  it("defaults the room to the wildcard when none is supplied", () => {
    const token = issueMeetingToken({
      appId: APP_ID, appSecret: APP_SECRET, room: "",
      user: {id: "m1", name: "Nick", moderator: false}, expirySeconds: 600
    });
    expect(decode(token).room).toEqual("*");
  });

  it("cannot be verified with the wrong secret", () => {
    const token = issueMeetingToken({
      appId: APP_ID, appSecret: APP_SECRET, room: "r",
      user: {id: "m1", name: "Nick", moderator: false}, expirySeconds: 600
    });
    expect(() => jwt.verify(token, "wrong-secret")).toThrow();
  });

});
