import expect from "expect";
import { afterEach, beforeEach, describe, it } from "mocha";
import sinon from "sinon";
import { MongoClient } from "mongodb";
import * as pageContentActions from "./shared/page-content-actions";
import { CLOUDFLARE_WORKERS_MENU_ITEM } from "./shared/admin-menu-items";
import { AdminPlatformPath } from "../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import * as migrationWorkflow from "./shared/zone-inbox-router";
import * as system from "../../config/system-config";
import * as mongooseClient from "../mongoose-client";
import * as indexes from "../utils/collection-indexes";
import { MigrationFileStatus } from "../../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";
import { closeMigrationConnection, isMigrationSourceFile, MigrationRunner } from "./migrations-runner";

describe("isMigrationSourceFile", () => {
  it("accepts timestamped JavaScript and TypeScript migration files", () => {
    expect(isMigrationSourceFile("20260925190000-repair-inbox.js")).toBe(true);
    expect(isMigrationSourceFile("20260925190000-repair-inbox.ts")).toBe(true);
  });

  it("rejects migration tests and declarations", () => {
    expect(isMigrationSourceFile("20260925190000-repair-inbox.spec.js")).toBe(false);
    expect(isMigrationSourceFile("20260925190000-repair-inbox.spec.ts")).toBe(false);
    expect(isMigrationSourceFile("20260925190000-repair-inbox.d.ts")).toBe(false);
  });

  it("rejects files without a migration timestamp", () => {
    expect(isMigrationSourceFile("repair-inbox.js")).toBe(false);
  });
});

describe("deferred migrations", () => {
  const sandbox = sinon.createSandbox();
  const fileName = "20261021200000-scope-inbox-router-to-zone.ts";
  const insertOne = sinon.stub().resolves({});
  const changelog = {deleteOne: sinon.stub().resolves({}), insertOne};
  const db = {collection: sinon.stub().returns(changelog)};
  const client = {db: () => db, close: sinon.stub().resolves()};

  beforeEach(() => {
    insertOne.resetHistory();
    sandbox.stub(MongoClient, "connect").resolves(client as any);
    sandbox.stub(mongooseClient, "execute").callsFake(action => action());
    sandbox.stub(system, "systemConfig").resolves({} as any);
    sandbox.stub(indexes, "indexExistingCollections").resolves();
    sandbox.stub(pageContentActions, "ensureActionButton").resolves(false);
    sandbox.stub(migrationWorkflow, "migrateZoneInboxRouter").resolves({deferred: true, reason: "Cloudflare unavailable"});
  });

  afterEach(async () => {
    await closeMigrationConnection();
    sandbox.restore();
  });

  it("ensures the platform menu entry even when router work is skipped", async () => {
    (migrationWorkflow.migrateZoneInboxRouter as sinon.SinonStub).resolves({skipped: true, reason: "No inbox provider"});
    const runner = new MigrationRunner();
    const result = await runner.runMigration(fileName);
    expect(result.success).toBe(true);
    expect((pageContentActions.ensureActionButton as sinon.SinonStub).calledOnceWith(
      db, `${AdminPlatformPath.ROOT}#action-buttons`, CLOUDFLARE_WORKERS_MENU_ITEM
    )).toBe(true);
    expect(insertOne.calledOnce).toBe(true);
  });

  it("does not record a deferred startup migration as applied or skipped", async () => {
    const runner = new MigrationRunner();
    sandbox.stub(runner, "migrationStatus").resolves({failed: false, files: [{fileName, status: MigrationFileStatus.PENDING}]});
    expect(await runner.runPendingMigrations()).toEqual({success: true, appliedFiles: []});
    expect(insertOne.called).toBe(false);
  });

  it("does not record a deferred manual retry as applied or skipped", async () => {
    const runner = new MigrationRunner();
    const result = await runner.runMigration(fileName);
    expect(result.success).toBe(true);
    expect(result.appliedFiles).toEqual([]);
    expect(result.message).toBe("Cloudflare unavailable");
    expect(insertOne.called).toBe(false);
  });

  it("records completion after the deferred work succeeds on a later attempt", async () => {
    const runner = new MigrationRunner();
    await runner.runMigration(fileName);
    (migrationWorkflow.migrateZoneInboxRouter as sinon.SinonStub).resolves({});
    expect((await runner.runMigration(fileName)).appliedFiles).toHaveLength(1);
    expect(insertOne.calledOnce).toBe(true);
    expect(insertOne.firstCall.args[0]).not.toHaveProperty("skippedReason");
    expect(insertOne.firstCall.args[0]).not.toHaveProperty("error");
  });
});
