import { BackupListItem, BackupLocation, BackupSessionStatus } from "../models/backup-session.model";
import { backupsForSourceAndEnvironment, restorableBackups } from "./backup-list-items";

describe("backup list items", () => {
  const backup = (name: string, timestamp: number, outcome?: string, location = BackupLocation.S3, environment = "example-group"): BackupListItem => ({
    name, path: `s3://bucket/${environment}/${name}`, timestamp, environment, location, outcome
  });

  it("offers only completed backups for restore, newest first", () => {
    const backups = [
      backup("old-complete", 100, BackupSessionStatus.COMPLETED),
      backup("missing", 300, "missing manifest"),
      backup("failed", 250, BackupSessionStatus.FAILED),
      backup("newest-complete", 400, BackupSessionStatus.COMPLETED),
      backup("local-without-status", 200, undefined, BackupLocation.LOCAL)
    ];
    expect(restorableBackups(backups).map(item => item.name)).toEqual(["newest-complete", "local-without-status", "old-complete"]);
  });

  it("filters backups to the chosen source and environment", () => {
    const backups = [
      backup("s3-example", 100),
      backup("local-example", 100, undefined, BackupLocation.LOCAL),
      backup("s3-other", 100, undefined, BackupLocation.S3, "other-group")
    ];
    expect(backupsForSourceAndEnvironment(backups, BackupLocation.S3, "Example Group").map(item => item.name)).toEqual(["s3-example"]);
    expect(backupsForSourceAndEnvironment(backups, BackupLocation.S3, null).map(item => item.name)).toEqual(["s3-example", "s3-other"]);
  });
});
