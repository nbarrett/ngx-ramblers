import expect from "expect";
import { describe, it } from "mocha";
import { EnvironmentConfig, EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { flySecretsForEnvironment } from "./secrets";

describe("flySecretsForEnvironment", () => {
  const env: EnvironmentConfig = {
    environment: "hampshire",
    aws: {bucket: "b", region: "eu-west-2", accessKeyId: "ak", secretAccessKey: "sk"},
    mongo: {cluster: "c.mongodb.net", db: "hampshire", username: "u", password: "p"},
    flyio: {appName: "ngx-ramblers-hampshire", apiKey: "", memory: "1gb", scaleCount: 1, organisation: "personal"},
    secrets: {AUTH_SECRET: "auth"}
  };

  it("includes CLOUDFLARE_CONFIG from the platform Cloudflare config", () => {
    const globalConfig: EnvironmentsConfig = {
      environments: [env],
      secrets: {ENVIRONMENT_SETUP_API_KEY: "platform-setup-key-32-chars-ok!!"},
      cloudflare: {
        accountId: "account",
        apiToken: "token",
        zoneId: "zone",
        baseDomain: "ngx-ramblers.org.uk"
      }
    };
    const secrets = flySecretsForEnvironment(env, globalConfig);
    expect(secrets.CLOUDFLARE_CONFIG).toBeTruthy();
    expect(secrets.AUTH_SECRET).toEqual("auth");
  });

  it("fails the deploy when platform Cloudflare exists but cannot be encrypted", () => {
    const globalConfig: EnvironmentsConfig = {
      environments: [env],
      cloudflare: {
        accountId: "account",
        apiToken: "token",
        zoneId: "zone",
        baseDomain: "ngx-ramblers.org.uk"
      }
    };
    expect(() => flySecretsForEnvironment(env, globalConfig)).toThrow(/CLOUDFLARE_CONFIG was not produced/);
  });
});
