import { kebabCase } from "es-toolkit/compat";
import { BackupListItem, BackupLocation, BackupSessionStatus } from "../models/backup-session.model";
import { sortBy } from "./arrays";

const TIMESTAMP_LENGTH = 19;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/;

export function backupSource(item: BackupListItem, fallback: BackupLocation): BackupLocation {
  return item.location || fallback;
}

export function backupEnvironment(item: BackupListItem): string {
  if (item.environment) {
    return item.environment;
  } else {
    return environmentFromS3Path(item.path) || environmentFromS3Path(item.name) || environmentFromLocalName(item);
  }
}

export function backupOutcome(item: BackupListItem): string {
  return item.outcome || item.status || BackupSessionStatus.COMPLETED;
}

export function backupsForSourceAndEnvironment(backups: BackupListItem[], source: BackupLocation, environment: string): BackupListItem[] {
  const fromSource = backups.filter(backup => backupSource(backup, source) === source);
  return environment ? fromSource.filter(backup => sameBackupEnvironment(backupEnvironment(backup), environment)) : [...fromSource];
}

export function restorableBackups(backups: BackupListItem[]): BackupListItem[] {
  return backups.filter(backup => backupOutcome(backup) === BackupSessionStatus.COMPLETED).sort(sortBy("-timestamp", "name"));
}

export function sameBackupEnvironment(left: string, right: string): boolean {
  return kebabCase(left || "") === kebabCase(right || "");
}

function environmentFromS3Path(value: string): string {
  const path = value || "";
  const afterScheme = path.startsWith("s3://") ? path.substring(path.indexOf("//") + 2) : path;
  const parts = afterScheme.split("/").filter(part => !!part);
  if (path.startsWith("s3://")) {
    return parts[1] || "";
  } else if (parts.length >= 2 && TIMESTAMP_PATTERN.test(parts[1])) {
    return parts[0] || "";
  } else {
    return "";
  }
}

function environmentFromLocalName(item: BackupListItem): string {
  const name = item.name || "";
  const database = item.database || "";
  if (name.length > TIMESTAMP_LENGTH && database && name.endsWith(`-${database}`)) {
    return name.slice(TIMESTAMP_LENGTH + 1, name.length - database.length - 1);
  } else {
    return "";
  }
}
