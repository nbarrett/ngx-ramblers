import expect from "expect";
import sinon from "sinon";
import { describe, afterEach, beforeEach, it } from "mocha";
import { EnvironmentMigrationService } from "./environment-migration-service";
import { environmentMigration } from "../mongo/models/environment-migration";
import * as configController from "../mongo/controllers/config";
import * as awsSetup from "../environment-setup/aws-setup";
import * as flyMachines from "../fly/fly-machines";
import {
  EnvironmentMigrationAudit,
  EnvironmentMigrationAwsSummary,
  EnvironmentMigrationMode,
  EnvironmentMigrationPhase,
  EnvironmentMigrationStatus
} from "../../../projects/ngx-ramblers/src/app/models/environment-migration.model";
import { EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { dateTimeFromIso } from "../shared/dates";

describe("environment-migration-service", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("reconcileOrphanedMigrations", () => {
    it("marks active migrations from a prior server lifetime as orphaned", async () => {
      const findStub = sandbox.stub(environmentMigration, "find").resolves([
        {
          migrationId: "environment-migration-2026-06-08-17-36-11-staging",
          environment: "staging",
          mode: EnvironmentMigrationMode.MONGO_ONLY,
          status: EnvironmentMigrationStatus.RESTORING,
          phase: EnvironmentMigrationPhase.RESTORE_TARGET,
          dryRun: false,
          startTime: dateTimeFromIso("2026-06-08T16:36:11.000Z").toJSDate(),
          sourceMongo: { cluster: "old", db: "source", username: "source", uriSummary: "source@old/source" },
          targetMongo: { cluster: "new", db: "target", username: "target", uriSummary: "target@new/target" }
        }
      ] as any);
      const updateStub = sandbox.stub(environmentMigration, "updateOne").resolves({} as any);

      const service = new EnvironmentMigrationService();
      const count = await service.reconcileOrphanedMigrations();

      expect(count).toEqual(1);
      expect(findStub.calledOnce).toEqual(true);
      expect(updateStub.calledOnce).toEqual(true);
      expect(updateStub.firstCall.args[0]).toEqual({ migrationId: "environment-migration-2026-06-08-17-36-11-staging" });
      expect(updateStub.firstCall.args[1].$set.status).toEqual(EnvironmentMigrationStatus.ORPHANED);
      expect(updateStub.firstCall.args[1].$set.error).toContain("interrupted by a prior server restart");
    });
  });

  describe("live AWS copy", () => {
    it("exposes a copy-s3 phase for destination-account cutover", () => {
      expect(EnvironmentMigrationPhase.COPY_S3).toEqual("copy-s3");
    });
  });

  describe("rotateCredentials", () => {
    const auditedAws: EnvironmentMigrationAwsSummary = { bucket: "destination-bucket", region: "eu-west-2", accessKeyId: "NEWKEY" };
    const targetMongo = { cluster: "new", db: "target", username: "target", password: "target-password" };
    const previousEnvironment: EnvironmentConfig = {
      environment: "staging",
      mongo: { cluster: "old", db: "source", username: "source", password: "source-password" },
      aws: { bucket: "old-bucket", region: "eu-west-2", accessKeyId: "OLDKEY", secretAccessKey: "old-secret" }
    };

    function readyMigration(targetAws: EnvironmentMigrationAwsSummary | null): EnvironmentMigrationAudit {
      return {
        migrationId: "environment-migration-2026-09-16-10-00-00-staging",
        environment: "staging",
        mode: EnvironmentMigrationMode.MONGO_AND_S3,
        status: EnvironmentMigrationStatus.READY_FOR_CUTOVER,
        phase: EnvironmentMigrationPhase.VERIFY_TARGET,
        dryRun: false,
        startTime: dateTimeFromIso("2026-09-16T10:00:00.000Z").toJSDate(),
        sourceMongo: { cluster: "old", db: "source", username: "source", uriSummary: "source@old/source" },
        targetMongo: { cluster: "new", db: "target", username: "target", uriSummary: "target@new/target" },
        ...(targetAws ? { targetAws } : {}),
        rollbackInfo: {
          oldMongo: { cluster: "old", db: "source", username: "source", uriSummary: "source@old/source" },
          targetMongo: { cluster: "new", db: "target", username: "target", uriSummary: "target@new/target" },
          timestamp: dateTimeFromIso("2026-09-16T10:05:00.000Z").toJSDate()
        }
      };
    }

    function stubRotation(migration: EnvironmentMigrationAudit) {
      sandbox.stub(environmentMigration, "findOne").returns({ lean: () => Promise.resolve(migration) } as any);
      const updateOne = sandbox.stub(environmentMigration, "updateOne").resolves({} as any);
      sandbox.stub(configController, "queryKey").resolves({ value: { environments: [previousEnvironment] } } as any);
      const createOrUpdateKey = sandbox.stub(configController, "createOrUpdateKey").resolves({} as any);
      const bucketExists = sandbox.stub(awsSetup, "bucketExists").resolves(true);
      sandbox.stub(flyMachines, "restartCurrentMachine").resolves({} as any);
      const service = new EnvironmentMigrationService();
      sandbox.stub(service as any, "validateMongoCredentials").resolves();
      const scopedAwsCredentials = sandbox.stub(service as any, "scopedAwsCredentials").resolves({ bucket: "old-bucket", region: "eu-west-2", accessKeyId: "SCOPEDKEY", secretAccessKey: "scoped-secret" });
      return { service, updateOne, createOrUpdateKey, bucketExists, scopedAwsCredentials };
    }

    it("refuses to rotate a live S3 migration when the pasted AWS target does not match the audited one", async () => {
      const { service, createOrUpdateKey } = stubRotation(readyMigration(auditedAws));

      await expect(service.rotateCredentials({
        migrationId: "environment-migration-2026-09-16-10-00-00-staging",
        confirmEnvironment: "staging",
        targetMongo,
        targetAws: { bucket: "destination-bucket", region: "eu-west-2", accessKeyId: "OTHERKEY", secretAccessKey: "new-secret" }
      })).rejects.toThrow(/do not match the verified migration target/);
      expect(createOrUpdateKey.called).toEqual(false);
    });

    it("requires the destination AWS keys for a live S3 migration instead of falling back to the current account", async () => {
      const { service, createOrUpdateKey, scopedAwsCredentials } = stubRotation(readyMigration(auditedAws));

      await expect(service.rotateCredentials({
        migrationId: "environment-migration-2026-09-16-10-00-00-staging",
        confirmEnvironment: "staging",
        targetMongo
      })).rejects.toThrow(/required to rotate credentials/);
      expect(scopedAwsCredentials.called).toEqual(false);
      expect(createOrUpdateKey.called).toEqual(false);
    });

    it("rotates to the matching destination account and records the previous AWS keys for rollback", async () => {
      const { service, updateOne, createOrUpdateKey, bucketExists } = stubRotation(readyMigration(auditedAws));

      const rotated = await service.rotateCredentials({
        migrationId: "environment-migration-2026-09-16-10-00-00-staging",
        confirmEnvironment: "staging",
        targetMongo,
        targetAws: { bucket: "destination-bucket", region: "eu-west-2", accessKeyId: "NEWKEY", secretAccessKey: "new-secret" }
      });

      expect(rotated.migrationId).toEqual("environment-migration-2026-09-16-10-00-00-staging");
      expect(bucketExists.calledOnce).toEqual(true);
      expect(bucketExists.firstCall.args[1]).toEqual("destination-bucket");
      const written = createOrUpdateKey.firstCall.args[1].environments[0];
      expect(written.aws).toEqual({ bucket: "destination-bucket", region: "eu-west-2", accessKeyId: "NEWKEY", secretAccessKey: "new-secret" });
      expect(written.mongo).toEqual({ cluster: "new", db: "target", username: "target", password: "target-password" });
      const rotatedSet = updateOne.lastCall.args[1].$set;
      expect(rotatedSet.status).toEqual(EnvironmentMigrationStatus.ROTATED);
      expect(rotatedSet.rollbackInfo.oldAws).toEqual({ bucket: "old-bucket", region: "eu-west-2", accessKeyId: "OLDKEY" });
      expect(rotatedSet.rollbackInfo.targetAws).toEqual(auditedAws);
      expect(rotatedSet.rollbackInfo.oldMongo).toEqual({ cluster: "old", db: "source", username: "source", uriSummary: "source@old/source" });
    });

    it("keeps bucket-scoped rotation for a snapshot migration that has no destination account", async () => {
      const { service, createOrUpdateKey, scopedAwsCredentials, bucketExists } = stubRotation(readyMigration(null));

      await service.rotateCredentials({
        migrationId: "environment-migration-2026-09-16-10-00-00-staging",
        confirmEnvironment: "staging",
        targetMongo
      });

      expect(scopedAwsCredentials.calledOnce).toEqual(true);
      expect(bucketExists.called).toEqual(false);
      expect(createOrUpdateKey.firstCall.args[1].environments[0].aws.accessKeyId).toEqual("SCOPEDKEY");
    });
  });
});
