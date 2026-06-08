import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { createEnvironmentMigrationService } from "./environment-migration-service";
import { asNumber } from "../../../projects/ngx-ramblers/src/app/functions/numbers";

const debugLog = debug(envConfig.logNamespace("environment-migration-controller"));
debugLog.enabled = false;

function errorMessage(error: any): string {
  return error?.message || "Environment migration request failed";
}

export async function history(req: Request, res: Response) {
  try {
    const service = createEnvironmentMigrationService();
    const limit = asNumber(req.query.limit || 50);
    const environment = isString(req.query.environment) ? req.query.environment : null;
    const migrations = await service.history(environment, limit);
    res.status(200).json(migrations);
  } catch (error) {
    debugLog("history:error:", error);
    res.status(500).json({ error: errorMessage(error) });
  }
}

export async function migration(req: Request, res: Response) {
  try {
    const service = createEnvironmentMigrationService();
    const migrationRecord = await service.migration(req.params.migrationId);
    if (!migrationRecord) {
      res.status(404).json({ error: "Migration not found" });
      return;
    }
    res.status(200).json(migrationRecord);
  } catch (error) {
    debugLog("migration:error:", error);
    res.status(500).json({ error: errorMessage(error) });
  }
}

export async function planMongoOnlyMigration(req: Request, res: Response) {
  try {
    const service = createEnvironmentMigrationService();
    const user = (req as any).user?.username || "unknown";
    const migrationRecord = await service.planMongoOnlyMigration({
      ...req.body,
      user
    });
    res.status(200).json(migrationRecord);
  } catch (error) {
    debugLog("planMongoOnlyMigration:error:", error);
    res.status(400).json({ error: errorMessage(error) });
  }
}

export async function executeMongoOnlyMigration(req: Request, res: Response) {
  try {
    const service = createEnvironmentMigrationService();
    const user = (req as any).user?.username || "unknown";
    const migrationRecord = await service.startMongoOnlyMigration({
      ...req.body,
      dryRun: false,
      user
    });
    res.status(200).json(migrationRecord);
  } catch (error) {
    debugLog("executeMongoOnlyMigration:error:", error);
    res.status(400).json({ error: errorMessage(error) });
  }
}

export async function rotateMongoCredentials(req: Request, res: Response) {
  try {
    const service = createEnvironmentMigrationService();
    const user = (req as any).user?.username || "unknown";
    const migrationRecord = await service.rotateCredentials({
      ...req.body,
      user
    });
    res.status(200).json(migrationRecord);
  } catch (error) {
    debugLog("rotateMongoCredentials:error:", error);
    res.status(400).json({ error: errorMessage(error) });
  }
}
