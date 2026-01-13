import debug from "debug";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { envConfig } from "../env-config/env-config";
import { configuredBrevo } from "../brevo/brevo-config";
import { BackupSession } from "../mongo/models/backup-session";
import { dateTimeFromJsDate } from "../shared/dates";
import { DateTime } from "luxon";

const debugLog = debug(envConfig.logNamespace("backup-notification"));
debugLog.enabled = true;

export interface NotificationRecipient {
  email: string;
  name?: string;
}

export interface BackupNotificationOptions {
  notificationConfigId?: string;
  recipients: NotificationRecipient[];
  sender?: NotificationRecipient;
  notifyOnStart?: boolean;
  notifyOnComplete?: boolean;
  notifyOnError?: boolean;
}

export class BackupNotificationService {
  private options: BackupNotificationOptions;

  constructor(options: BackupNotificationOptions) {
    this.options = {
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnError: true,
      ...options
    };
  }

  async notifyBackupStarted(session: BackupSession): Promise<void> {
    if (!this.options.notifyOnStart) return;

    const subject = `[${session.environment}] Database Backup Started`;
    const htmlContent = this.buildStartedEmailHtml(session);

    await this.sendEmail(subject, htmlContent);
  }

  async notifyBackupCompleted(session: BackupSession): Promise<void> {
    if (!this.options.notifyOnComplete) return;

    const subject = `[${session.environment}] Database Backup ${session.status === "completed" ? "Completed" : "Failed"}`;
    const htmlContent = session.status === "completed"
      ? this.buildCompletedEmailHtml(session)
      : this.buildFailedEmailHtml(session);

    await this.sendEmail(subject, htmlContent);
  }

  async notifyRestoreStarted(session: BackupSession): Promise<void> {
    if (!this.options.notifyOnStart) return;

    const subject = `[${session.environment}] Database Restore Started`;
    const htmlContent = this.buildRestoreStartedEmailHtml(session);

    await this.sendEmail(subject, htmlContent);
  }

  async notifyRestoreCompleted(session: BackupSession): Promise<void> {
    if (!this.options.notifyOnComplete) return;

    const subject = `[${session.environment}] Database Restore ${session.status === "completed" ? "Completed" : "Failed"}`;
    const htmlContent = session.status === "completed"
      ? this.buildRestoreCompletedEmailHtml(session)
      : this.buildFailedEmailHtml(session);

    await this.sendEmail(subject, htmlContent);
  }

