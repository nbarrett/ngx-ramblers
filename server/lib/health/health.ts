import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { queryAWSConfig } from "../aws/aws-controllers";
import { migrationRunner } from "../mongo/migrations/migrations-runner";
import { HealthResponse, HealthStatus } from "../../../projects/ngx-ramblers/src/app/models/health.model";
import { dateTimeNow } from "../shared/dates";
import {
  MigrationFileStatus,
  MigrationStatus
} from "../../../projects/ngx-ramblers/src/app/models/mongo-migration-model";

const debugLog = debug(envConfig.logNamespace("health"));
debugLog.enabled = false;

export async function health(req: Request, res: Response) {
  res.status(200).json({
    status: "OK",
    timestamp: dateTimeNow().toISO()
  });
}

export async function systemStatus(req: Request, res: Response<Partial<HealthResponse>>) {
  try {
    const awsConfig = queryAWSConfig();
    const config = await systemConfig();

    let migrationStatus: MigrationStatus;
    try {
      const timeoutPromise = new Promise<MigrationStatus>((_, reject) =>
        setTimeout(() => reject(new Error("Migration status check timeout")), 1500)
      );
      migrationStatus = await Promise.race([
        migrationRunner.migrationStatus(),
        timeoutPromise
      ]);
    } catch (error) {
      debugLog("Migration status check failed or timed out:", error.message);
      migrationStatus = { files: [], failed: false };
    }

    const pending = migrationStatus.files.filter(f => f.status === MigrationFileStatus.PENDING).length;
    const applied = migrationStatus.files.filter(f => f.status === MigrationFileStatus.APPLIED).length;
    const failed = migrationStatus.files.some(f => f.status === MigrationFileStatus.FAILED);

    const isHealthy = !failed && pending === 0;

    debugLog("files count:", migrationStatus.files.length);

    const base: Partial<HealthResponse> = {
      status: isHealthy ? HealthStatus.OK : HealthStatus.DEGRADED,
      timestamp: dateTimeNow().toISO(),
      migrations: {
        pending,
        applied,
        failed
      }
    };

    const healthData: Partial<HealthResponse> = {
      ...base,
      environment: {
        env: envConfig.env,
        nodeEnv: envConfig.env
      },
      aws: {
        region: awsConfig?.region,
        bucket: awsConfig?.bucket
      },
      group: {
        shortName: config?.group?.shortName,
        groupCode: config?.group?.groupCode
      },
      migrations: {
        ...base.migrations,
        files: migrationStatus.files
      }
    };

    debugLog("Health data:", healthData);

    if (isHealthy) {
      res.status(200).json(healthData);
    } else {
      res.status(503).json(healthData);
    }
  } catch (error) {
    debugLog("Caught error", error.message);
    res.status(500).send(error.message);
  }
}
