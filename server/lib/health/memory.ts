import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { FlyTargetApp } from "../../../projects/ngx-ramblers/src/app/models/health.model";
import * as v8 from "v8";
import { S3 } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow } from "../shared/dates";
import { DateFormat } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { flyMachineMemoryStats, flyMetricHistory } from "../fly/fly-metrics";
import { currentMachineState, restartCurrentMachine } from "../fly/fly-machines";
import { toMb } from "../shared/units";

const debugLog = debug(envConfig.logNamespace("health:memory"));
debugLog.enabled = true;

function s3(): S3 {
  const awsConfig = envConfig.aws();
  return new S3({
    region: awsConfig.region,
    credentials: {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey
    }
  });
}

export async function memoryUsage(_req: Request, res: Response): Promise<void> {
  const memory = process.memoryUsage();
  const heap = v8.getHeapStatistics();
  res.status(200).json({
    timestamp: dateTimeNow().toISO(),
    environment: envConfig.env,
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    processMemoryMb: {
      rss: toMb(memory.rss),
      heapTotal: toMb(memory.heapTotal),
      heapUsed: toMb(memory.heapUsed),
      external: toMb(memory.external),
      arrayBuffers: toMb(memory.arrayBuffers)
    },
    v8HeapMb: {
      heapSizeLimit: toMb(heap.heap_size_limit),
      totalHeapSize: toMb(heap.total_heap_size),
      usedHeapSize: toMb(heap.used_heap_size),
      mallocedMemory: toMb(heap.malloced_memory),
      externalMemory: toMb((heap as { external_memory?: number }).external_memory ?? 0)
    },
    nativeContexts: heap.number_of_native_contexts,
    detachedContexts: heap.number_of_detached_contexts
  });
}

export async function heapSnapshot(_req: Request, res: Response): Promise<void> {
  const before = process.memoryUsage();
  const timestamp = dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP);
  const bucket = envConfig.aws().bucket;
  const key = `diagnostics/heap-snapshots/${envConfig.env}-${timestamp}.heapsnapshot`;
  debugLog(`Capturing heap snapshot for ${envConfig.env}; rss=${toMb(before.rss)}MB heapUsed=${toMb(before.heapUsed)}MB -> s3://${bucket}/${key}`);
  try {
    const snapshotStream = v8.getHeapSnapshot();
    const upload = new Upload({
      client: s3(),
      params: {
        Bucket: bucket,
        Key: key,
        Body: snapshotStream,
        ContentType: "application/octet-stream"
      },
      partSize: 8 * 1024 * 1024,
      queueSize: 2,
      leavePartsOnError: false
    });
    await upload.done();
    const after = process.memoryUsage();
    debugLog(`Heap snapshot uploaded to s3://${bucket}/${key}; rss after=${toMb(after.rss)}MB`);
    res.status(200).json({
      bucket,
      key,
      capturedRssMb: toMb(before.rss),
      message: "Heap snapshot uploaded. Download from S3 and open in Chrome DevTools > Memory > Load to inspect retained objects."
    });
  } catch (error) {
    debugLog("Heap snapshot failed:", error);
    res.status(500).json({ error: error?.message || "Heap snapshot failed" });
  }
}

function targetAppFrom(req: Request): FlyTargetApp {
  return req.query.app === FlyTargetApp.WORKER ? FlyTargetApp.WORKER : FlyTargetApp.ENVIRONMENT;
}

export async function flyStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await flyMachineMemoryStats(targetAppFrom(req));
    res.status(200).json(stats);
  } catch (error) {
    debugLog("Fly stats query failed:", error);
    res.status(500).json({ available: false, error: error?.message || "Failed to query Fly stats" });
  }
}

export async function flyMemoryHistory(req: Request, res: Response): Promise<void> {
  try {
    const requested = Number(req.query.minutes);
    const minutes = Math.min(Math.max(Number.isFinite(requested) && requested > 0 ? Math.round(requested) : 1440, 15), 10080);
    const metric = isString(req.query.metric) ? req.query.metric : "memory";
    const history = await flyMetricHistory(metric, minutes, targetAppFrom(req));
    res.status(200).json(history);
  } catch (error) {
    debugLog("Fly metric history query failed:", error);
    res.status(500).json({ available: false, error: error?.message || "Failed to query Fly metric history", series: [] });
  }
}

export async function flyMachineState(req: Request, res: Response): Promise<void> {
  try {
    const machineState = await currentMachineState(targetAppFrom(req));
    res.status(200).json(machineState);
  } catch (error) {
    debugLog("Fly machine state query failed:", error);
    res.status(500).json({ available: false, error: error?.message || "Failed to query Fly machine state" });
  }
}

export async function restartMachine(req: Request, res: Response): Promise<void> {
  const result = await restartCurrentMachine(targetAppFrom(req));
  if (result.ok) {
    debugLog(`Restart triggered for ${envConfig.env}`);
    res.status(200).json({ message: "Restart triggered" });
  } else {
    debugLog(`Restart request rejected for ${envConfig.env}: ${result.error}`);
    res.status(503).json({ error: result.error });
  }
}
