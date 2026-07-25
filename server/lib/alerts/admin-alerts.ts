import debug from "debug";
import { Brevo } from "@getbrevo/brevo";
import { isArray, isString } from "es-toolkit/compat";
import { AdminAlertsConfiguration } from "../../../projects/ngx-ramblers/src/app/models/admin-alerts.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { ScheduledTasksConfiguration } from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import * as config from "../mongo/controllers/config";
import { brevoClient } from "../brevo/brevo-config";
import { scheduleBrevo } from "../brevo/common/rate-limiting";
import { booleanOf, pluraliseWithCount } from "../shared/string-utils";

const debugLog = debug(envConfig.logNamespace("admin-alerts"));
debugLog.enabled = true;

export interface AdminAlertRecipient {
  email: string;
  name?: string;
}

export interface AdminAlertEmailRequest {
  subject: string;
  htmlContent: string;
  category?: string;
}

export function platformAdminEnvironment(): boolean {
  return booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED]);
}

export function normalisedAlertEmails(value: unknown): string[] {
  if (!isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  return value.reduce<string[]>((emails, entry) => {
    if (!isString(entry)) {
      return emails;
    }
    const email = entry.trim();
    const key = email.toLowerCase();
    if (!email || !email.includes("@") || seen.has(key)) {
      return emails;
    }
    seen.add(key);
    return [...emails, email];
  }, []);
}

async function legacyScheduledTaskAlertEmails(): Promise<string[]> {
  try {
    const document = await config.queryKey(ConfigKey.SCHEDULED_TASKS);
    const value = document?.value as ScheduledTasksConfiguration | null;
    return normalisedAlertEmails(value?.alertEmails);
  } catch {
    return [];
  }
}

async function clearLegacyScheduledTaskAlertEmails(): Promise<void> {
  try {
    const document = await config.queryKey(ConfigKey.SCHEDULED_TASKS);
    const value = document?.value as ScheduledTasksConfiguration | null;
    if (!value || !value.alertEmails) {
      return;
    }
    const {alertEmails: _removed, ...rest} = value;
    await config.createOrUpdateKey(ConfigKey.SCHEDULED_TASKS, rest);
  } catch (error: any) {
    debugLog("Failed to clear legacy scheduled-tasks alertEmails:", error?.message || error);
  }
}

export async function adminAlertEmails(): Promise<string[]> {
  try {
    const document = await config.queryKey(ConfigKey.ADMIN_ALERTS);
    const value = document?.value as AdminAlertsConfiguration | null;
    const configured = normalisedAlertEmails(value?.alertEmails);
    if (configured.length > 0) {
      return configured;
    }
    const legacy = await legacyScheduledTaskAlertEmails();
    if (legacy.length > 0) {
      await setAdminAlertEmails(legacy);
      await clearLegacyScheduledTaskAlertEmails();
      debugLog(`Migrated ${pluraliseWithCount(legacy.length, "alert email")} from scheduled-tasks config to admin-alerts`);
      return legacy;
    }
    return [];
  } catch (error: any) {
    debugLog("Failed to load admin alert emails:", error?.message || error);
    return [];
  }
}

export async function setAdminAlertEmails(alertEmails: unknown): Promise<string[]> {
  const emails = normalisedAlertEmails(alertEmails);
  await config.createOrUpdateKey(ConfigKey.ADMIN_ALERTS, {alertEmails: emails} satisfies AdminAlertsConfiguration);
  await clearLegacyScheduledTaskAlertEmails();
  return emails;
}

export async function adminAlertRecipients(): Promise<AdminAlertRecipient[]> {
  if (!platformAdminEnvironment()) {
    return [];
  }
  const emails = await adminAlertEmails();
  return emails.map(email => ({email}));
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function siteBaseUrl(): Promise<string | null> {
  try {
    const system = await systemConfig();
    const href = system?.group?.href;
    if (isString(href) && href.trim()) {
      return stripTrailingSlash(href.trim());
    }
  } catch (error: any) {
    debugLog("Failed to resolve group.href for alert links:", error?.message || error);
  }
  const fromEnv = envConfig.value(Environment.BASE_URL);
  if (isString(fromEnv) && fromEnv.trim()) {
    return stripTrailingSlash(fromEnv.trim());
  }
  return null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendAdminAlertEmail(request: AdminAlertEmailRequest): Promise<boolean> {
  try {
    if (!platformAdminEnvironment()) {
      debugLog(`Skipping admin alert (${request.category || "general"}) - not a platform admin environment`);
      return false;
    }
    const recipients = await adminAlertRecipients();
    if (recipients.length === 0) {
      debugLog(`No admin alert emails configured - not emailing (${request.category || "general"}): ${request.subject}`);
      return false;
    }
    const client = await brevoClient();
    const sendSmtpEmail: Brevo.SendTransacEmailRequest = {
      subject: request.subject,
      sender: {email: "backup@ngx-ramblers.org.uk", name: "NGX-Ramblers Alerts"},
      to: recipients,
      htmlContent: request.htmlContent
    };
    await scheduleBrevo(() => client.transactionalEmails.sendTransacEmail(sendSmtpEmail));
    debugLog(`Admin alert emailed to ${recipients.map(recipient => recipient.email).join(", ")} (${request.category || "general"}): ${request.subject}`);
    return true;
  } catch (error: any) {
    debugLog(`Failed to email admin alert (${request.category || "general"}):`, error?.message || error);
    return false;
  }
}
