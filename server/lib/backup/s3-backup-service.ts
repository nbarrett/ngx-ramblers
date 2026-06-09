import debug from "debug";
import mongoose from "mongoose";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { isNumber } from "es-toolkit/compat";
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
import { backupEvents } from "./backup-events";

const debugLog = debug(envConfig.logNamespace("s3-backup-service"));
debugLog.enabled = true;

const PROGRESS_EVERY_MS = 3000;
const DEFAULT_S3_BACKUP_CONCURRENCY = 1;
const MAXIMUM_S3_BACKUP_CONCURRENCY = 20;

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, exp)).toFixed(1);
  return `${size} ${units[exp]}`;
}

function boundedConcurrency(value: unknown): number {
  const candidate = isNumber(value) && Number.isFinite(value) ? Math.floor(value) : DEFAULT_S3_BACKUP_CONCURRENCY;
  return Math.max(1, Math.min(MAXIMUM_S3_BACKUP_CONCURRENCY, candidate));
}

export type ProgressCallback = (message: string) => void | Promise<void>;

async function copyObjectWithETagGuard(
  client: S3Client,
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string,
  expectedETag: string,
  siteLabel: string,
  progressPrefix: string,
  attemptsRemaining: number = 3
): Promise<string> {
  try {
    await client.send(new CopyObjectCommand({
      Bucket: destBucket,
      CopySource: encodeURIComponent(`${sourceBucket}/${sourceKey}`),
      CopySourceIfMatch: expectedETag,
      Key: destKey
    }));
    return expectedETag;
  } catch (error: any) {
    const code = error?.Code || error?.name;
    const status = error?.$metadata?.httpStatusCode;
    const isPreconditionFailed = code === "PreconditionFailed" || status === 412;
    if (!isPreconditionFailed || attemptsRemaining <= 1) {
      throw error;
    }
    debugLog(`[${siteLabel}] ${progressPrefix} source modified mid-backup; rereading ${sourceKey} (${attemptsRemaining - 1} attempts remaining)`);
    const head = await client.send(new HeadObjectCommand({ Bucket: sourceBucket, Key: sourceKey }));
    const newETag = (head.ETag || "").replace(/"/g, "");
    if (!newETag || newETag === expectedETag) {
      throw error;
    }
    return copyObjectWithETagGuard(
      client, sourceBucket, sourceKey, destBucket, destKey, newETag, siteLabel, progressPrefix, attemptsRemaining - 1
    );
  }
}

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
  sharedWith?: string[];
}

export function buildBackupPrefix(site: string, timestamp: string): string {
  return `s3-backups/${site}/${timestamp}`;
}

export function buildManifestEntriesObjectKey(backupPrefix: string): string {
  return `${backupPrefix}/manifest-entries.json`;
}

