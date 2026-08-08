import expect from "expect";
import { describe, it } from "mocha";
import {
  disallowedSiteFlySecrets,
  filterSecretsForSiteFlyDeploy,
  isAllowedSiteFlySecret
} from "./fly-secrets-policy";

describe("fly-secrets-policy", () => {
  it("allows core runtime secrets", () => {
    expect(isAllowedSiteFlySecret("MONGODB_URI")).toEqual(true);
    expect(isAllowedSiteFlySecret("AUTH_SECRET")).toEqual(true);
    expect(isAllowedSiteFlySecret("AWS_BUCKET")).toEqual(true);
    expect(isAllowedSiteFlySecret("INTEGRATION_WORKER_URL")).toEqual(true);
    expect(isAllowedSiteFlySecret("AI_API_KEY")).toEqual(true);
  });

  it("rejects legacy application config env vars", () => {
    expect(isAllowedSiteFlySecret("GOOGLE_MAPS_APIKEY")).toEqual(false);
    expect(isAllowedSiteFlySecret("OS_MAPS_API_KEY")).toEqual(false);
    expect(isAllowedSiteFlySecret("RECAPTCHA_SITE_KEY")).toEqual(false);
    expect(isAllowedSiteFlySecret("BREVO_API_KEY")).toEqual(false);
    expect(isAllowedSiteFlySecret("MEETUP_ACCESS_TOKEN")).toEqual(false);
    expect(isAllowedSiteFlySecret("RAMBLERS_API_KEY")).toEqual(false);
    expect(isAllowedSiteFlySecret("RAMBLERS_UPLOAD_WORKER_URL")).toEqual(false);
    expect(isAllowedSiteFlySecret("DOCKER_PASSWORD")).toEqual(false);
  });

  it("filters deploy payload to the allowlist", () => {
    const filtered = filterSecretsForSiteFlyDeploy({
      MONGODB_URI: "mongodb+srv://example",
      AUTH_SECRET: "secret",
      GOOGLE_MAPS_APIKEY: "legacy",
      RECAPTCHA_SECRET_KEY: "legacy",
      EMPTY: ""
    });
    expect(filtered).toEqual({
      MONGODB_URI: "mongodb+srv://example",
      AUTH_SECRET: "secret"
    });
  });

  it("lists disallowed names from a live secrets inventory", () => {
    expect(disallowedSiteFlySecrets([
      "MONGODB_URI",
      "GOOGLE_MAPS_APIKEY",
      "RAMBLERS_UPLOAD_WORKER_URL",
      "AUTH_SECRET"
    ])).toEqual([
      "GOOGLE_MAPS_APIKEY",
      "RAMBLERS_UPLOAD_WORKER_URL"
    ]);
  });
});
