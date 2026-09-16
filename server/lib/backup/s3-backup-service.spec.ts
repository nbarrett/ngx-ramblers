import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Readable } from "stream";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  PutPublicAccessBlockCommand,
  S3Client
} from "@aws-sdk/client-s3";
import {
  buildBackupPrefix,
  buildManifestEntriesObjectKey,
  buildETagIndex,
  collectCopiedKeys,
  destinationObjectMatchesSource,
  migrateLiveBucket,
  siteConfigs,
  siteConfigFor
} from "./s3-backup-service";
import { dateTimeFromIso } from "../shared/dates";
import { S3LiveCopyCheckpoint } from "../../../projects/ngx-ramblers/src/app/models/backup-session.model";
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
      expect(buildBackupPrefix("group-one-walkers", "2026-04-11-00-00-00"))
        .toEqual("s3-backups/group-one-walkers/2026-04-11-00-00-00");
    });

  });

  describe("buildManifestEntriesObjectKey", () => {

    it("stores manifest entries under the backup prefix", () => {
      expect(buildManifestEntriesObjectKey("s3-backups/kent/2026-04-11-00-00-00"))
        .toEqual("s3-backups/kent/2026-04-11-00-00-00/manifest-entries.json");
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
      expect(result.map(siteConfig => siteConfig.site)).toEqual(["bolton", "kent"]);
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
      entries: entries.map(entry => ({ key: entry.key, eTag: `et-${entry.key}`, size: 1, lastModified: "", action: entry.action })),
      totalObjects: entries.length,
      copiedObjects: entries.filter(entry => entry.action === S3BackupAction.COPIED).length,
      skippedObjects: entries.filter(entry => entry.action === S3BackupAction.SKIPPED).length,
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

  describe("destinationObjectMatchesSource", () => {

    const objectInfo = { key: "a.jpg", eTag: "abc", size: 10, lastModified: "2026-04-11T00:00:00Z" };

    it("treats a same-size object with a different ETag as changed", () => {
      expect(destinationObjectMatchesSource({ ContentLength: 10, ETag: "\"zzz\"" }, objectInfo)).toEqual(false);
    });

    it("matches on size and ETag", () => {
      expect(destinationObjectMatchesSource({ ContentLength: 10, ETag: "\"abc\"" }, objectInfo)).toEqual(true);
    });

    it("matches a re-uploaded object by the source ETag recorded in its metadata", () => {
      expect(destinationObjectMatchesSource({ ContentLength: 10, ETag: "\"different-after-put\"", Metadata: { "ngx-source-etag": "abc" } }, objectInfo)).toEqual(true);
    });

    it("never matches on a size difference", () => {
      expect(destinationObjectMatchesSource({ ContentLength: 11, ETag: "\"abc\"" }, objectInfo)).toEqual(false);
    });

  });

  describe("migrateLiveBucket", () => {

    const source = { bucket: "source-bucket", region: "eu-west-2", accessKeyId: "source-key", secretAccessKey: "source-secret" };
    const target = { bucket: "destination-bucket", region: "eu-west-2", accessKeyId: "destination-key", secretAccessKey: "destination-secret" };
    const lastModified = dateTimeFromIso("2026-04-11T00:00:00.000Z").toJSDate();
    const sourceObjects = [
      { Key: "a.jpg", ETag: "\"aaa\"", Size: 1, LastModified: lastModified },
      { Key: "b.jpg", ETag: "\"bbb\"", Size: 2, LastModified: lastModified },
      { Key: "c.jpg", ETag: "\"ccc\"", Size: 3, LastModified: lastModified },
      { Key: "d.jpg", ETag: "\"ddd\"", Size: 4, LastModified: lastModified }
    ];
    const destinationHeads: Record<string, any> = {
      "b.jpg": { ContentLength: 2, ETag: "\"bbb\"" },
      "c.jpg": { ContentLength: 3, ETag: "\"stale\"" }
    };
    const state = { sandbox: sinon.createSandbox(), sent: [] as any[], bucketMissing: false };

    beforeEach(() => {
      state.sandbox = sinon.createSandbox();
      state.sent = [];
      state.bucketMissing = false;
      state.sandbox.stub(S3Client.prototype, "send").callsFake(async (command: any) => {
        state.sent.push(command);
        if (command instanceof ListObjectsV2Command) {
          return { Contents: sourceObjects, IsTruncated: false };
        } else if (command instanceof HeadBucketCommand) {
          if (state.bucketMissing) {
            throw Object.assign(new Error("missing"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
          } else {
            return {};
          }
        } else if (command instanceof HeadObjectCommand) {
          const head = destinationHeads[command.input.Key];
          if (head) {
            return head;
          } else {
            throw Object.assign(new Error("missing"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
          }
        } else if (command instanceof GetObjectCommand) {
          return { Body: Readable.from(["x"]), ContentType: "image/jpeg", CacheControl: "max-age=3600", Metadata: { album: "walks" } };
        } else {
          return {};
        }
      });
    });

    afterEach(() => {
      state.sandbox.restore();
    });

    function sentOf<T>(type: new (...args: any[]) => T): T[] {
      return state.sent.filter(command => command instanceof type);
    }

    it("copies with the site's public-read ACL, preserves headers and metadata, and skips unchanged or checkpointed objects", async () => {
      const checkpoints: S3LiveCopyCheckpoint[] = [];
      const summary = await migrateLiveBucket({
        site: "staging",
        source,
        target,
        dryRun: false,
        resumeAfterKey: "a.jpg",
        onProgress: async progress => {
          checkpoints.push(progress);
        }
      });

      const headedKeys = sentOf(HeadObjectCommand).map((command: any) => command.input.Key);
      expect(headedKeys).not.toContain("a.jpg");
      expect(headedKeys.sort()).toEqual(["b.jpg", "c.jpg", "d.jpg"]);
      const puts = sentOf(PutObjectCommand).map((command: any) => command.input);
      expect(puts.map(put => put.Key).sort()).toEqual(["c.jpg", "d.jpg"]);
      puts.forEach(put => {
        expect(put.Bucket).toEqual("destination-bucket");
        expect(put.ACL).toEqual("public-read");
        expect(put.ContentType).toEqual("image/jpeg");
        expect(put.CacheControl).toEqual("max-age=3600");
        expect(put.Metadata.album).toEqual("walks");
      });
      expect(puts.find(put => put.Key === "c.jpg").Metadata["ngx-source-etag"]).toEqual("ccc");
      expect(summary.totalObjects).toEqual(4);
      expect(summary.copiedObjects).toEqual(2);
      expect(summary.skippedObjects).toEqual(2);
      expect(summary.copiedSizeBytes).toEqual(7);
      expect(summary.lastCopiedKey).toEqual("d.jpg");
      expect(checkpoints[checkpoints.length - 1]).toEqual({ lastKey: "d.jpg", copiedObjects: 2, skippedObjects: 2, copiedBytes: 7 });
      expect(sentOf(ListObjectsV2Command).length).toEqual(1);
    });

    it("creates a missing destination bucket with the same public access and CORS setup as a new site", async () => {
      state.bucketMissing = true;
      await migrateLiveBucket({ site: "staging", source, target, dryRun: false });

      const created = sentOf(CreateBucketCommand).map((command: any) => command.input);
      expect(created).toEqual([{ Bucket: "destination-bucket", CreateBucketConfiguration: { LocationConstraint: "eu-west-2" } }]);
      const publicAccess = sentOf(PutPublicAccessBlockCommand).map((command: any) => command.input);
      expect(publicAccess.length).toEqual(1);
      expect(publicAccess[0].Bucket).toEqual("destination-bucket");
      expect(publicAccess[0].PublicAccessBlockConfiguration.BlockPublicAcls).toEqual(false);
      expect(sentOf(PutBucketCorsCommand).map((command: any) => command.input.Bucket)).toEqual(["destination-bucket"]);
    });

    it("lists without writing on a dry run", async () => {
      state.bucketMissing = true;
      const summary = await migrateLiveBucket({ site: "staging", source, target, dryRun: true });

      expect(sentOf(ListObjectsV2Command).length).toEqual(1);
      expect(sentOf(CreateBucketCommand).length).toEqual(0);
      expect(sentOf(PutObjectCommand).length).toEqual(0);
      expect(sentOf(HeadObjectCommand).length).toEqual(0);
      expect(summary.totalObjects).toEqual(4);
      expect(summary.copiedObjects).toEqual(0);
    });

  });

});
