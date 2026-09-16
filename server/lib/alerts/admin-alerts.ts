import debug from "debug";
import { Brevo } from "@getbrevo/brevo";
import { isArray, isString, uniqBy } from "es-toolkit/compat";
import { validEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { AdminAlertRecipient, AdminAlertsConfiguration } from "../../../projects/ngx-ramblers/src/app/models/admin-alerts.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import * as config from "../mongo/controllers/config";
import { brevoClient } from "../brevo/brevo-config";
import { scheduleBrevo } from "../brevo/common/rate-limiting";
import { assertSendAllowed } from "../brevo/send-permission";
import { SendPurpose } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { booleanOf } from "../shared/string-utils";

const debugLog = debug(envConfig.logNamespace("admin-alerts"));
debugLog.enabled = true;

export interface AdminAlertEmailRequest {
  subject: string;
  htmlContent: string;
  category?: string;
}

export function platformAdminEnvironment(): boolean {
  return booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED]);
}

export function normalisedAlertRecipients(value: unknown): AdminAlertRecipient[] {
  const entries: Partial<AdminAlertRecipient>[] = isArray(value) ? value : [];
  return uniqBy(entries
    .map(entry => ({email: isString(entry?.email) ? entry.email.trim() : "", name: isString(entry?.name) ? entry.name.trim() : ""}))
    .filter(recipient => validEmail(recipient.email)), recipient => recipient.email.toLowerCase());
}

export async function configuredAdminAlertRecipients(): Promise<AdminAlertRecipient[]> {
  try {
    const document = await config.queryKey(ConfigKey.ADMIN_ALERTS);
    const value = document?.value as AdminAlertsConfiguration | null;
    return normalisedAlertRecipients(value?.recipients);
  } catch (error: any) {
    debugLog("Failed to load admin alert recipients:", error?.message || error);
    return [];
  }
}

export async function setAdminAlertRecipients(value: unknown): Promise<AdminAlertRecipient[]> {
  const recipients = normalisedAlertRecipients(value);
  await config.createOrUpdateKey(ConfigKey.ADMIN_ALERTS, {recipients} satisfies AdminAlertsConfiguration);
  return recipients;
}

async function adminAlertRecipients(): Promise<Brevo.SendTransacEmailRequest["to"]> {
  const recipients = platformAdminEnvironment() ? await configuredAdminAlertRecipients() : [];
  return recipients.map(recipient => recipient.name ? recipient : {email: recipient.email});
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
    await assertSendAllowed(SendPurpose.ADMIN_ALERT, {subject: request.subject, recipientCount: recipients.length});
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