  private async sendEmail(subject: string, htmlContent: string): Promise<void> {
    try {
      const brevoConfig = await configuredBrevo();
      const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);

      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.sender = this.options.sender || { email: "backup@ngx-ramblers.org.uk", name: "NGX Ramblers Backup System" };
      sendSmtpEmail.to = this.options.recipients;
      sendSmtpEmail.htmlContent = htmlContent;

      const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
      debugLog("Email sent successfully:", response);
    } catch (error) {
      debugLog("Error sending email:", error);
    }
  }

  private buildStartedEmailHtml(session: BackupSession): string {
    const collectionsText = session.collections?.length
      ? `<li><strong>Collections:</strong> ${session.collections.join(", ")}</li>`
      : `<li><strong>Collections:</strong> All</li>`;

    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #2563eb;">Database Backup Started</h2>
          <p>A database backup operation has been initiated with the following details:</p>
          <ul>
            <li><strong>Session ID:</strong> ${session.sessionId}</li>
            <li><strong>Environment:</strong> ${session.environment}</li>
            <li><strong>Database:</strong> ${session.database}</li>
            ${collectionsText}
            <li><strong>Started:</strong> ${dateTimeFromJsDate(session.startTime).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}</li>
            <li><strong>Triggered by:</strong> ${session.metadata?.triggeredBy} ${session.metadata?.user ? `(${session.metadata.user})` : ""}</li>
          </ul>
          ${session.options.upload ? `<p><strong>Note:</strong> Backup will be uploaded to S3 bucket: ${session.options.s3Bucket}</p>` : ""}
          <p style="color: #666; font-size: 0.9em;">You will receive another notification when the backup completes.</p>
        </body>
      </html>
    `;
  }

  private buildCompletedEmailHtml(session: BackupSession): string {
    const duration = session.endTime
      ? this.formatDuration(dateTimeFromJsDate(session.startTime).toMillis(), dateTimeFromJsDate(session.endTime).toMillis())
      : "Unknown";

    const locationInfo = session.s3Location
      ? `<p><strong>S3 Location:</strong> ${session.s3Location}</p>`
      : session.backupPath
      ? `<p><strong>Local Path:</strong> ${session.backupPath}</p>`
      : "";

    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #16a34a;">Database Backup Completed Successfully</h2>
          <p>The database backup operation has completed successfully:</p>
          <ul>
            <li><strong>Session ID:</strong> ${session.sessionId}</li>
            <li><strong>Environment:</strong> ${session.environment}</li>
            <li><strong>Database:</strong> ${session.database}</li>
            <li><strong>Duration:</strong> ${duration}</li>
          </ul>
          ${locationInfo}
          <p style="color: #16a34a; font-weight: bold;">Status: Completed</p>
        </body>
      </html>
    `;
  }

  private buildRestoreStartedEmailHtml(session: BackupSession): string {
    const collectionsText = session.collections?.length
      ? `<li><strong>Collections:</strong> ${session.collections.join(", ")}</li>`
      : `<li><strong>Collections:</strong> All</li>`;

    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #ea580c;">Database Restore Started</h2>
          <p><strong style="color: #dc2626;">⚠️ Warning:</strong> A database restore operation has been initiated. This will modify the database.</p>
          <ul>
            <li><strong>Session ID:</strong> ${session.sessionId}</li>
            <li><strong>Environment:</strong> ${session.environment}</li>
            <li><strong>Database:</strong> ${session.database}</li>
            ${collectionsText}
            <li><strong>Source:</strong> ${session.options.from}</li>
            <li><strong>Drop collections:</strong> ${session.options.drop ? "Yes" : "No"}</li>
            <li><strong>Started:</strong> ${dateTimeFromJsDate(session.startTime).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}</li>
            <li><strong>Triggered by:</strong> ${session.metadata?.triggeredBy} ${session.metadata?.user ? `(${session.metadata.user})` : ""}</li>
          </ul>
          ${session.options.dryRun ? `<p style="color: #2563eb;"><strong>Note:</strong> This is a DRY RUN - no changes will be made.</p>` : ""}
          <p style="color: #666; font-size: 0.9em;">You will receive another notification when the restore completes.</p>
        </body>
      </html>
    `;
  }

  private buildRestoreCompletedEmailHtml(session: BackupSession): string {
    const duration = session.endTime
      ? this.formatDuration(dateTimeFromJsDate(session.startTime).toMillis(), dateTimeFromJsDate(session.endTime).toMillis())
      : "Unknown";

    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #16a34a;">Database Restore Completed Successfully</h2>
          <p>The database restore operation has completed successfully:</p>
          <ul>
            <li><strong>Session ID:</strong> ${session.sessionId}</li>
            <li><strong>Environment:</strong> ${session.environment}</li>
            <li><strong>Database:</strong> ${session.database}</li>
            <li><strong>Source:</strong> ${session.options.from}</li>
            <li><strong>Duration:</strong> ${duration}</li>
          </ul>
          ${session.options.dryRun ? `<p style="color: #2563eb;">This was a DRY RUN - no actual changes were made.</p>` : ""}
          <p style="color: #16a34a; font-weight: bold;">Status: Completed</p>
        </body>
      </html>
    `;
  }

  private buildFailedEmailHtml(session: BackupSession): string {
    const logs = session.logs.slice(-10).join("\n");

    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #dc2626;">Database ${session.type === "backup" ? "Backup" : "Restore"} Failed</h2>
          <p><strong style="color: #dc2626;">⚠️ Error:</strong> The operation has failed.</p>
          <ul>
            <li><strong>Session ID:</strong> ${session.sessionId}</li>
            <li><strong>Environment:</strong> ${session.environment}</li>
            <li><strong>Database:</strong> ${session.database}</li>
            <li><strong>Started:</strong> ${dateTimeFromJsDate(session.startTime).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}</li>
          </ul>
          <h3>Error Details:</h3>
          <pre style="background-color: #fee2e2; padding: 10px; border-radius: 4px; overflow-x: auto;">${session.error}</pre>
          <h3>Recent Logs:</h3>
          <pre style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 0.85em;">${logs}</pre>
          <p style="color: #dc2626; font-weight: bold;">Status: Failed</p>
        </body>
      </html>
    `;
  }

  private formatDuration(startMs: number, endMs: number): string {
    const durationMs = endMs - startMs;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  }
}
