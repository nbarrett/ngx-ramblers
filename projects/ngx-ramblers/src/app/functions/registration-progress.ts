import { SetupProgress, SetupStepStatus } from "../models/environment-setup.model";
import { reversed } from "./arrays";

const NOISE_LINE = /resource failed|resource load error|net::ERR/i;
const FAILURE_LINE = /❌|^(error|failed|failure)\b|\b[1-9]\d*\s+(errors?|failures?)\b|\b(failed|errors?|failure):|\bfailed\s+(to|for|with)\b|\b(migration|import|build|validation|load|setup|step)\s+failed\b/i;
const COMPLETED_LINE = /✅|migrated|skip/i;

export function sanitiseRegistrationMessage(message: string): string {
  const text = (message || "").replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "").replace(/[│┌┐└┘├┤┬┴┼─═║╔╗╚╝]/g, " ").replace(/\s+/g, " ").trim();
  if (/playwright|chrome-headless|ms-playwright|browserType\.launch|npx playwright install/i.test(text)) {
    return "The import browser on the integration worker is not ready. Check that the integration worker is running, then retry.";
  } else {
    return text;
  }
}

export function registrationProgressLineFailed(message: string): boolean {
  return FAILURE_LINE.test((message || "").trim());
}

export function registrationProgressStatus(item: SetupProgress, inFlight: boolean, latest = true): SetupStepStatus {
  const message = item.message || "";
  if (item.status === SetupStepStatus.Failed || registrationProgressLineFailed(message)) {
    return SetupStepStatus.Failed;
  } else if (item.status === SetupStepStatus.Completed || COMPLETED_LINE.test(message)) {
    return SetupStepStatus.Completed;
  } else if (item.status === SetupStepStatus.Running && inFlight && latest) {
    return SetupStepStatus.Running;
  } else {
    return SetupStepStatus.Completed;
  }
}

export function registrationProgressLines(progress: SetupProgress[]): SetupProgress[] {
  const collapsed = (progress || [])
    .filter(item => !NOISE_LINE.test(item.message || ""))
    .reduce((lines, item) => {
      const previous = lines[lines.length - 1];
      const repeated = !!previous && registrationLineText(previous) === registrationLineText(item);
      return repeated ? [...lines.slice(0, -1), item] : [...lines, item];
    }, [] as SetupProgress[]);
  return reversed(collapsed);
}

function registrationLineText(item: SetupProgress): string {
  return sanitiseRegistrationMessage(item.message || item.step);
}

export function registrationFailureMessage(stage: string, message: string): string {
  return `Failed while ${stage}: ${message}`;
}
