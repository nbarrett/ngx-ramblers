import debug from "debug";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { RamblersWalksManagerDateFormat as DateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import {
  BackupConfig,
  BackupSessionStatus,
  S3BackupAction,
  S3BackupManifest,
  S3BackupManifestEntry,
  S3BackupRequest,
  S3BackupSummary,
  S3RestoreRequest
} from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
import { AWS_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { s3BackupManifest } from "../mongo/models/s3-backup-manifest";
import { configuredBackup } from "./backup-config";

const debugLog = debug(envConfig.logNamespace("s3-backup-service"));
debugLog.enabled = false;

interface S3ObjectInfo {
  key: string;
  eTag: string;
  size: number;
  lastModified: string;
}

interface SiteConfig {
  site: string;
  sourceBucket: string;
  sourceRegion: string;
  backupBucket: string;
  backupRegion: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
}

export function buildBackupPrefix(site: string, timestamp: string): string {
  return `s3-backups/${site}/${timestamp}`;
}

async function listAllObjects(s3: S3Client, bucket: string, prefix?: string): Promise<S3ObjectInfo[]> {
  const collectPage = async (acc: S3ObjectInfo[], token: string | undefined): Promise<S3ObjectInfo[]> => {
    const params: any = { Bucket: bucket, MaxKeys: 1000, ContinuationToken: token };
    if (prefix) {
      params.Prefix = prefix;
    }
    const resp = await s3.send(new ListObjectsV2Command(params));
    const pageItems = (resp.Contents || [])
      .filter(obj => obj.Key && !obj.Key.endsWith("/"))
      .map(obj => ({
        key: obj.Key!,
        eTag: (obj.ETag || "").replace(/"/g, ""),
        size: obj.Size || 0,
        lastModified: obj.LastModified ? obj.LastModified.toISOString() : ""
      }));
    const updated = [...acc, ...pageItems];
    if (resp.IsTruncated) {
      return collectPage(updated, resp.NextContinuationToken);
    }
    return updated;
  };
  return collectPage([], undefined);
}

export function buildETagIndex(objectInfos: S3ObjectInfo[]): Map<string, S3ObjectInfo> {
  return new Map(objectInfos.map(obj => [obj.key, obj]));
}

export function siteConfigs(backupConfig: BackupConfig): SiteConfig[] {
  const globalCredentials = backupConfig.aws?.accessKeyId && backupConfig.aws?.secretAccessKey
    ? { accessKeyId: backupConfig.aws.accessKeyId, secretAccessKey: backupConfig.aws.secretAccessKey }
    : null;
  const globalBucket = backupConfig.aws?.bucket;
  return (backupConfig.environments || [])
    .map(env => {
      if (!env.aws?.bucket) {
        return null;
      }
      const envCredentials = env.aws.accessKeyId && env.aws.secretAccessKey
        ? { accessKeyId: env.aws.accessKeyId, secretAccessKey: env.aws.secretAccessKey }
        : null;
      const credentials = globalCredentials || envCredentials;
      if (!credentials) {
        return null;
      }
      return {
        site: env.environment,
        sourceBucket: env.aws.bucket,
        sourceRegion: env.aws.region || AWS_DEFAULTS.REGION,
        backupBucket: globalBucket || env.aws.bucket + "-backups",
        backupRegion: backupConfig.aws?.region || env.aws.region || AWS_DEFAULTS.REGION,
        credentials
      };
    })
    .filter((config): config is SiteConfig => config !== null);
}

export function siteConfigFor(backupConfig: BackupConfig, siteName: string): SiteConfig | null {
  return siteConfigs(backupConfig).find(c => c.site === siteName) || null;
}

async function previousManifest(site: string): Promise<S3BackupManifest | null> {
  return s3BackupManifest.findOne({ site, status: BackupSessionStatus.COMPLETED }).sort({ timestamp: -1 }).lean() as Promise<S3BackupManifest | null>;
}

async function performIncrementalBackup(
  config: SiteConfig,
  timestamp: string,
  mongoTimestamp?: string,
  dryRun?: boolean
): Promise<S3BackupManifest> {
  const startMs = dateTimeNowAsValue();
  const backupPrefix = buildBackupPrefix(config.site, timestamp);

  const sourceClient = new S3Client({ region: config.sourceRegion, credentials: config.credentials });
  const backupClient = config.sourceBucket === config.backupBucket && config.sourceRegion === config.backupRegion
    ? sourceClient
    : new S3Client({ region: config.backupRegion, credentials: config.credentials });

  debugLog(`Listing objects in source bucket ${config.sourceBucket}`);
  const sourceObjects = await listAllObjects(sourceClient, config.sourceBucket);
  debugLog(`Found ${sourceObjects.length} objects in source bucket`);

  const previous = await previousManifest(config.site);
  const previousIndex = previous
    ? buildETagIndex(previous.entries.map(e => ({ key: e.key, eTag: e.eTag, size: e.size, lastModified: e.lastModified })))
    : new Map<string, S3ObjectInfo>();

  const manifestEntries: S3BackupManifestEntry[] = [];
  let copiedCount = 0;
  let skippedCount = 0;
  let copiedBytes = 0;
  let totalBytes = 0;

  for (const obj of sourceObjects) {
    totalBytes += obj.size;
    const previousEntry = previousIndex.get(obj.key);
    const unchanged = previousEntry && previousEntry.eTag === obj.eTag;

    if (unchanged) {
      manifestEntries.push({
        key: obj.key,
        eTag: obj.eTag,
        size: obj.size,
        lastModified: obj.lastModified,
        action: S3BackupAction.SKIPPED
      });
      skippedCount++;
    } else {
      if (!dryRun) {
        const destKey = `${backupPrefix}/${obj.key}`;
        await backupClient.send(new CopyObjectCommand({
          Bucket: config.backupBucket,
          CopySource: encodeURIComponent(`${config.sourceBucket}/${obj.key}`),
          Key: destKey
        }));
        debugLog(`Copied ${obj.key} to ${config.backupBucket}/${destKey}`);
      }
      manifestEntries.push({
        key: obj.key,
        eTag: obj.eTag,
        size: obj.size,
        lastModified: obj.lastModified,
        action: S3BackupAction.COPIED
      });
      copiedCount++;
      copiedBytes += obj.size;
    }
  }

  const durationMs = dateTimeNowAsValue() - startMs;

  const manifest: Omit<S3BackupManifest, "_id" | "createdAt"> = {
    timestamp,
    site: config.site,
    sourceBucket: config.sourceBucket,
    backupBucket: config.backupBucket,
    backupPrefix,
    mongoTimestamp: mongoTimestamp || undefined,
    entries: manifestEntries,
    totalObjects: sourceObjects.length,
    copiedObjects: copiedCount,
    skippedObjects: skippedCount,
    totalSizeBytes: totalBytes,
    copiedSizeBytes: copiedBytes,
    durationMs,
    status: BackupSessionStatus.COMPLETED
  };

  if (dryRun) {
    debugLog(`Dry run for ${config.site} at ${timestamp}: ${copiedCount} would be copied, ${skippedCount} skipped (manifest not persisted)`);
    return manifest as S3BackupManifest;
  }

  const saved = await s3BackupManifest.create(manifest);
  debugLog(`Saved manifest for ${config.site} at ${timestamp}: ${copiedCount} copied, ${skippedCount} skipped`);
  return saved.toObject() as S3BackupManifest;
}

async function performRestore(
  sourceConfig: SiteConfig,
  manifest: S3BackupManifest,
  targetConfig: SiteConfig,
  dryRun?: boolean
): Promise<S3BackupManifest> {
  const startMs = dateTimeNowAsValue();

  const sourceClient = new S3Client({ region: sourceConfig.backupRegion, credentials: sourceConfig.credentials });
  const destClient = new S3Client({ region: targetConfig.sourceRegion, credentials: targetConfig.credentials });

  const currentObjects = await listAllObjects(destClient, targetConfig.sourceBucket);
  const currentIndex = buildETagIndex(currentObjects);

  const copiedEntries = manifest.entries.filter(e => e.action === S3BackupAction.COPIED);
  const allEntries = manifest.entries;

  const manifestKeySet = new Set(allEntries.map(e => e.key));
  const keysToDelete = currentObjects
    .filter(obj => !manifestKeySet.has(obj.key))
    .map(obj => obj.key);

  let restoredCount = 0;
  let skippedCount = 0;
  let deletedCount = 0;

  for (const entry of allEntries) {
    const currentObj = currentIndex.get(entry.key);
    if (currentObj && currentObj.eTag === entry.eTag) {
      skippedCount++;
      continue;
    }

    const isCopiedEntry = copiedEntries.some(e => e.key === entry.key);
    if (isCopiedEntry) {
      const backupKey = `${manifest.backupPrefix}/${entry.key}`;
      if (!dryRun) {
        await destClient.send(new CopyObjectCommand({
          Bucket: targetConfig.sourceBucket,
          CopySource: encodeURIComponent(`${manifest.backupBucket}/${backupKey}`),
          Key: entry.key
        }));
      }
      restoredCount++;
    } else {
      const sourceManifest = await s3BackupManifest.findOne({
        site: sourceConfig.site,
        status: BackupSessionStatus.COMPLETED,
        timestamp: { $lte: manifest.timestamp },
        entries: {
          $elemMatch: {
            key: entry.key,
            action: S3BackupAction.COPIED,
            eTag: entry.eTag
          }
        }
      }).sort({ timestamp: -1 }).lean() as S3BackupManifest | null;

      if (sourceManifest) {
        const backupKey = `${sourceManifest.backupPrefix}/${entry.key}`;
        if (!dryRun) {
          await destClient.send(new CopyObjectCommand({
            Bucket: targetConfig.sourceBucket,
            CopySource: encodeURIComponent(`${sourceManifest.backupBucket}/${backupKey}`),
            Key: entry.key
          }));
        }
        restoredCount++;
      } else {
        debugLog(`No source manifest found for ${entry.key} with eTag ${entry.eTag} at or before ${manifest.timestamp} — skipping`);
        skippedCount++;
      }
    }
  }

  for (const key of keysToDelete) {
    if (!dryRun) {
      await destClient.send(new DeleteObjectCommand({
        Bucket: targetConfig.sourceBucket,
        Key: key
      }));
    }
    deletedCount++;
  }

  const durationMs = dateTimeNowAsValue() - startMs;
  debugLog(`Restore for ${sourceConfig.site} -> ${targetConfig.site} at ${manifest.timestamp}: ${restoredCount} restored, ${skippedCount} skipped, ${deletedCount} deleted`);

  return {
    ...manifest,
    site: targetConfig.site,
    durationMs,
    copiedObjects: restoredCount,
    skippedObjects: skippedCount
  } as S3BackupManifest;
}

export async function startS3Backup(request: S3BackupRequest): Promise<S3BackupSummary[]> {
  const backupConfig = await configuredBackup();
  const timestamp = request.mongoTimestamp || dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP);
  const configs = request.all
    ? siteConfigs(backupConfig)
    : request.site
      ? [siteConfigFor(backupConfig, request.site)].filter((c): c is SiteConfig => c !== null)
      : [];

  if (configs.length === 0) {
    throw new Error(request.site
      ? `Site "${request.site}" not found or has no S3 configuration`
      : "No sites configured with S3 credentials");
  }

  const results: S3BackupSummary[] = [];
  for (const config of configs) {
    try {
      const manifest = await performIncrementalBackup(config, timestamp, request.mongoTimestamp, request.dryRun);
      results.push({
        site: manifest.site,
        timestamp: manifest.timestamp,
        totalObjects: manifest.totalObjects,
        copiedObjects: manifest.copiedObjects,
        skippedObjects: manifest.skippedObjects,
        totalSizeBytes: manifest.totalSizeBytes,
        copiedSizeBytes: manifest.copiedSizeBytes,
        durationMs: manifest.durationMs,
        status: manifest.status as BackupSessionStatus
      });
    } catch (error: any) {
      const failedManifest: Omit<S3BackupManifest, "_id" | "createdAt"> = {
        timestamp,
        site: config.site,
        sourceBucket: config.sourceBucket,
        backupBucket: config.backupBucket,
        backupPrefix: buildBackupPrefix(config.site, timestamp),
        mongoTimestamp: request.mongoTimestamp,
        entries: [],
        totalObjects: 0,
        copiedObjects: 0,
        skippedObjects: 0,
        totalSizeBytes: 0,
        copiedSizeBytes: 0,
        durationMs: 0,
        status: BackupSessionStatus.FAILED,
        error: error.message
      };
      await s3BackupManifest.create(failedManifest);
      results.push({
        site: config.site,
        timestamp,
        totalObjects: 0,
        copiedObjects: 0,
        skippedObjects: 0,
        totalSizeBytes: 0,
        copiedSizeBytes: 0,
        durationMs: 0,
        status: BackupSessionStatus.FAILED
      });
    }
  }

  return results;
}

export async function startS3Restore(request: S3RestoreRequest): Promise<S3BackupSummary[]> {
  const backupConfig = await configuredBackup();
  const sourceConfigs = request.all
    ? siteConfigs(backupConfig)
    : request.site
      ? [siteConfigFor(backupConfig, request.site)].filter((c): c is SiteConfig => c !== null)
      : [];

  if (sourceConfigs.length === 0) {
    throw new Error(request.site
      ? `Site "${request.site}" not found or has no S3 configuration`
      : "No sites configured with S3 credentials");
  }

  const resolveTargetConfig = (sourceConfig: SiteConfig): SiteConfig => {
    if (!request.targetSite || request.targetSite === sourceConfig.site) {
      return sourceConfig;
    }
    const target = siteConfigFor(backupConfig, request.targetSite);
    if (!target) {
      throw new Error(`Target site "${request.targetSite}" not found or has no S3 configuration`);
    }
    return target;
  };

  const results: S3BackupSummary[] = [];
  for (const sourceConfig of sourceConfigs) {
    const manifestDoc = await s3BackupManifest.findOne({
      site: sourceConfig.site,
      timestamp: request.timestamp,
      status: BackupSessionStatus.COMPLETED
    }).lean() as S3BackupManifest | null;

    if (!manifestDoc) {
      results.push({
        site: request.targetSite || sourceConfig.site,
        timestamp: request.timestamp,
        totalObjects: 0,
        copiedObjects: 0,
        skippedObjects: 0,
        totalSizeBytes: 0,
        copiedSizeBytes: 0,
        durationMs: 0,
        status: BackupSessionStatus.FAILED
      });
      continue;
    }

    try {
      const targetConfig = resolveTargetConfig(sourceConfig);
      const result = await performRestore(sourceConfig, manifestDoc, targetConfig, request.dryRun);
      results.push({
        site: result.site,
        timestamp: result.timestamp,
        totalObjects: result.totalObjects,
        copiedObjects: result.copiedObjects,
        skippedObjects: result.skippedObjects,
        totalSizeBytes: result.totalSizeBytes,
        copiedSizeBytes: result.copiedSizeBytes,
        durationMs: result.durationMs,
        status: BackupSessionStatus.COMPLETED
      });
    } catch (error: any) {
      results.push({
        site: request.targetSite || sourceConfig.site,
        timestamp: request.timestamp,
        totalObjects: 0,
        copiedObjects: 0,
        skippedObjects: 0,
        totalSizeBytes: 0,
        copiedSizeBytes: 0,
        durationMs: 0,
        status: BackupSessionStatus.FAILED
      });
    }
  }

  return results;
}

export function collectCopiedKeys(manifest: S3BackupManifest): string[] {
  return manifest.entries
    .filter(entry => entry.action === S3BackupAction.COPIED)
    .map(entry => entry.key);
}

async function countBlockingLaterManifests(site: string, timestamp: string, copiedKeys: string[]): Promise<number> {
  if (copiedKeys.length === 0) {
    return 0;
  }
  return s3BackupManifest.countDocuments({
    site,
    status: BackupSessionStatus.COMPLETED,
    timestamp: { $gt: timestamp },
    entries: {
      $elemMatch: {
        action: S3BackupAction.SKIPPED,
        key: { $in: copiedKeys }
      }
    }
  });
}

async function enrichDeletability(candidate: S3BackupManifest): Promise<S3BackupManifest> {
  const copiedKeys = collectCopiedKeys(candidate);
  const blockingCount = await countBlockingLaterManifests(candidate.site, candidate.timestamp, copiedKeys);
  return {
    ...candidate,
    deletable: blockingCount === 0,
    blockReason: blockingCount > 0
      ? `${blockingCount} later snapshot(s) reference objects physically stored in this one — deleting would orphan them`
      : undefined
  };
}

export async function manifests(site?: string, limit: number = 50): Promise<S3BackupManifest[]> {
  const query = site ? { site } : {};
  const rawManifests = await s3BackupManifest.find(query).sort({ timestamp: -1 }).limit(limit).lean() as S3BackupManifest[];
  return Promise.all(rawManifests.map(enrichDeletability));
}

export async function manifest(id: string): Promise<S3BackupManifest | null> {
  const doc = await s3BackupManifest.findById(id).lean() as S3BackupManifest | null;
  return doc ? enrichDeletability(doc) : null;
}

export async function manifestByTimestamp(site: string, timestamp: string): Promise<S3BackupManifest | null> {
  return s3BackupManifest.findOne({ site, timestamp, status: BackupSessionStatus.COMPLETED }).lean() as Promise<S3BackupManifest | null>;
}

export async function availableSites(): Promise<string[]> {
  const backupConfig = await configuredBackup();
  return siteConfigs(backupConfig).map(c => c.site);
}

export async function deleteManifests(ids: string[]): Promise<{ deleted: number; blocked: Array<{ id: string; reason: string }> }> {
  const candidates = await s3BackupManifest.find({ _id: { $in: ids } }).lean() as S3BackupManifest[];
  const deletable: string[] = [];
  const blocked: Array<{ id: string; reason: string }> = [];
  for (const candidate of candidates) {
    const copiedKeys = collectCopiedKeys(candidate);
    const blockingCount = await countBlockingLaterManifests(candidate.site, candidate.timestamp, copiedKeys);
    if (blockingCount > 0) {
      blocked.push({
        id: candidate._id!.toString(),
        reason: `${blockingCount} later snapshot(s) reference objects physically stored in this one`
      });
    } else {
      deletable.push(candidate._id!.toString());
    }
  }
  if (deletable.length > 0) {
    await s3BackupManifest.deleteMany({ _id: { $in: deletable } });
  }
  return { deleted: deletable.length, blocked };
}
