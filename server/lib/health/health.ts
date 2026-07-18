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

const timingLog = debug(envConfig.logNamespace("health-timing"));
timingLog.enabled = true;

const MIGRATION_STATUS_TTL_MS = 5 * 60 * 1000;
const migrationStatusCache: { status: MigrationStatus | null; at: number } = { status: null, at: 0 };

async function migrationStatusCached(): Promise<MigrationStatus> {
  const now = dateTimeNow().toMillis();
  if (migrationStatusCache.status && now - migrationStatusCache.at < MIGRATION_STATUS_TTL_MS) {
    return migrationStatusCache.status;
  }
  try {
    const timeoutPromise = new Promise<MigrationStatus>((_, reject) =>
      setTimeout(() => reject(new Error("Migration status check timeout")), 12000)
    );
    const status = await Promise.race([migrationRunner.migrationStatus(), timeoutPromise]);
    migrationStatusCache.status = status;
    migrationStatusCache.at = now;
    return status;
  } catch (error) {
    debugLog("Migration status check failed or timed out:", error.message);
    return migrationStatusCache.status || { files: [], failed: false };
  }
}

export async function health(req: Request, res: Response) {
  res.status(200).json({
    status: "OK",
    timestamp: dateTimeNow().toISO()
  });
}

export async function systemStatus(req: Request, res: Response<Partial<HealthResponse>>) {
  try {
    const startedAtMs = dateTimeNow().toMillis();
    const awsConfig = queryAWSConfig();
    const awsConfigMs = dateTimeNow().toMillis();
    const config = await systemConfig();
    const systemConfigMs = dateTimeNow().toMillis();

    const migrationStatus = await migrationStatusCached();
    const migrationStatusMs = dateTimeNow().toMillis();
    timingLog("systemStatus timings(ms):",
      "queryAWSConfig=", awsConfigMs - startedAtMs,
      "systemConfig=", systemConfigMs - awsConfigMs,
      "migrationStatusCached=", migrationStatusMs - systemConfigMs,
      "total=", migrationStatusMs - startedAtMs);

    const automaticMigrations = migrationStatus.files.filter(f => !f.manual);
    const pending = automaticMigrations.filter(f => f.status === MigrationFileStatus.PENDING).length;
    const applied = automaticMigrations.filter(f => f.status === MigrationFileStatus.APPLIED).length;
    const skipped = automaticMigrations.filter(f => f.status === MigrationFileStatus.SKIPPED).length;
    const failed = automaticMigrations.some(f => f.status === MigrationFileStatus.FAILED);

    const isHealthy = !failed && pending === 0;

    debugLog("files count:", migrationStatus.files.length);

    const base: Partial<HealthResponse> = {
      status: isHealthy ? HealthStatus.OK : HealthStatus.DEGRADED,
      timestamp: dateTimeNow().toISO(),
      migrations: {
        pending,
        applied,
        skipped,
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
        groupCode: config?.group?.groupCode,
        href: config?.group?.href
      },
      webAnalytics: {
        enabled: config?.cloudflareWebAnalytics?.enabled,
        siteTag: config?.cloudflareWebAnalytics?.siteTag
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