async function streamToString(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

async function writeManifestEntries(client: S3Client, manifest: Pick<S3BackupManifest, "backupBucket" | "backupPrefix">, entries: S3BackupManifestEntry[]): Promise<string> {
  const key = buildManifestEntriesObjectKey(manifest.backupPrefix);
  await client.send(new PutObjectCommand({
    Bucket: manifest.backupBucket,
    Key: key,
    Body: JSON.stringify({ entries }),
    ContentType: "application/json; charset=utf-8"
  }));
  return key;
}

async function readManifestEntries(client: S3Client, manifest: S3BackupManifest): Promise<S3BackupManifestEntry[]> {
  if (manifest.entries && manifest.entries.length > 0) {
    return manifest.entries;
  }
  if (!manifest.entriesObjectKey) {
    return [];
  }
  const response = await client.send(new GetObjectCommand({
    Bucket: manifest.backupBucket,
    Key: manifest.entriesObjectKey
  }));
  const text = await streamToString(response.Body);
  const parsed = JSON.parse(text);
  return parsed.entries || parsed;
}

async function manifestWithEntries(config: SiteConfig, manifest: S3BackupManifest): Promise<S3BackupManifest> {
  const client = new S3Client({ region: config.backupRegion, credentials: config.credentials });
  const entries = await readManifestEntries(client, manifest);
  return { ...manifest, entries };
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

function rawSiteConfigs(backupConfig: BackupConfig): SiteConfig[] {
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

export function dedupeSiteConfigsByBucket(rawSites: SiteConfig[]): SiteConfig[] {
  const byBucket = new Map<string, SiteConfig[]>();
  for (const site of rawSites) {
    const list = byBucket.get(site.sourceBucket) || [];
    list.push(site);
    byBucket.set(site.sourceBucket, list);
  }
  const deduped: SiteConfig[] = [];
  for (const sitesForBucket of byBucket.values()) {
    const sortedBySite = [...sitesForBucket].sort((left, right) => left.site.localeCompare(right.site));
    const primary = {...sortedBySite[0]};
    if (sortedBySite.length > 1) {
      primary.sharedWith = sortedBySite.slice(1).map(aliasSite => aliasSite.site);
    }
    deduped.push(primary);
  }
  return deduped.sort((left, right) => left.site.localeCompare(right.site));
}

export function siteConfigs(backupConfig: BackupConfig): SiteConfig[] {
  return dedupeSiteConfigsByBucket(rawSiteConfigs(backupConfig));
}

const MONGO_BACKUP_TIMESTAMP_SEGMENT = /\/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\//;

export function isSelfBackupKey(key: string): boolean {
  if (!key) {
    return false;
  }
  if (key.startsWith("s3-backups/") || key.includes("/s3-backups/")) {
    return true;
  }
  if (key.startsWith("database-backups/") || key.includes("/database-backups/")) {
    return true;
  }
  if (MONGO_BACKUP_TIMESTAMP_SEGMENT.test("/" + key)) {
    return true;
  }
  return false;
}

export function siteConfigFor(backupConfig: BackupConfig, siteName: string): SiteConfig | null {
  return siteConfigs(backupConfig).find(
    candidate => candidate.site === siteName || (candidate.sharedWith || []).includes(siteName)
  ) || null;
}

async function previousManifest(config: SiteConfig): Promise<S3BackupManifest | null> {
  const manifest = await s3BackupManifest.findOne({ site: config.site, status: BackupSessionStatus.COMPLETED }).sort({ timestamp: -1 }).lean() as S3BackupManifest | null;
  return manifest ? manifestWithEntries(config, manifest) : null;
}

async function performIncrementalBackup(
  config: SiteConfig,
  timestamp: string,
  mongoTimestamp?: string,
  dryRun?: boolean,
  concurrency?: number,
  onProgress?: ProgressCallback
): Promise<S3BackupManifest> {
  const startMs = dateTimeNowAsValue();
  const backupPrefix = buildBackupPrefix(config.site, timestamp);

  const sourceClient = new S3Client({ region: config.sourceRegion, credentials: config.credentials });
  const backupClient = config.sourceBucket === config.backupBucket && config.sourceRegion === config.backupRegion
    ? sourceClient
    : new S3Client({ region: config.backupRegion, credentials: config.credentials });

  debugLog(`[${config.site}] Listing objects in source bucket ${config.sourceBucket}`);
  const rawSourceObjects = await listAllObjects(sourceClient, config.sourceBucket);
  const sourceObjects = rawSourceObjects.filter(object => !isSelfBackupKey(object.key));
  const excludedCount = rawSourceObjects.length - sourceObjects.length;
  debugLog(`[${config.site}] Found ${rawSourceObjects.length} raw objects, ${sourceObjects.length} after excluding ${excludedCount} self-backup paths`);
  if (onProgress) {
    if (excludedCount > 0) {
      await onProgress(`S3 backup ${config.site}: excluded ${excludedCount} historical backup files (s3-backups/, database-backups/, <env>/<timestamp>/) from source`);
    }
    await onProgress(`S3 backup ${config.site}: discovered ${sourceObjects.length} source objects in ${config.sourceBucket}`);
  }
  if (config.sourceBucket === config.backupBucket) {
    debugLog(`[${config.site}] WARNING: source bucket and backup bucket are identical (${config.sourceBucket}); relying on self-backup-key filter to prevent recursion`);
    if (onProgress) {
      await onProgress(`S3 backup ${config.site}: WARNING source and backup bucket are both ${config.sourceBucket}; consider configuring a separate backup bucket to fully isolate them`);
    }
  }

  const previous = await previousManifest(config);
  const previousIndex = previous
    ? buildETagIndex(previous.entries.map(previousEntry => ({
        key: previousEntry.key,
        eTag: previousEntry.eTag,
        size: previousEntry.size,
        lastModified: previousEntry.lastModified
      })))
    : new Map<string, S3ObjectInfo>();
  debugLog(`[${config.site}] Previous manifest: ${previous ? `${previous.timestamp} with ${previousIndex.size} entries` : "none (first run, full backup)"}`);

  const manifestEntries: S3BackupManifestEntry[] = [];
  const state = {
    nextIndex: 0,
    copiedCount: 0,
    skippedCount: 0,
    copiedBytes: 0,
    totalBytes: 0,
    lastProgressMs: dateTimeNowAsValue(),
    processed: 0,
    firstError: null as Error | null
  };
  const effectiveConcurrency = boundedConcurrency(concurrency);

  const emitProgress = async (): Promise<void> => {
    if (onProgress) {
      const nowMs = dateTimeNowAsValue();
      const isLast = state.processed === sourceObjects.length;
      if (isLast || nowMs - state.lastProgressMs >= PROGRESS_EVERY_MS) {
        state.lastProgressMs = nowMs;
        await onProgress(`S3 backup ${config.site}: ${state.processed}/${sourceObjects.length} processed (${state.copiedCount} copied, ${state.skippedCount} skipped, ${formatBytes(state.copiedBytes)} transferred)`);
      }
    }
  };

  const processObject = async (index: number): Promise<void> => {
    const obj = sourceObjects[index];
    state.totalBytes += obj.size;
    const sequence = index + 1;
    const previousEntry = previousIndex.get(obj.key);
    const unchanged = previousEntry && previousEntry.eTag === obj.eTag;

    if (unchanged) {
      manifestEntries[index] = {
        key: obj.key,
        eTag: obj.eTag,
        size: obj.size,
        lastModified: obj.lastModified,
        action: S3BackupAction.SKIPPED
      };
      state.skippedCount++;
      debugLog(`[${config.site}] [${sequence}/${sourceObjects.length}] SKIPPED ${obj.key} (${formatBytes(obj.size)}, eTag ${obj.eTag})`);
    } else {
      debugLog(`[${config.site}] [${sequence}/${sourceObjects.length}] COPY START ${obj.key} (${formatBytes(obj.size)}${previousEntry ? `, old eTag ${previousEntry.eTag} → new eTag ${obj.eTag}` : ", new"})`);
      let recordedETag = obj.eTag;
      if (!dryRun) {
        try {
          const destKey = `${backupPrefix}/${obj.key}`;
          recordedETag = await copyObjectWithETagGuard(
            backupClient,
            config.sourceBucket,
            obj.key,
            config.backupBucket,
            destKey,
            obj.eTag,
            config.site,
            `[${sequence}/${sourceObjects.length}]`
          );
          if (recordedETag !== obj.eTag) {
            debugLog(`[${config.site}] [${sequence}/${sourceObjects.length}] COPY DONE  ${obj.key} -> ${config.backupBucket}/${destKey} (eTag updated ${obj.eTag} -> ${recordedETag})`);
          } else {
            debugLog(`[${config.site}] [${sequence}/${sourceObjects.length}] COPY DONE  ${obj.key} -> ${config.backupBucket}/${destKey}`);
          }
        } catch (error: any) {
          debugLog(`[${config.site}] [${sequence}/${sourceObjects.length}] COPY FAIL  ${obj.key}: ${error?.name || ""} ${error?.message || error}`);
          throw error;
        }
      } else {
        debugLog(`[${config.site}] [${sequence}/${sourceObjects.length}] COPY DRY-RUN ${obj.key}`);
      }
      manifestEntries[index] = {
        key: obj.key,
        eTag: recordedETag,
        size: obj.size,
        lastModified: obj.lastModified,
        action: S3BackupAction.COPIED
      };
      state.copiedCount++;
      state.copiedBytes += obj.size;
    }

    state.processed++;
    await emitProgress();
  };

  const worker = async (): Promise<void> => {
    const index = state.nextIndex++;
    if (state.firstError || index >= sourceObjects.length) {
      return;
    }
    try {
      await processObject(index);
    } catch (error: any) {
      state.firstError = error;
      return;
    }
    return worker();
  };

  const workerCount = Math.min(effectiveConcurrency, sourceObjects.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (state.firstError) {
    throw state.firstError;
  }

  const durationMs = dateTimeNowAsValue() - startMs;

  const manifest: Omit<S3BackupManifest, "_id" | "createdAt"> = {
    timestamp,
    site: config.site,
    sourceBucket: config.sourceBucket,
    backupBucket: config.backupBucket,
    backupPrefix,
    ...(mongoTimestamp ? { mongoTimestamp } : {}),
    entriesObjectKey: buildManifestEntriesObjectKey(backupPrefix),
    entriesCount: manifestEntries.length,
    entries: dryRun ? manifestEntries : [],
    totalObjects: sourceObjects.length,
    copiedObjects: state.copiedCount,
    skippedObjects: state.skippedCount,
    totalSizeBytes: state.totalBytes,
    copiedSizeBytes: state.copiedBytes,
    durationMs,
    status: BackupSessionStatus.COMPLETED
  };

  if (dryRun) {
    debugLog(`Dry run for ${config.site} at ${timestamp}: ${state.copiedCount} would be copied, ${state.skippedCount} skipped (manifest not persisted)`);
    return manifest as S3BackupManifest;
  }

  const entriesObjectKey = await writeManifestEntries(backupClient, manifest, manifestEntries);
  const saved = await s3BackupManifest.create({ ...manifest, entriesObjectKey, entries: [] });
  const savedObject = saved.toObject() as S3BackupManifest;
  debugLog(`Saved manifest for ${config.site} at ${timestamp}: ${state.copiedCount} copied, ${state.skippedCount} skipped`);
  backupEvents.emit("manifest-created", { manifest: {...savedObject, entries: []} });
  return savedObject;
}

async function performRestore(
  sourceConfig: SiteConfig,
  manifest: S3BackupManifest,
  targetConfig: SiteConfig,
  dryRun?: boolean,
  onProgress?: ProgressCallback
): Promise<S3BackupManifest> {
  const startMs = dateTimeNowAsValue();

  const destClient = new S3Client({ region: targetConfig.sourceRegion, credentials: targetConfig.credentials });

  debugLog(`[${targetConfig.site}] Listing current objects in ${targetConfig.sourceBucket}`);
  const currentObjects = await listAllObjects(destClient, targetConfig.sourceBucket);
  const currentIndex = buildETagIndex(currentObjects);
  debugLog(`[${targetConfig.site}] Current target bucket has ${currentObjects.length} objects; manifest has ${manifest.entries.length} entries`);
  if (onProgress) {
    await onProgress(`S3 restore ${targetConfig.site}: target has ${currentObjects.length} current objects, manifest has ${manifest.entries.length} entries`);
  }

  const copiedEntries = manifest.entries.filter(manifestEntry => manifestEntry.action === S3BackupAction.COPIED);
  const allEntries = manifest.entries;

  const manifestKeySet = new Set(allEntries.map(manifestEntry => manifestEntry.key));
  const keysToDelete = currentObjects
    .filter(currentObject => !manifestKeySet.has(currentObject.key))
    .map(currentObject => currentObject.key);

  let restoredCount = 0;
  let skippedCount = 0;
  let deletedCount = 0;
  let lastProgressMs = dateTimeNowAsValue();
  let processed = 0;

  for (const entry of allEntries) {
    processed++;
    const currentObj = currentIndex.get(entry.key);
    if (currentObj && currentObj.eTag === entry.eTag) {
      skippedCount++;
      debugLog(`[${targetConfig.site}] [${processed}/${allEntries.length}] ALREADY-OK ${entry.key}`);
      if (onProgress) {
        const nowMs = dateTimeNowAsValue();
        if (nowMs - lastProgressMs >= PROGRESS_EVERY_MS) {
          lastProgressMs = nowMs;
          await onProgress(`S3 restore ${targetConfig.site}: ${processed}/${allEntries.length} processed (${restoredCount} restored, ${skippedCount} already in place)`);
        }
      }
      continue;
    }

    const isCopiedEntry = copiedEntries.some(copiedEntry => copiedEntry.key === entry.key);
    if (isCopiedEntry) {
      const backupKey = `${manifest.backupPrefix}/${entry.key}`;
      debugLog(`[${targetConfig.site}] [${processed}/${allEntries.length}] COPY FROM snapshot ${entry.key}`);
      if (!dryRun) {
        try {
          await destClient.send(new CopyObjectCommand({
            Bucket: targetConfig.sourceBucket,
            CopySource: encodeURIComponent(`${manifest.backupBucket}/${backupKey}`),
            Key: entry.key
          }));
        } catch (error: any) {
          debugLog(`[${targetConfig.site}] [${processed}/${allEntries.length}] COPY FAIL ${entry.key}: ${error?.name || ""} ${error?.message || error}`);
          throw error;
        }
      }
      restoredCount++;
    } else {
      const priorManifest = await priorCopiedManifestForEntry(sourceConfig, manifest.timestamp, entry);

      if (priorManifest) {
        const backupKey = `${priorManifest.backupPrefix}/${entry.key}`;
        debugLog(`[${targetConfig.site}] [${processed}/${allEntries.length}] COPY FROM earlier ${priorManifest.timestamp} ${entry.key}`);
        if (!dryRun) {
          try {
            await destClient.send(new CopyObjectCommand({
              Bucket: targetConfig.sourceBucket,
              CopySource: encodeURIComponent(`${priorManifest.backupBucket}/${backupKey}`),
              Key: entry.key
            }));
          } catch (error: any) {
            debugLog(`[${targetConfig.site}] [${processed}/${allEntries.length}] COPY FAIL ${entry.key}: ${error?.name || ""} ${error?.message || error}`);
            throw error;
          }
        }
        restoredCount++;
      } else {
        debugLog(`[${targetConfig.site}] [${processed}/${allEntries.length}] MISS ${entry.key} (eTag ${entry.eTag} not found at or before ${manifest.timestamp})`);
        skippedCount++;
      }
    }

    if (onProgress) {
      const nowMs = dateTimeNowAsValue();
      if (nowMs - lastProgressMs >= PROGRESS_EVERY_MS) {
        lastProgressMs = nowMs;
        await onProgress(`S3 restore ${targetConfig.site}: ${processed}/${allEntries.length} processed (${restoredCount} restored, ${skippedCount} already in place)`);
      }
    }
  }

  if (keysToDelete.length > 0 && onProgress) {
    await onProgress(`S3 restore ${targetConfig.site}: deleting ${keysToDelete.length} extra target objects not in snapshot`);
  }
  for (const key of keysToDelete) {
    debugLog(`[${targetConfig.site}] DELETE-EXTRA ${key}`);
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

async function priorCopiedManifestForEntry(sourceConfig: SiteConfig, timestamp: string, entry: S3BackupManifestEntry): Promise<S3BackupManifest | null> {
  const candidates = await s3BackupManifest.find({
    site: sourceConfig.site,
    status: BackupSessionStatus.COMPLETED,
    timestamp: { $lte: timestamp }
  })
    .sort({ timestamp: -1 })
    .lean() as S3BackupManifest[];
  for (const candidate of candidates) {
    const manifest = await manifestWithEntries(sourceConfig, candidate);
    const matchingEntry = manifest.entries.find(candidateEntry =>
      candidateEntry.key === entry.key
      && candidateEntry.action === S3BackupAction.COPIED
      && candidateEntry.eTag === entry.eTag);
    if (matchingEntry) {
      return manifest;
    }
  }
  return null;
}

export async function startS3Backup(request: S3BackupRequest, onProgress?: ProgressCallback): Promise<S3BackupSummary[]> {
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
      if (config.sharedWith && config.sharedWith.length > 0 && onProgress) {
        await onProgress(`S3 backup ${config.site}: bucket ${config.sourceBucket} is shared with ${config.sharedWith.join(", ")} — backing up once under primary site "${config.site}"`);
      }
      debugLog(`[${config.site}] Starting incremental backup; sharedWith=${(config.sharedWith || []).join(",") || "none"}`);
      const manifest = await performIncrementalBackup(config, timestamp, request.mongoTimestamp, request.dryRun, request.concurrency, onProgress);
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
        ...(request.mongoTimestamp ? { mongoTimestamp: request.mongoTimestamp } : {}),
        entriesCount: 0,
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
      const savedFailed = await s3BackupManifest.create(failedManifest);
      backupEvents.emit("manifest-created", { manifest: {...(savedFailed.toObject() as S3BackupManifest), entries: []} });
      results.push({
        site: config.site,
        timestamp,
        totalObjects: 0,
        copiedObjects: 0,
        skippedObjects: 0,
        totalSizeBytes: 0,
        copiedSizeBytes: 0,
        durationMs: 0,
        status: BackupSessionStatus.FAILED,
        error: error.message
      });
    }
  }

  return results;
}

export async function startS3Restore(request: S3RestoreRequest, onProgress?: ProgressCallback): Promise<S3BackupSummary[]> {
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
        status: BackupSessionStatus.FAILED,
        error: `No completed manifest found for site ${sourceConfig.site} at ${request.timestamp}`
      });
      continue;
    }

    try {
      const targetConfig = resolveTargetConfig(sourceConfig);
      if (targetConfig.sharedWith && targetConfig.sharedWith.length > 0 && onProgress) {
        await onProgress(`S3 restore ${targetConfig.site}: target bucket ${targetConfig.sourceBucket} is shared with ${targetConfig.sharedWith.join(", ")} — single snapshot applied once under primary site`);
      }
      const manifest = await manifestWithEntries(sourceConfig, manifestDoc);
      const result = await performRestore(sourceConfig, manifest, targetConfig, request.dryRun, onProgress);
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

async function countBlockingLaterManifests(config: SiteConfig, timestamp: string, copiedKeys: string[]): Promise<number> {
  if (copiedKeys.length === 0) {
    return 0;
  }
  const candidates = await s3BackupManifest.find({
    site: config.site,
    status: BackupSessionStatus.COMPLETED,
    timestamp: { $gt: timestamp }
  }).lean() as S3BackupManifest[];
  const copiedKeySet = new Set(copiedKeys);
  const blocking = await Promise.all(candidates.map(async candidate => {
    const manifest = await manifestWithEntries(config, candidate);
    return manifest.entries.some(entry => entry.action === S3BackupAction.SKIPPED && copiedKeySet.has(entry.key));
  }));
  return blocking.filter(Boolean).length;
}

async function enrichDeletability(candidate: S3BackupManifest): Promise<S3BackupManifest> {
  const backupConfig = await configuredBackup();
  const config = siteConfigFor(backupConfig, candidate.site);
  if (!config) {
    return {
      ...candidate,
      deletable: false,
      blockReason: `No S3 configuration found for ${candidate.site}; cannot verify later snapshot references`
    };
  }
  const manifest = await manifestWithEntries(config, candidate);
  const copiedKeys = collectCopiedKeys(manifest);
  const blockingCount = await countBlockingLaterManifests(config, candidate.timestamp, copiedKeys);
  return {
    ...manifest,
    deletable: blockingCount === 0,
    ...(blockingCount > 0
      ? { blockReason: `${blockingCount} later snapshot(s) reference objects physically stored in this one — deleting would orphan them` }
      : {})
  };
}

const MANIFEST_SUMMARY_PROJECTION = {
  timestamp: 1,
  site: 1,
  sourceBucket: 1,
  backupBucket: 1,
  backupPrefix: 1,
  mongoTimestamp: 1,
  entriesObjectKey: 1,
  entriesCount: 1,
  totalObjects: 1,
  copiedObjects: 1,
  skippedObjects: 1,
  totalSizeBytes: 1,
  copiedSizeBytes: 1,
  durationMs: 1,
  status: 1,
  error: 1,
  createdAt: 1
} as const;

export async function manifests(site?: string, limit: number = 50): Promise<S3BackupManifest[]> {
  const query = site ? { site } : {};
  const summaries = await s3BackupManifest
    .find(query, MANIFEST_SUMMARY_PROJECTION)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean() as S3BackupManifest[];
  return summaries.map(summary => ({...summary, entries: []}));
}

export async function manifest(id: string): Promise<S3BackupManifest | null> {
  const doc = await s3BackupManifest.findById(id).lean() as S3BackupManifest | null;
  return doc ? enrichDeletability(doc) : null;
}

export async function manifestByTimestamp(site: string, timestamp: string): Promise<S3BackupManifest | null> {
  const backupConfig = await configuredBackup();
  const resolved = siteConfigFor(backupConfig, site);
  const effectiveSite = resolved?.site || site;
  const doc = await s3BackupManifest.findOne({ site: effectiveSite, timestamp, status: BackupSessionStatus.COMPLETED }).lean() as S3BackupManifest | null;
  return doc && resolved ? manifestWithEntries(resolved, doc) : doc;
}

export async function completedManifestStatusByTimestamp(site: string, backupConfig?: BackupConfig): Promise<Map<string, BackupSessionStatus>> {
  const resolvedConfig = backupConfig || await configuredBackup();
  const resolved = siteConfigFor(resolvedConfig, site);
  const effectiveSite = resolved?.site || site;
  const manifests = await s3BackupManifest
    .find({ site: effectiveSite, status: BackupSessionStatus.COMPLETED }, { timestamp: 1, status: 1, _id: 0 })
    .lean() as Pick<S3BackupManifest, "timestamp" | "status">[];
  return new Map(manifests.map(manifest => [manifest.timestamp, manifest.status]));
}

export async function availableSites(): Promise<string[]> {
  const backupConfig = await configuredBackup();
  return siteConfigs(backupConfig).map(siteConfig => siteConfig.site);
}

export async function deleteManifests(ids: string[]): Promise<{ deleted: number; blocked: Array<{ id: string; reason: string }> }> {
  const candidates = await s3BackupManifest.find({ _id: { $in: ids } }).lean() as S3BackupManifest[];
  const deletable: string[] = [];
  const blocked: Array<{ id: string; reason: string }> = [];
  const backupConfig = await configuredBackup();
  for (const candidate of candidates) {
    const config = siteConfigFor(backupConfig, candidate.site);
    if (!config) {
      blocked.push({
        id: candidate._id!.toString(),
        reason: `No S3 configuration found for ${candidate.site}; cannot verify later snapshot references`
      });
      continue;
    }
    const manifest = await manifestWithEntries(config, candidate);
    const copiedKeys = collectCopiedKeys(manifest);
    const blockingCount = await countBlockingLaterManifests(config, candidate.timestamp, copiedKeys);
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
    deletable.forEach(id => backupEvents.emit("manifest-deleted", { id }));
  }
  return { deleted: deletable.length, blocked };
}

const MANIFEST_ENTRY_FETCH_CHUNK = 2000;

async function embeddedManifestEntries(id: mongoose.Types.ObjectId | string, offset = 0): Promise<S3BackupManifestEntry[]> {
  const slice = await s3BackupManifest
    .findById(id)
    .select({ entries: { $slice: [offset, MANIFEST_ENTRY_FETCH_CHUNK] } })
    .lean() as S3BackupManifest | null;
  const batch = slice?.entries || [];
  if (batch.length < MANIFEST_ENTRY_FETCH_CHUNK) {
    return batch;
  }
  return batch.concat(await embeddedManifestEntries(id, offset + MANIFEST_ENTRY_FETCH_CHUNK));
}

export async function externaliseEmbeddedManifestEntries(site?: string, limit?: number, onProgress?: ProgressCallback): Promise<{ scanned: number; externalised: number; skipped: number; failed: number }> {
  const backupConfig = await configuredBackup();
  const query = site ? { site, "entries.0": { $exists: true } } : { "entries.0": { $exists: true } };
  const candidateRefs = await s3BackupManifest
    .find(query)
    .select("site timestamp")
    .sort({ timestamp: 1 })
    .lean();
  const maximum = limit && limit > 0 ? limit : null;
  const limitedRefs = maximum !== null ? candidateRefs.slice(0, maximum) : candidateRefs;
  let scanned = 0;
  let externalised = 0;
  let skipped = 0;
  let failed = 0;
  for (const candidateRef of limitedRefs) {
    scanned++;
    try {
      const baseResults = await s3BackupManifest.aggregate([
        { $match: { _id: candidateRef._id } },
        { $addFields: { embeddedEntryCount: { $size: { $ifNull: ["$entries", []] } } } },
        { $project: { entries: 0 } }
      ]);
      const candidate = baseResults[0] as S3BackupManifest & { embeddedEntryCount: number };
      const entries = candidate ? await embeddedManifestEntries(candidateRef._id) : [];
      if (!candidate || entries.length === 0) {
        skipped++;
        continue;
      }
      if (entries.length !== candidate.embeddedEntryCount) {
        skipped++;
        debugLog(`[${candidate.site}] Skipping manifest ${candidate.timestamp}: entries changed during read, leaving for the active pass`);
        continue;
      }
      const config = siteConfigFor(backupConfig, candidate.site);
      if (!config) {
        failed++;
        debugLog(`[${candidate.site}] Cannot externalise manifest ${candidate.timestamp}: no S3 configuration`);
        continue;
      }
      const client = new S3Client({ region: config.backupRegion, credentials: config.credentials });
      const entriesObjectKey = await writeManifestEntries(client, candidate, entries);
      const updateResult = await s3BackupManifest.updateOne(
        { _id: candidate._id, "entries.0": { $exists: true } },
        {
          $set: {
            entriesObjectKey,
            entriesCount: entries.length,
            entries: []
          }
        });
      if (updateResult.matchedCount === 0) {
        skipped++;
        continue;
      }
      externalised++;
      if (externalised % 25 === 0) {
        await onProgress?.(`Optimised ${externalised} embedded S3 manifest(s) so far`);
      }
      debugLog(`[${candidate.site}] Externalised ${entries.length} entries for manifest ${candidate.timestamp} to ${entriesObjectKey}`);
    } catch (error: any) {
      failed++;
      debugLog(`[${candidateRef.site}] Failed to externalise manifest ${candidateRef.timestamp}: ${error?.message || error}`);
    }
  }
  return {
    scanned,
    externalised,
    skipped,
    failed
  };
}
