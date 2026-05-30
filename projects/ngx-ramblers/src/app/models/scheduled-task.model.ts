export const BREVO_CAMPAIGN_RELEASE_TASK_ID = "brevo-campaign-release";

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

export enum ScheduledTaskSubTab {
  BOOKING_REMINDERS = "booking-reminders",
  BREVO_UNSUBSCRIBES_SYNC = "brevo-unsubscribes-sync",
  WALKS_MANAGER_SYNC = "walks-manager-sync",
  BREVO_CAMPAIGN_RELEASE = "brevo-campaign-release",
  ALL = "all"
}

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
}

export interface ScheduledTasksConfiguration {
  enabled: Record<string, boolean>;
  cronExpressions: Record<string, string>;
}
