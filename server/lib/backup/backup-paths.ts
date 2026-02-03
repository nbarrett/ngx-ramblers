import * as path from "path";
import { dateTimeInTimezone } from "../shared/dates";
import { RamblersWalksManagerDateFormat as DateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";

const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/;

export function extractTimestampFromBackupName(backupName: string): string {
  const match = backupName.match(TIMESTAMP_PATTERN);
  return match ? match[1] : backupName;
}

export function buildS3KeyForBackup(environment: string, backupName: string): string {
  const timestampFolder = extractTimestampFromBackupName(backupName);
  return path.join(environment, timestampFolder).replace(/\\/g, "/");
}

export function buildS3LocationUrl(bucket: string, s3Key: string): string {
  return `s3://${bucket}/${s3Key}`;
}

export function parseS3BackupPrefix(prefix: string): { environment: string; timestamp: string } | null {
  const trimmed = prefix.replace(/\/$/, "");
  const parts = trimmed.split("/");
  if (parts.length === 2 && TIMESTAMP_PATTERN.test(parts[1])) {
    return { environment: parts[0], timestamp: parts[1] };
  } else {
    return null;
  }
}

export function parseTimestampToDate(timestamp: string): Date | undefined {
  const dt = dateTimeInTimezone(timestamp, DateFormat.FILE_TIMESTAMP);
  return dt.isValid ? dt.toJSDate() : undefined;
}

export function buildBackupName(timestamp: string, environment: string, database: string): string {
  return `${timestamp}-${environment}-${database}`;
}
