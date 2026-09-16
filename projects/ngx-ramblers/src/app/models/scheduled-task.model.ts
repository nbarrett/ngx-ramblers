export enum ScheduledTaskRunStatus {
  RUNNING = "running",
  SUCCEEDED = "succeeded",
  FAILED = "failed"
}

export enum ScheduledTaskScheduleFrequency {
  EVERY_MINUTES = "every-minutes",
  HOURLY = "hourly",
  EVERY_HOURS = "every-hours",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  CUSTOM = "custom"
}

export enum ScheduledTaskId {
  BOOKING_REMINDERS = "booking-reminders",
  WALKS_MANAGER_SYNC = "walks-manager-sync",
  INBOX_MESSAGE_DIGEST = "inbox-message-digest",
  INBOX_TOKEN_HEALTH_CHECK = "inbox-token-health-check",
  INBOX_DELETED_PURGE = "inbox-deleted-purge",
  BREVO_UNSUBSCRIBES_SYNC = "brevo-unsubscribes-sync",
  BREVO_CAMPAIGN_RELEASE = "brevo-campaign-release",
  BREVO_SMTP_KEEPALIVE = "brevo-smtp-keepalive",
  SITE_REGISTRATION = "site-registration",
  BACKUPS = "backups"
}

export enum ScheduledTaskSubTab {
  WALKS_AND_EVENTS = "walks-and-events",
  INBOX = "inbox",
  BREVO = "brevo",
  PLATFORM = "platform",
  ALL = "all"
}

export const BACKUPS_TASK_NAME = "All-environments backup";

export interface BackupsTaskSettings {
  mongoDumpConcurrency: number;
  s3ObjectBackupConcurrency: number;
  uploadMongoDumpToS3ByDefault: boolean;
  includeS3ObjectsByDefault: boolean;
  perEnvironmentTimeoutMinutes: number;
  maxRetries: number;
  retryDelaySeconds: number;
}

export const DEFAULT_BACKUPS_TASK_SETTINGS: BackupsTaskSettings = {
  mongoDumpConcurrency: 1,
  s3ObjectBackupConcurrency: 8,
  uploadMongoDumpToS3ByDefault: true,
  includeS3ObjectsByDefault: true,
  perEnvironmentTimeoutMinutes: 45,
  maxRetries: 1,
  retryDelaySeconds: 60
};

export const SCHEDULED_TASK_SUB_TAB_GROUPS: Record<Exclude<ScheduledTaskSubTab, ScheduledTaskSubTab.ALL>, ScheduledTaskId[]> = {
  [ScheduledTaskSubTab.WALKS_AND_EVENTS]: [
    ScheduledTaskId.WALKS_MANAGER_SYNC,
    ScheduledTaskId.BOOKING_REMINDERS
  ],
  [ScheduledTaskSubTab.INBOX]: [
    ScheduledTaskId.INBOX_MESSAGE_DIGEST,
    ScheduledTaskId.INBOX_TOKEN_HEALTH_CHECK,
    ScheduledTaskId.INBOX_DELETED_PURGE
  ],
  [ScheduledTaskSubTab.BREVO]: [
    ScheduledTaskId.BREVO_UNSUBSCRIBES_SYNC,
    ScheduledTaskId.BREVO_CAMPAIGN_RELEASE,
    ScheduledTaskId.BREVO_SMTP_KEEPALIVE
  ],
  [ScheduledTaskSubTab.PLATFORM]: [
    ScheduledTaskId.SITE_REGISTRATION,
    ScheduledTaskId.BACKUPS
  ]
};

export interface ScheduledTaskScheduleEdit {
  frequency: ScheduledTaskScheduleFrequency;
  minuteInterval: number;
  hourInterval: number;
  time: string;
  dayOfWeek: string;
  dayOfMonth: number;
}

export interface ScheduledTaskRun {
  startedAt: string;
  completedAt: string | null;
  status: ScheduledTaskRunStatus;
  message: string | null;
}

export interface ScheduledTaskRunRecord extends ScheduledTaskRun {
  taskId: string;
}

export interface ScheduledTaskSummary {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  defaultCronExpression: string;
  scheduleDescription: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRun: ScheduledTaskRun | null;
  history: ScheduledTaskRun[];
  settings?: unknown;
}

export interface ScheduledTasksConfiguration {
  enabled: Record<string, boolean>;
  cronExpressions: Record<string, string>;
  settings?: Record<string, unknown>;
}
