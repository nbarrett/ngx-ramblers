import debug from "debug";
import { toPairs } from "es-toolkit/compat";
import { AdminSettingsPath } from "../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import {
  SCHEDULED_TASK_SUB_TAB_GROUPS,
  ScheduledTaskSubTab
} from "../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";
import { StoredValue } from "../../../projects/ngx-ramblers/src/app/models/ui-actions";
import { envConfig } from "../env-config/env-config";
import {
  escapeHtml,
  sendAdminAlertEmail,
  siteBaseUrl
} from "../alerts/admin-alerts";
import { dateTimeNow } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("cron:scheduled-task-alerts"));
debugLog.enabled = true;

export enum ScheduledTaskProblem {
  FAILED = "failed",
  MISSED = "missed",
  INCOMPLETE = "incomplete",
  STOPPED_RESTARTED = "stopped-restarted"
}

export interface ScheduledTaskAlert {
  taskId: string;
  taskName: string;
  problem: ScheduledTaskProblem;
  message: string;
  details?: string | null;
}

function scheduledTaskSubTab(taskId: string): string {
  const parent = toPairs(SCHEDULED_TASK_SUB_TAB_GROUPS)
    .find(([, children]) => children.includes(taskId as ScheduledTaskSubTab));
  if (parent) {
    return parent[0];
  }
  return taskId || ScheduledTaskSubTab.ALL;
}

export function scheduledTasksAdminPath(taskId: string): string {
  const tab = "scheduled-tasks";
  const subTab = scheduledTaskSubTab(taskId);
  return `${AdminSettingsPath.SYSTEM_SETTINGS}?${StoredValue.TAB}=${encodeURIComponent(tab)}&${StoredValue.TASK_SUB_TAB}=${encodeURIComponent(subTab)}`;
}

export async function scheduledTasksAdminUrl(taskId: string): Promise<string | null> {
  const base = await siteBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/${scheduledTasksAdminPath(taskId)}`;
}

function problemTitle(problem: ScheduledTaskProblem): string {
  if (problem === ScheduledTaskProblem.FAILED) {
    return "Scheduled task failed";
  } else if (problem === ScheduledTaskProblem.MISSED) {
    return "Scheduled task missed its run";
  } else if (problem === ScheduledTaskProblem.INCOMPLETE) {
    return "Scheduled task interrupted";
  } else {
    return "Scheduled task cron was stopped";
  }
}

function buildHtml(alert: ScheduledTaskAlert, adminUrl: string | null): string {
  const detectedAt = dateTimeNow().toFormat("cccc, d LLLL yyyy 'at' H:mm");
  const detailsBlock = alert.details
    ? `<h3>Details</h3><pre style="background-color:#fee2e2;padding:10px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;">${escapeHtml(alert.details)}</pre>`
    : "";
  const actionsBlock = adminUrl
    ? `<p style="margin-top:1.25em;">
         <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#c05711;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;font-weight:600;">
           Open Scheduled Tasks
         </a>
       </p>
       <p style="color:#666;font-size:0.9em;">
         Or go to
         <a href="${escapeHtml(adminUrl)}" style="color:#c05711;">Admin → System Settings → Scheduled Tasks</a>
         for history and manual runs.
       </p>`
    : `<p style="color:#666;font-size:0.9em;">Check Admin → System Settings → Scheduled Tasks for history and manual runs.</p>`;
  return `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #dc2626;">${problemTitle(alert.problem)}</h2>
        <p>A scheduled task problem was detected on the platform admin environment.</p>
        <ul>
          <li><strong>Task:</strong> ${escapeHtml(alert.taskName)} (<code>${escapeHtml(alert.taskId)}</code>)</li>
          <li><strong>Problem:</strong> ${escapeHtml(alert.problem)}</li>
          <li><strong>Detected:</strong> ${detectedAt} (Europe/London)</li>
        </ul>
        <p>${escapeHtml(alert.message)}</p>
        ${detailsBlock}
        ${actionsBlock}
      </body>
    </html>
  `;
}

export async function notifyPlatformAdminsOfScheduledTaskProblem(alert: ScheduledTaskAlert): Promise<void> {
  const adminUrl = await scheduledTasksAdminUrl(alert.taskId);
  const sent = await sendAdminAlertEmail({
    subject: `[NGX platform] ${problemTitle(alert.problem)}: ${alert.taskName}`,
    htmlContent: buildHtml(alert, adminUrl),
    category: `scheduled-task:${alert.problem}`
  });
  if (!sent) {
    debugLog(`Scheduled task alert not sent for "${alert.taskId}" (${alert.problem})`);
  }
}
