import expect from "expect";
import sinon from "sinon";
import * as databaseInitialiser from "./database-initialiser";
import { describe, it } from "mocha";
import { InboxAliasConnectionStatus } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import {
  awsCredentialsFromSource,
  cloneSourceDatabase,
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

  it("copies populated collections with their indexes and leaves empty collections absent", async () => {
    const sandbox = sinon.createSandbox();
    const createCollection = sandbox.stub().resolves();
    const createIndex = sandbox.stub().resolves();
    const insertMany = sandbox.stub().resolves();
    const source = {
      client: {close: sandbox.stub().resolves()},
      db: {
        listCollections: () => ({toArray: async () => [{name: "populated", type: "collection"}, {name: "unused", type: "collection"}]}),
        collection: (name: string) => ({
          find: () => ({toArray: async () => name === "populated" ? [{name: "Fictional"}] : []}),
          indexes: async () => [{name: "name_1", key: {name: 1}, unique: true, v: 2}]
        })
      }
    };
    const target = {
      client: {close: sandbox.stub().resolves()},
      db: {listCollections: () => ({toArray: async () => []}), createCollection, collection: () => ({createIndex, insertMany})}
    };
    const connect = sandbox.stub(databaseInitialiser, "connectToDatabase");
    connect.onFirstCall().resolves(source as never);
    connect.onSecondCall().resolves(target as never);
    try {
      const result = await cloneSourceDatabase({uri: "mongodb://source.example.org", database: "source"}, {uri: "mongodb://target.example.org", database: "target"});
      expect(result).toEqual({collections: 1, documents: 1});
      expect(createCollection.args).toEqual([["populated"]]);
      expect(createIndex.firstCall.args).toEqual([{name: 1}, {name: "name_1", unique: true}]);
      expect(createIndex.calledBefore(insertMany)).toBe(true);
      expect(source.client.close.calledOnce).toBe(true);
      expect(target.client.close.calledOnce).toBe(true);
    } finally {
      sandbox.restore();
    }
  });

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
