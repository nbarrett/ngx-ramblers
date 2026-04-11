import expect from "expect";
import { describe, it } from "mocha";
import {
  buildBackupPrefix,
  buildETagIndex,
  collectCopiedKeys,
  siteConfigs,
  siteConfigFor
} from "./s3-backup-service";
import {
  BackupConfig,
  BackupSessionStatus,
  S3BackupAction,
  S3BackupManifest
} from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";

describe("s3-backup-service", () => {

  describe("buildBackupPrefix", () => {

    it("builds prefix under s3-backups namespace", () => {
      expect(buildBackupPrefix("kent", "2026-04-11-00-00-00")).toEqual("s3-backups/kent/2026-04-11-00-00-00");
    });

    it("preserves site name with dashes", () => {
      expect(buildBackupPrefix("berkshire-weekend-walkers", "2026-04-11-00-00-00"))
        .toEqual("s3-backups/berkshire-weekend-walkers/2026-04-11-00-00-00");
    });

  });

  describe("buildETagIndex", () => {

    it("maps keys to object infos", () => {
      const index = buildETagIndex([
        { key: "a.jpg", eTag: "eta", size: 10, lastModified: "2026-04-11T00:00:00Z" },
        { key: "b.jpg", eTag: "etb", size: 20, lastModified: "2026-04-11T00:00:00Z" }
      ]);
      expect(index.size).toEqual(2);
      expect(index.get("a.jpg")?.eTag).toEqual("eta");
      expect(index.get("b.jpg")?.size).toEqual(20);
    });

    it("handles empty input", () => {
      expect(buildETagIndex([]).size).toEqual(0);
    });

    it("last entry wins on duplicate keys", () => {
      const index = buildETagIndex([
        { key: "a.jpg", eTag: "eta-v1", size: 10, lastModified: "2026-04-10T00:00:00Z" },
        { key: "a.jpg", eTag: "eta-v2", size: 20, lastModified: "2026-04-11T00:00:00Z" }
      ]);
      expect(index.get("a.jpg")?.eTag).toEqual("eta-v2");
    });

  });

  describe("siteConfigs", () => {

    it("returns empty when environments missing", () => {
      const config: BackupConfig = {};
      expect(siteConfigs(config)).toEqual([]);
    });

    it("skips environments without an AWS bucket", () => {
      const config: BackupConfig = {
        environments: [
          { environment: "kent", aws: { accessKeyId: "k", secretAccessKey: "s" } }
        ]
      };
      expect(siteConfigs(config)).toEqual([]);
    });

    it("skips environments with no resolvable credentials", () => {
      const config: BackupConfig = {
        environments: [
          { environment: "kent", aws: { bucket: "kent-images" } }
        ]
      };
      expect(siteConfigs(config)).toEqual([]);
    });

    it("uses per-environment credentials when global credentials absent", () => {
      const config: BackupConfig = {
        environments: [
          {
            environment: "kent",
            aws: { bucket: "kent-images", region: "eu-west-1", accessKeyId: "env-key", secretAccessKey: "env-secret" }
          }
        ]
      };
      const result = siteConfigs(config);
      expect(result).toHaveLength(1);
      expect(result[0].site).toEqual("kent");
      expect(result[0].sourceBucket).toEqual("kent-images");
      expect(result[0].sourceRegion).toEqual("eu-west-1");
      expect(result[0].credentials).toEqual({ accessKeyId: "env-key", secretAccessKey: "env-secret" });
    });

    it("inherits global credentials when per-environment credentials absent", () => {
      const config: BackupConfig = {
        aws: { accessKeyId: "global-key", secretAccessKey: "global-secret", bucket: "shared-backups", region: "eu-west-2" },
        environments: [
          { environment: "kent", aws: { bucket: "kent-images" } }
        ]
      };
      const result = siteConfigs(config);
      expect(result).toHaveLength(1);
      expect(result[0].credentials).toEqual({ accessKeyId: "global-key", secretAccessKey: "global-secret" });
      expect(result[0].backupBucket).toEqual("shared-backups");
      expect(result[0].backupRegion).toEqual("eu-west-2");
    });

    it("prefers global credentials over per-environment when both present", () => {
      const config: BackupConfig = {
        aws: { accessKeyId: "global-key", secretAccessKey: "global-secret" },
        environments: [
          {
            environment: "kent",
            aws: { bucket: "kent-images", accessKeyId: "env-key", secretAccessKey: "env-secret" }
          }
        ]
      };
      const result = siteConfigs(config);
      expect(result[0].credentials).toEqual({ accessKeyId: "global-key", secretAccessKey: "global-secret" });
    });

    it("falls back to <bucket>-backups when no global bucket set", () => {
      const config: BackupConfig = {
        aws: { accessKeyId: "global-key", secretAccessKey: "global-secret" },
        environments: [
          { environment: "kent", aws: { bucket: "kent-images" } }
        ]
      };
      const result = siteConfigs(config);
      expect(result[0].backupBucket).toEqual("kent-images-backups");
    });

    it("defaults region to eu-west-2 when not specified", () => {
      const config: BackupConfig = {
        aws: { accessKeyId: "g", secretAccessKey: "g" },
        environments: [
          { environment: "kent", aws: { bucket: "kent-images" } }
        ]
      };
      const result = siteConfigs(config);
      expect(result[0].sourceRegion).toEqual("eu-west-2");
      expect(result[0].backupRegion).toEqual("eu-west-2");
    });

    it("returns one SiteConfig per eligible environment", () => {
      const config: BackupConfig = {
        aws: { accessKeyId: "g", secretAccessKey: "g" },
        environments: [
          { environment: "kent", aws: { bucket: "kent-images" } },
          { environment: "bolton", aws: { bucket: "bolton-images" } },
          { environment: "no-bucket" }
        ]
      };
      const result = siteConfigs(config);
      expect(result).toHaveLength(2);
      expect(result.map(c => c.site)).toEqual(["kent", "bolton"]);
    });

  });

  describe("siteConfigFor", () => {

    const config: BackupConfig = {
      aws: { accessKeyId: "g", secretAccessKey: "g" },
      environments: [
        { environment: "kent", aws: { bucket: "kent-images" } },
        { environment: "bolton", aws: { bucket: "bolton-images" } }
      ]
    };

    it("finds site by name", () => {
      expect(siteConfigFor(config, "kent")?.sourceBucket).toEqual("kent-images");
    });

    it("returns null when site not present", () => {
      expect(siteConfigFor(config, "winchester")).toBeNull();
    });

  });

  describe("collectCopiedKeys", () => {

    const makeManifest = (entries: Array<{ key: string; action: S3BackupAction }>): S3BackupManifest => ({
      timestamp: "2026-04-11-00-00-00",
      site: "kent",
      sourceBucket: "kent-images",
      backupBucket: "kent-images-backups",
      backupPrefix: "s3-backups/kent/2026-04-11-00-00-00",
      entries: entries.map(e => ({ key: e.key, eTag: `et-${e.key}`, size: 1, lastModified: "", action: e.action })),
      totalObjects: entries.length,
      copiedObjects: entries.filter(e => e.action === S3BackupAction.COPIED).length,
      skippedObjects: entries.filter(e => e.action === S3BackupAction.SKIPPED).length,
      totalSizeBytes: entries.length,
      copiedSizeBytes: 0,
      durationMs: 0,
      status: BackupSessionStatus.COMPLETED
    });

    it("returns only keys with COPIED action", () => {
      const manifest = makeManifest([
        { key: "a.jpg", action: S3BackupAction.COPIED },
        { key: "b.jpg", action: S3BackupAction.SKIPPED },
        { key: "c.jpg", action: S3BackupAction.COPIED }
      ]);
      expect(collectCopiedKeys(manifest)).toEqual(["a.jpg", "c.jpg"]);
    });

    it("returns empty array when nothing is copied", () => {
      const manifest = makeManifest([
        { key: "a.jpg", action: S3BackupAction.SKIPPED },
        { key: "b.jpg", action: S3BackupAction.SKIPPED }
      ]);
      expect(collectCopiedKeys(manifest)).toEqual([]);
    });

  });

});
