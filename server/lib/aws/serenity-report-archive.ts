import { execFile } from "child_process";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import * as path from "path";
import { promisify } from "util";
import { dateTimeNow } from "../shared/dates";

const unzip = promisify(execFile);
const reportExtractions = new Map<string, Promise<string>>();

export function extractedSerenityReportDirectory(bucket: string, keyPrefix: string, download: (bucket: string, key: string, archivePath: string) => Promise<void>, cacheRoot = path.resolve("target/report-cache")): Promise<string> {
  const cacheKey = `${cacheRoot}:${bucket}:${keyPrefix}`;
  const pending = reportExtractions.get(cacheKey);
  if (pending) {
    return pending;
  } else {
    const extraction = extractSerenityReport(bucket, keyPrefix, download, cacheRoot).finally(() => reportExtractions.delete(cacheKey));
    reportExtractions.set(cacheKey, extraction);
    return extraction;
  }
}

async function extractSerenityReport(bucket: string, keyPrefix: string, download: (bucket: string, key: string, archivePath: string) => Promise<void>, cacheRoot: string): Promise<string> {
  const cacheHash = createHash("sha1").update(`${bucket}:${keyPrefix}`).digest("hex");
  const extractionDir = path.join(cacheRoot, cacheHash);
  const readyMarker = path.join(extractionDir, ".ready");
  const ready = await fs.access(readyMarker).then(() => true, () => false);
  if (ready) {
    return extractionDir;
  } else {
    const archivePath = `${extractionDir}.zip`;
    await fs.rm(extractionDir, {recursive: true, force: true});
    await fs.mkdir(extractionDir, {recursive: true});
    try {
      await download(bucket, `${keyPrefix}.zip`, archivePath);
      await unzip("unzip", ["-q", "-o", archivePath, "-d", extractionDir]);
      await fs.access(path.join(extractionDir, "index.html"));
      await fs.writeFile(readyMarker, dateTimeNow().toISO() || "ready", "utf8");
      return extractionDir;
    } finally {
      await fs.rm(archivePath, {force: true});
    }
  }
}
