import expect from "expect";
import { describe, it } from "mocha";
import { redactCredentials } from "./salesforce-redaction";

describe("redactCredentials", () => {

  it("redacts an api_key query parameter in a URL", () => {
    expect(redactCredentials("https://example.test/get_supporters?api_key=super-secret&team_code=KT51"))
      .toBe("https://example.test/get_supporters?api_key=REDACTED&team_code=KT51");
  });

  it("redacts api_key regardless of parameter order", () => {
    expect(redactCredentials("https://example.test/get_supporters?team_code=KT51&api_key=super-secret"))
      .toBe("https://example.test/get_supporters?team_code=KT51&api_key=REDACTED");
  });

  it("redacts api_key when it is the only parameter", () => {
    expect(redactCredentials("connect ECONNREFUSED /unsubscribe?api_key=super-secret"))
      .toBe("connect ECONNREFUSED /unsubscribe?api_key=REDACTED");
  });

  it("leaves the non-secret team_code untouched", () => {
    expect(redactCredentials("Request failed for team_code=KT51"))
      .toBe("Request failed for team_code=KT51");
  });

  it("returns messages without credentials unchanged", () => {
    expect(redactCredentials("Request failed with status code 401")).toBe("Request failed with status code 401");
  });
});
