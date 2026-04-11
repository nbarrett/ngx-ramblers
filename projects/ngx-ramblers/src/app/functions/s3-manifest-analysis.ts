import { S3BackupManifestEntry, S3ManifestBreakdown } from "../models/backup-session.model";

export function groupEntriesByPrefix(entries: S3BackupManifestEntry[], depth: number = 1): S3ManifestBreakdown[] {
  const safeDepth = Math.max(1, depth);
  const buckets = new Map<string, S3ManifestBreakdown>();
  entries.forEach(entry => {
    const segments = entry.key.split("/");
    const hasFolder = segments.length > safeDepth;
    const prefixLabel = hasFolder ? segments.slice(0, safeDepth).join("/") + "/" : "(root)";
    const existing = buckets.get(prefixLabel) || { label: prefixLabel, count: 0, bytes: 0 };
    existing.count += 1;
    existing.bytes += entry.size || 0;
    buckets.set(prefixLabel, existing);
  });
  return [...buckets.values()].sort((left, right) => right.bytes - left.bytes);
}

export function groupEntriesByExtension(entries: S3BackupManifestEntry[]): S3ManifestBreakdown[] {
  const buckets = new Map<string, S3ManifestBreakdown>();
  entries.forEach(entry => {
    const lastDot = entry.key.lastIndexOf(".");
    const lastSlash = entry.key.lastIndexOf("/");
    const extension = (lastDot > lastSlash && lastDot > -1)
      ? entry.key.substring(lastDot + 1).toLowerCase()
      : "(no extension)";
    const existing = buckets.get(extension) || { label: extension, count: 0, bytes: 0 };
    existing.count += 1;
    existing.bytes += entry.size || 0;
    buckets.set(extension, existing);
  });
  return [...buckets.values()].sort((left, right) => right.bytes - left.bytes);
}

export function topLargestEntries(entries: S3BackupManifestEntry[], count: number = 20): S3BackupManifestEntry[] {
  return [...entries]
    .sort((left, right) => (right.size || 0) - (left.size || 0))
    .slice(0, Math.max(0, count));
}
