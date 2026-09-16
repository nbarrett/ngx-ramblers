import {
  REGISTRATION_HISTORY_LABELS,
  REGISTRATION_STAGE_LABELS,
  RegistrationBuildSpan,
  RegistrationHistoryAction,
  RegistrationHistoryEntry,
  RegistrationHistoryRow,
  RegistrationPlan,
  RegistrationStage,
  RegistrationStageKey,
  RegistrationStageStatus,
  RegistrationState,
  StoredSiteRegistration
} from "../models/site-registration.model";

const BUILD_STARTS = [RegistrationHistoryAction.SUBMITTED, RegistrationHistoryAction.RUN_AGAIN];
const BUILD_ENDS = [RegistrationHistoryAction.READY_FOR_REVIEW, RegistrationHistoryAction.FAILED, RegistrationHistoryAction.STOPPED];

export function registrationHistoryRows(history: RegistrationHistoryEntry[]): RegistrationHistoryRow[] {
  const ordered = [...(history || [])].sort((left, right) => left.at - right.at);
  return ordered.map((entry, index) => ({
    label: REGISTRATION_HISTORY_LABELS[entry.action] || entry.action,
    at: entry.at,
    by: entry.by,
    sincePrevious: index > 0 ? entry.at - ordered[index - 1].at : null
  }));
}

export function latestBuildSpan(history: RegistrationHistoryEntry[], now: number): RegistrationBuildSpan | null {
  const ordered = [...(history || [])].sort((left, right) => left.at - right.at);
  const start = [...ordered].reverse().find(entry => BUILD_STARTS.includes(entry.action));
  const end = start ? ordered.find(entry => entry.at >= start.at && BUILD_ENDS.includes(entry.action)) : null;
  return start ? {from: start.at, to: end ? end.at : now, finished: !!end} : null;
}

const RUNNING_STATES = [RegistrationState.QUEUED, RegistrationState.PROVISIONING, RegistrationState.IMPORTING, RegistrationState.APPROVING];
const FAILED_STATES = [RegistrationState.FAILED, RegistrationState.BROKEN];
const REVIEW_REACHED_STATES = [RegistrationState.REVIEW, RegistrationState.APPROVING, RegistrationState.COMPLETE];
const NOT_SUBMITTED_STATES = [RegistrationState.AWAITING_EMAIL, RegistrationState.DRAFT];

type RegistrationMilestones = Pick<StoredSiteRegistration, "plan" | "state" | "verifiedAt" | "provisionedAt" | "walksLoadedAt" | "importedAt">;

export function registrationStages(registration: RegistrationMilestones): RegistrationStage[] {
  const submitted = !NOT_SUBMITTED_STATES.includes(registration.state);
  const milestones = [
    {key: RegistrationStageKey.EMAIL_CONFIRMED, done: !!registration.verifiedAt || submitted},
    {key: RegistrationStageKey.SUBMITTED, done: submitted},
    {key: RegistrationStageKey.SITE_CREATED, done: !!registration.provisionedAt},
    {key: RegistrationStageKey.WALKS_LOADED, done: !!registration.walksLoadedAt},
    ...(registration.plan === RegistrationPlan.FULL ? [{key: RegistrationStageKey.PAGES_IMPORTED, done: !!registration.importedAt}] : []),
    {key: RegistrationStageKey.READY_FOR_REVIEW, done: REVIEW_REACHED_STATES.includes(registration.state)},
    {key: RegistrationStageKey.GROUP_INVITED, done: registration.state === RegistrationState.COMPLETE}
  ];
  const current = milestones.findIndex(milestone => !milestone.done);
  const currentStatus = RUNNING_STATES.includes(registration.state) && registration.state !== RegistrationState.QUEUED ? RegistrationStageStatus.RUNNING
    : FAILED_STATES.includes(registration.state) ? RegistrationStageStatus.FAILED
      : RegistrationStageStatus.WAITING;
  return milestones.map((milestone, index) => {
    const status = milestone.done ? RegistrationStageStatus.DONE : index === current ? currentStatus : RegistrationStageStatus.PENDING;
    return {key: milestone.key, status, label: registrationStageLabel(milestone.key, status)};
  });
}

export function registrationStageLabel(key: RegistrationStageKey, status: RegistrationStageStatus): string {
  const labels = REGISTRATION_STAGE_LABELS[key];
  if (status === RegistrationStageStatus.RUNNING || status === RegistrationStageStatus.FAILED) {
    return labels.running;
  } else if (status === RegistrationStageStatus.WAITING) {
    return labels.waiting;
  } else {
    return labels.done;
  }
}
