import expect from "expect";
import { describe, it } from "mocha";
import { InboxAliasConnectionStatus } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import {
  awsCredentialsFromSource,
  mailboxConnectionSandboxUpdate,
  sandboxWalksManager
} from "./full-duplicate";
import { EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  defaultFullDuplicateEnvironmentName,
  environmentSubdomainHostname,
  flySafeResourceName
} from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";

describe("full-duplicate", () => {

  describe("default names and hostnames", () => {
    it("names the sandbox staging.{source}", () => {
      expect(defaultFullDuplicateEnvironmentName("group-one")).toEqual("staging.group-one");
    });

    it("builds a platform subdomain from the environment name, including dotted names", () => {
      expect(environmentSubdomainHostname("staging.group-one")).toEqual("staging.group-one.ngx-ramblers.org.uk");
      expect(environmentSubdomainHostname("group-two")).toEqual("group-two.ngx-ramblers.org.uk");
    });

    it("strips dots from Fly, S3 and Mongo resource names", () => {
      expect(flySafeResourceName("staging.group-one")).toEqual("staging-group-one");
    });

    it("keeps a custom environment name as its own platform hostname", () => {
      expect(environmentSubdomainHostname("group-one-demo")).toEqual("group-one-demo.ngx-ramblers.org.uk");
    });
  });


  describe("mailboxConnectionSandboxUpdate", () => {
    it("disconnects mailbox connections and drops the refresh token", () => {
      const update = mailboxConnectionSandboxUpdate();
      expect(update.oauthRefreshTokenEncrypted).toEqual(null);
      expect(update.enabled).toEqual(false);
      expect(update.connectionStatus).toEqual(InboxAliasConnectionStatus.NOT_CONNECTED);
      expect(update.lastErrorMessage).toEqual(null);
    });
  });

  describe("sandboxWalksManager", () => {
    it("clears the Walks Manager password and keeps the rest", () => {
      const result = sandboxWalksManager({
        walksManager: { userName: "coord", password: "secret", href: "https://walks-manager.ramblers.org.uk/walks-manager" },
        other: true
      });
      expect(result?.other).toEqual(true);
      expect((result?.walksManager as { userName: string; password: string | null }).userName).toEqual("coord");
      expect((result?.walksManager as { password: string | null }).password).toEqual(null);
    });

    it("returns null when national config is missing", () => {
      expect(sandboxWalksManager(null)).toEqual(null);
    });
  });

  describe("awsCredentialsFromSource", () => {
    it("reuses the source bucket and keys", () => {
      const source = {
        environment: "group-one",
        aws: {
          bucket: "ngx-ramblers-group-one-eu-west-1",
          region: "eu-west-1",
          accessKeyId: "AKIATEST",
          secretAccessKey: "secret"
        }
      } as EnvironmentConfig;
      const credentials = awsCredentialsFromSource(source);
      expect(credentials.bucket).toEqual("ngx-ramblers-group-one-eu-west-1");
      expect(credentials.region).toEqual("eu-west-1");
      expect(credentials.accessKeyId).toEqual("AKIATEST");
      expect(credentials.iamUserName).toEqual("group-one-shared");
    });

    it("throws when the source has no S3 credentials", () => {
      expect(() => awsCredentialsFromSource({ environment: "empty" } as EnvironmentConfig))
        .toThrow("Source environment empty has no S3 credentials to share");
    });
  });
});
