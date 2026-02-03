import expect from "expect";
import { describe, it } from "mocha";
import {
  extractTimestampFromBackupName,
  buildS3KeyForBackup,
  buildS3LocationUrl,
  parseS3BackupPrefix,
  parseTimestampToDate,
  buildBackupName
} from "./backup-paths";

describe("backup-paths", () => {

  describe("extractTimestampFromBackupName", () => {

    it("should extract timestamp from standard backup name", () => {
      const result = extractTimestampFromBackupName("2026-01-15-14-30-45-staging-ngx-ramblers");
      expect(result).toEqual("2026-01-15-14-30-45");
    });

    it("should return original name if no timestamp pattern found", () => {
      const result = extractTimestampFromBackupName("invalid-backup-name");
      expect(result).toEqual("invalid-backup-name");
    });

    it("should handle timestamp-only input", () => {
      const result = extractTimestampFromBackupName("2026-01-15-14-30-45");
      expect(result).toEqual("2026-01-15-14-30-45");
    });

  });

  describe("buildS3KeyForBackup", () => {

    it("should build correct S3 key from environment and backup name", () => {
      const result = buildS3KeyForBackup("staging", "2026-01-15-14-30-45-staging-ngx-ramblers");
      expect(result).toEqual("staging/2026-01-15-14-30-45");
    });

    it("should build correct S3 key for production environment", () => {
      const result = buildS3KeyForBackup("production", "2026-02-03-09-15-00-production-ngx-ramblers");
      expect(result).toEqual("production/2026-02-03-09-15-00");
    });

    it("should use forward slashes regardless of platform", () => {
      const result = buildS3KeyForBackup("staging", "2026-01-15-14-30-45-staging-db");
      expect(result).not.toContain("\\");
      expect(result).toContain("/");
    });

    it("should produce path with exactly two segments: environment and timestamp", () => {
      const result = buildS3KeyForBackup("staging", "2026-01-15-14-30-45-staging-ngx-ramblers");
      const segments = result.split("/");
      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual("staging");
      expect(segments[1]).toEqual("2026-01-15-14-30-45");
    });

  });

  describe("buildS3LocationUrl", () => {

    it("should build correct S3 URL", () => {
      const result = buildS3LocationUrl("ngx-ramblers-database-backups", "staging/2026-01-15-14-30-45");
      expect(result).toEqual("s3://ngx-ramblers-database-backups/staging/2026-01-15-14-30-45");
    });

  });

  describe("parseS3BackupPrefix", () => {

    it("should parse valid backup prefix", () => {
      const result = parseS3BackupPrefix("staging/2026-01-15-14-30-45/");
      expect(result).toEqual({ environment: "staging", timestamp: "2026-01-15-14-30-45" });
    });

    it("should parse prefix without trailing slash", () => {
      const result = parseS3BackupPrefix("staging/2026-01-15-14-30-45");
      expect(result).toEqual({ environment: "staging", timestamp: "2026-01-15-14-30-45" });
    });

    it("should return null for invalid timestamp format", () => {
      const result = parseS3BackupPrefix("staging/invalid-timestamp/");
      expect(result).toBeNull();
    });

    it("should return null for too many path segments", () => {
      const result = parseS3BackupPrefix("staging/database/2026-01-15-14-30-45/");
      expect(result).toBeNull();
    });

    it("should return null for single segment", () => {
      const result = parseS3BackupPrefix("staging/");
      expect(result).toBeNull();
    });

  });

  describe("parseTimestampToDate", () => {

    it("should parse valid timestamp to Date", () => {
      const result = parseTimestampToDate("2026-01-15-14-30-45");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toEqual(2026);
      expect(result?.getMonth()).toEqual(0);
      expect(result?.getDate()).toEqual(15);
    });

    it("should return undefined for invalid timestamp", () => {
      const result = parseTimestampToDate("invalid-timestamp");
      expect(result).toBeUndefined();
    });

  });

  describe("buildBackupName", () => {

    it("should build backup name from components", () => {
      const result = buildBackupName("2026-01-15-14-30-45", "staging", "ngx-ramblers");
      expect(result).toEqual("2026-01-15-14-30-45-staging-ngx-ramblers");
    });

  });


  describe("path consistency between backup and list operations", () => {

    it("should produce paths that listS3Backups can parse", () => {
      const environment = "staging";
      const backupName = "2026-01-15-14-30-45-staging-ngx-ramblers";

      const s3Key = buildS3KeyForBackup(environment, backupName);
      const parsed = parseS3BackupPrefix(s3Key);

      expect(parsed).not.toBeNull();
      expect(parsed?.environment).toEqual(environment);
      expect(parsed?.timestamp).toEqual("2026-01-15-14-30-45");
    });

    it("should maintain consistency across multiple environments", () => {
      const testCases = [
        { env: "staging", backup: "2026-01-15-14-30-45-staging-ngx-ramblers-staging" },
        { env: "production", backup: "2026-02-03-09-00-00-production-ngx-ramblers" },
        { env: "development", backup: "2026-03-10-12-00-00-development-testdb" }
      ];

      for (const { env, backup } of testCases) {
        const s3Key = buildS3KeyForBackup(env, backup);
        const parsed = parseS3BackupPrefix(s3Key);

        expect(parsed).not.toBeNull();
        expect(parsed?.environment).toEqual(env);
      }
    });

  });

  describe("S3 path structure validation", () => {

    it("should not include database name in S3 key", () => {
      const s3Key = buildS3KeyForBackup("staging", "2026-01-15-14-30-45-staging-ngx-ramblers");
      expect(s3Key).not.toContain("ngx-ramblers");
    });

    it("should follow simplified structure: environment/timestamp", () => {
      const s3Key = buildS3KeyForBackup("production", "2026-01-15-14-30-45-production-mydb");
      expect(s3Key).toMatch(/^[a-z-]+\/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
    });

  });

});
