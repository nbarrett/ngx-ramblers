import expect from "expect";
import sinon from "sinon";
import { describe, afterEach, beforeEach, it } from "mocha";
import { EnvironmentMigrationService } from "./environment-migration-service";
import { environmentMigration } from "../mongo/models/environment-migration";
import {
  EnvironmentMigrationMode,
  EnvironmentMigrationPhase,
  EnvironmentMigrationStatus
} from "../../../projects/ngx-ramblers/src/app/models/environment-migration.model";
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
});
