import { describe, expect, it } from "vitest";
import { isOurSessionUnauthorised } from "./session-unauthorised";

function errorOf(body: unknown): {error?: unknown} {
  return {error: body};
}

describe("isOurSessionUnauthorised", () => {

  it("treats a missing body as a session expiry", () => {
    expect(isOurSessionUnauthorised(errorOf(null))).toBe(true);
  });

  it("treats a passport Unauthorized body as a session expiry", () => {
    expect(isOurSessionUnauthorised(errorOf("Unauthorized"))).toBe(true);
  });

  it("treats our config token-expired body as a session expiry", () => {
    expect(isOurSessionUnauthorised(errorOf({
      message: "Token expired or invalid",
      error: "Unauthorized"
    }))).toBe(true);
  });

  it("does not treat a wrapped Brevo 401 as a session expiry", () => {
    expect(isOurSessionUnauthorised(errorOf({
      request: {messageType: "brevo:account"},
      error: {message: "Your IP address is not allowed"}
    }))).toBe(false);
  });

  it("does not treat an unknown third-party 401 body as a session expiry", () => {
    expect(isOurSessionUnauthorised(errorOf({
      message: "Key not found",
      code: "unauthorized"
    }))).toBe(false);
  });
});
