import expect from "expect";
import { afterEach, beforeEach, describe, it } from "mocha";
import { EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { dateTimeNow } from "../shared/dates";
import {
  containsUnencryptedSecrets,
  decryptEnvironmentsSecrets,
  ENCRYPTED_VALUE_PREFIX,
  encryptEnvironmentsSecrets
} from "./environments-secrets-cipher";

describe("environments-secrets-cipher", () => {

  const plain: EnvironmentsConfig = {
    aws: {bucket: "platform-bucket", region: "eu-west-2", accessKeyId: "AKIAPLATFORM", secretAccessKey: "platform-aws-secret"},
    cloudflare: {accountId: "cf-account", apiToken: "cf-token", zoneId: "zone", baseDomain: "ngx-ramblers.org.uk"},
    secrets: {ENVIRONMENT_SETUP_API_KEY: "setup-key", NGX_INBOUND_SECRET: "inbound"},
    uploadWorker: {appName: "worker", sharedSecret: "worker-shared", encryptionKey: "worker-enc", apiKey: "worker-api"},
    consoleAccess: {github: {login: "nick", password: "gh-password", notes: "recovery codes here", identifiers: {org: "nbarrett"}}},
    environments: [{
      environment: "staging",
      mongo: {cluster: "cluster0.mongodb.net", db: "ngx-staging", username: "staging-user", password: "mongo-password"},
      flyio: {apiKey: "fly-token", appName: "ngx-staging", organisation: "personal", previous: {apiKey: "old-fly-token", appName: "ngx-staging-old", organisation: "personal", capturedAt: 1}},
      secrets: {AUTH_SECRET: "auth-secret", PLATFORM_ADMIN_ENABLED: "true"},
      ngxLite: false
    }]
  };

  beforeEach(() => {
    process.env[Environment.ENVIRONMENTS_ENCRYPTION_KEY] = "unit-test-key";
  });

  afterEach(() => {
    delete process.env[Environment.ENVIRONMENTS_ENCRYPTION_KEY];
  });

  function encrypted(value: string): void {
    expect(value.startsWith(ENCRYPTED_VALUE_PREFIX)).toBe(true);
  }

  it("encrypts secret fields and leaves identifiers readable", () => {
    const stored = encryptEnvironmentsSecrets(plain);
    const staging = stored.environments[0];
    encrypted(stored.aws.secretAccessKey);
    encrypted(stored.cloudflare.apiToken);
    encrypted(stored.secrets.ENVIRONMENT_SETUP_API_KEY);
    encrypted(stored.secrets.NGX_INBOUND_SECRET);
    encrypted(stored.uploadWorker.sharedSecret);
    encrypted(stored.uploadWorker.encryptionKey);
    encrypted(stored.uploadWorker.apiKey);
    encrypted(stored.consoleAccess.github.password);
    encrypted(stored.consoleAccess.github.notes);
    encrypted(staging.mongo.password);
    encrypted(staging.flyio.apiKey);
    encrypted(staging.flyio.previous.apiKey);
    encrypted(staging.secrets.AUTH_SECRET);
    encrypted(staging.secrets.PLATFORM_ADMIN_ENABLED);
    expect(stored.aws.bucket).toEqual("platform-bucket");
    expect(stored.aws.accessKeyId).toEqual("AKIAPLATFORM");
    expect(stored.cloudflare.accountId).toEqual("cf-account");
    expect(stored.consoleAccess.github.login).toEqual("nick");
    expect(stored.consoleAccess.github.identifiers.org).toEqual("nbarrett");
    expect(staging.environment).toEqual("staging");
    expect(staging.mongo.cluster).toEqual("cluster0.mongodb.net");
    expect(staging.mongo.username).toEqual("staging-user");
    expect(staging.flyio.appName).toEqual("ngx-staging");
    expect(staging.flyio.previous.appName).toEqual("ngx-staging-old");
    expect(staging.ngxLite).toBe(false);
  });

  it("round-trips through encrypt and decrypt", () => {
    expect(decryptEnvironmentsSecrets(encryptEnvironmentsSecrets(plain))).toEqual(plain);
  });

  it("never wraps an already encrypted value a second time", () => {
    expect(decryptEnvironmentsSecrets(encryptEnvironmentsSecrets(encryptEnvironmentsSecrets(plain)))).toEqual(plain);
  });

  it("leaves empty secrets empty", () => {
    const stored = encryptEnvironmentsSecrets({aws: {bucket: "b", secretAccessKey: ""}});
    expect(stored.aws.secretAccessKey).toEqual("");
  });

  it("passes plaintext through unchanged when no key is configured", () => {
    delete process.env[Environment.ENVIRONMENTS_ENCRYPTION_KEY];
    expect(encryptEnvironmentsSecrets(plain)).toEqual(plain);
    expect(decryptEnvironmentsSecrets(plain)).toEqual(plain);
  });

  it("refuses to decrypt encrypted values when no key is configured", () => {
    const stored = encryptEnvironmentsSecrets(plain);
    delete process.env[Environment.ENVIRONMENTS_ENCRYPTION_KEY];
    expect(() => decryptEnvironmentsSecrets(stored)).toThrow(Environment.ENVIRONMENTS_ENCRYPTION_KEY);
  });

  it("refuses to decrypt with a different key", () => {
    const stored = encryptEnvironmentsSecrets(plain);
    process.env[Environment.ENVIRONMENTS_ENCRYPTION_KEY] = "a-different-key";
    expect(() => decryptEnvironmentsSecrets(stored)).toThrow("Could not decrypt");
  });

  it("reports whether any secret is still stored unencrypted", () => {
    expect(containsUnencryptedSecrets(plain)).toBe(true);
    expect(containsUnencryptedSecrets(encryptEnvironmentsSecrets(plain))).toBe(false);
    expect(containsUnencryptedSecrets({aws: {bucket: "b", secretAccessKey: ""}})).toBe(false);
    expect(containsUnencryptedSecrets({environments: []})).toBe(false);
  });

  it("leaves the original untouched while verifying its own round trip", () => {
    const original = {environments: [{environment: "staging", mongo: {password: "mongo-password"}}]};
    const before = JSON.stringify(original);
    const stored = encryptEnvironmentsSecrets(original);
    expect(JSON.stringify(original)).toEqual(before);
    expect(stored.environments[0].mongo.password.startsWith(ENCRYPTED_VALUE_PREFIX)).toBe(true);
  });

  it("leaves values that are not plain objects or strings alone", () => {
    const capturedAt = dateTimeNow();
    const stored = encryptEnvironmentsSecrets({environments: [{environment: "staging", flyio: {apiKey: "fly-token", previous: {apiKey: "old", capturedAt: capturedAt as unknown as number}}}]});
    expect(stored.environments[0].flyio.previous.capturedAt).toBe(capturedAt);
    encrypted(stored.environments[0].flyio.previous.apiKey);
  });

  it("tolerates a missing or empty document", () => {
    expect(decryptEnvironmentsSecrets(undefined)).toBeUndefined();
    expect(encryptEnvironmentsSecrets(null)).toBeNull();
  });
});
