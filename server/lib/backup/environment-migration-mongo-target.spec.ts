import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import * as environmentsConfig from "../environments/environments-config";
import * as atlasClusters from "../environment-setup/atlas-clusters";
import * as mongoDatabaseUser from "../environment-setup/mongo-database-user";
import { AtlasClusterState, AtlasClusterTier, AtlasClusterView } from "../../../projects/ngx-ramblers/src/app/models/atlas-cluster.model";
import { provisionMigrationMongoTarget, provisionMigrationMongoTargetRequest } from "./environment-migration-mongo-target";
import { Request, Response } from "express";

describe("migration MongoDB target provisioning", () => {
  const sandbox = sinon.createSandbox();
  const target = {name: "group-sites", host: "group-sites.abc123", stateName: AtlasClusterState.IDLE, instanceSize: AtlasClusterTier.M20, inProvisioningProject: true, canAddEnvironment: true, limitHeadline: "Room for another site"};

  beforeEach(() => {
    sandbox.stub(environmentsConfig, "configuredEnvironments").resolves({environments: [{environment: "hillside", mongo: {cluster: "source.abc123", db: "hillside-database"}}]} as never);
    sandbox.stub(atlasClusters, "atlasClusterView").resolves({atlasReachable: true, clusters: [target]} as AtlasClusterView);
    sandbox.stub(mongoDatabaseUser, "platformAtlasAccess").resolves({projectId: "project-1", publicKey: "public-key", privateKey: "private-key"});
    sandbox.stub(mongoDatabaseUser, "createEnvironmentMongoUser").resolves({username: "hillside-user", password: "fictional-password"});
  });

  afterEach(() => sandbox.restore());

  it("uses the existing environment's database and never resets an existing target user", async () => {
    const created = await provisionMigrationMongoTarget({environment: "hillside", cluster: target.host});
    expect(created).toEqual({cluster: target.host, db: "hillside-database", username: "hillside-user", password: "fictional-password"});
    const args = (mongoDatabaseUser.createEnvironmentMongoUser as sinon.SinonStub).firstCall.args;
    expect(args[0]).toEqual({projectId: "project-1", publicKey: "public-key", privateKey: "private-key"});
    expect(args[1]).toBe("hillside-database");
    expect(args[2]).toMatch(/^hillside_migration_/);
    expect(args[3]).toBe(false);
  });

  it("uses a new target identity on retries instead of resetting the live source user", async () => {
    await provisionMigrationMongoTarget({environment: "hillside", cluster: target.host});
    await provisionMigrationMongoTarget({environment: "hillside", cluster: target.host});
    const calls = (mongoDatabaseUser.createEnvironmentMongoUser as sinon.SinonStub).getCalls();
    expect(calls[0].args[2]).not.toBe(calls[1].args[2]);
    expect(calls.map(call => call.args[3])).toEqual([false, false]);
  });

  it("creates the user in the destination project", async () => {
    (atlasClusters.atlasClusterView as sinon.SinonStub).resolves({atlasReachable: true, clusters: [{...target, projectId: "destination-project"}]});
    await provisionMigrationMongoTarget({environment: "hillside", cluster: target.host});
    expect((mongoDatabaseUser.createEnvironmentMongoUser as sinon.SinonStub).firstCall.args[0].projectId).toBe("destination-project");
  });

  it("rejects the source cluster without touching Atlas", async () => {
    await expect(provisionMigrationMongoTarget({environment: "hillside", cluster: "source.abc123"})).rejects.toThrow("different from the source");
    expect((atlasClusters.atlasClusterView as sinon.SinonStub).called).toBe(false);
    expect((mongoDatabaseUser.createEnvironmentMongoUser as sinon.SinonStub).called).toBe(false);
  });

  it("rejects an unknown environment before creating any credentials", async () => {
    await expect(provisionMigrationMongoTarget({environment: "unknown", cluster: target.host})).rejects.toThrow("Select an environment");
    expect((mongoDatabaseUser.createEnvironmentMongoUser as sinon.SinonStub).called).toBe(false);
  });

  [
    {atlasReachable: false, clusters: [target]},
    {atlasReachable: true, clusters: [{...target, inProvisioningProject: false}]},
    {atlasReachable: true, clusters: [{...target, stateName: AtlasClusterState.CREATING}]},
    {atlasReachable: true, clusters: [{...target, canAddEnvironment: false}]}
  ].forEach(view => {
    it("rejects an unreachable, external, busy or full target without creating credentials", async () => {
      (atlasClusters.atlasClusterView as sinon.SinonStub).resolves(view);
      await expect(provisionMigrationMongoTarget({environment: "hillside", cluster: target.host})).rejects.toThrow();
      expect((mongoDatabaseUser.createEnvironmentMongoUser as sinon.SinonStub).called).toBe(false);
    });
  });

  it("prevents the credential response from being cached", async () => {
    const response = {setHeader: sandbox.stub(), status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await provisionMigrationMongoTargetRequest({body: {environment: "hillside", cluster: target.host}} as Request, response as unknown as Response);
    expect(response.setHeader.calledWith("Cache-Control", "no-store")).toBe(true);
    expect(response.status.calledWith(201)).toBe(true);
    expect(response.json.firstCall.args[0].db).toBe("hillside-database");
  });
});
