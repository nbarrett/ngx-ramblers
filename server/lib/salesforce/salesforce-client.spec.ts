import expect from "expect";
import { describe, it } from "mocha";
import { SalesforceConfig } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { activeGroupCodeWithToken, buildSalesforceClient, pushSalesforceBounce, pushSalesforceConsent } from "./salesforce-client";

function configWith(apiKeysByGroupCode: Record<string, string>): SalesforceConfig {
  return {
    endpointBaseUrl: "https://example.test",
    apiKeysByGroupCode,
    enabled: true,
  };
}

describe("activeGroupCodeWithToken", () => {

  it("picks the site's active group token, not the first key in the config", () => {
    const config = configWith({ KT50: "tok-kt50", KT06: "tok-kt06", KT01: "tok-kt01", KT51: "tok-kt51" });
    expect(activeGroupCodeWithToken(config, "KT51")).toEqual({ groupCode: "KT51", token: "tok-kt51" });
  });

  it("returns null when the active group has no configured token", () => {
    const config = configWith({ KT50: "tok-kt50" });
    expect(activeGroupCodeWithToken(config, "KT51")).toBeNull();
  });

  it("returns null when no site group code is configured", () => {
    const config = configWith({ KT51: "tok-kt51" });
    expect(activeGroupCodeWithToken(config, "")).toBeNull();
  });

  it("skips a leading active group with no token and uses the next that has one", () => {
    const config = configWith({ KT06: "tok-kt06" });
    expect(activeGroupCodeWithToken(config, "KT51,KT06")).toEqual({ groupCode: "KT06", token: "tok-kt06" });
  });

  it("ignores an active group whose token is an empty string", () => {
    const config = configWith({ KT51: "" });
    expect(activeGroupCodeWithToken(config, "KT51")).toBeNull();
  });
});

describe("buildSalesforceClient", () => {
  it("trims whitespace and trailing slashes from the endpoint base URL", () => {
    const client = buildSalesforceClient("  https://example.test///  ");

    expect(client.defaults.baseURL).toBe("https://example.test");
  });
});

describe("Ramblers Team Emails request validation", () => {
  it("rejects an invalid bounce email before making a request", async () => {
    const result = await pushSalesforceBounce(configWith({ KT51: "token" }), {
      emailAddress: "invalid",
      memberRef: "member-1",
      bounceType: "Hard",
    }, "KT51");

    expect(result).toMatchObject({ status: 0, errorCode: "INVALID_REQUEST" });
  });

  it("rejects an unsubscribe without a member reference before making a request", async () => {
    const result = await pushSalesforceConsent(configWith({ KT51: "token" }), {
      emailAddress: "member@example.org",
      memberRef: "",
    }, "KT51");

    expect(result).toMatchObject({ status: 0, errorCode: "INVALID_REQUEST" });
  });
});
