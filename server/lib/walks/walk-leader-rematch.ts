import debug from "debug";
import { ExtendedGroupEvent, InputSource } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import {
  contactDetailsForLeaderRematch,
  leaderMatchResult,
  shouldAutoLinkLeaderMatch
} from "../../../projects/ngx-ramblers/src/app/functions/walks/walk-leader-member-match";
import { WalkLeaderBulkRematchSummary } from "../../../projects/ngx-ramblers/src/app/models/walk-leader-match.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { WalksConfig } from "../../../projects/ngx-ramblers/src/app/models/walks-config.model";
import { queryKey } from "../mongo/controllers/config";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow } from "../shared/dates";
import { membersForLeaderMatching, priorMatchesForLeaderMatching } from "./walks-manager-cache";

const debugLog = debug(envConfig.logNamespace("walk-leader-rematch"));
debugLog.enabled = true;

const REMATCH_DEBOUNCE_MILLISECONDS = 30 * 1000;
let pendingRematchTimer: NodeJS.Timeout | null = null;
let rematchRunning = false;

export function scheduleWalkLeaderRematch(trigger: string): void {
  if (pendingRematchTimer) {
    clearTimeout(pendingRematchTimer);
  }
  debugLog("scheduleWalkLeaderRematch:trigger:", trigger, "running in", REMATCH_DEBOUNCE_MILLISECONDS, "ms unless further member changes arrive");
  pendingRematchTimer = setTimeout(() => {
    pendingRematchTimer = null;
    if (rematchRunning) {
      scheduleWalkLeaderRematch(trigger);
    } else {
      runScheduledRematch(trigger);
    }
  }, REMATCH_DEBOUNCE_MILLISECONDS);
  pendingRematchTimer.unref();
}

async function runScheduledRematch(trigger: string): Promise<void> {
  try {
    if (await rematchOnMemberChangeEnabled()) {
      const summary = await rematchWalkLeaders(trigger);
      debugLog("scheduled rematch complete:", summary);
    } else {
      debugLog("scheduled rematch skipped: automatic walk leader re-match is switched off in walks config");
    }
  } catch (error) {
    debugLog("scheduled rematch failed:", error);
  }
}

async function rematchOnMemberChangeEnabled(): Promise<boolean> {
  const walksConfig: WalksConfig = (await queryKey(ConfigKey.WALKS))?.value;
  return walksConfig?.rematchWalkLeadersOnMemberChange !== false;
}

export async function rematchWalkLeaders(trigger: string): Promise<WalkLeaderBulkRematchSummary> {
  rematchRunning = true;
  try {
    const notManuallyCreated = {[EventField.INPUT_SOURCE]: {$ne: InputSource.MANUALLY_CREATED}};
    const unlinkedCriteria = {...notManuallyCreated, [EventField.CONTACT_DETAILS_MEMBER_ID]: {$in: [null, ""]}};
    const [members, priorMatches, alreadyLinked, unlinkedEvents] = await Promise.all([
      membersForLeaderMatching(),
      priorMatchesForLeaderMatching(),
      extendedGroupEvent.countDocuments({...notManuallyCreated, [EventField.CONTACT_DETAILS_MEMBER_ID]: {$nin: [null, ""]}}).exec(),
      extendedGroupEvent.find(unlinkedCriteria, {
        [EventField.CONTACT_DETAILS]: 1,
        "fields.publishing": 1,
        "groupEvent.walk_leader": 1
      }).lean().exec() as Promise<(ExtendedGroupEvent & {_id: unknown})[]>
    ]);
    debugLog("rematchWalkLeaders:trigger:", trigger, "members:", members.length, "priorMatches:", priorMatches.length, "alreadyLinked:", alreadyLinked, "eventsWithoutLeaderLink:", unlinkedEvents.length);
    const outcomes = await Promise.all(unlinkedEvents.map(async event => {
      const contactDetails = contactDetailsForLeaderRematch(event);
      const nothingToMatchOn = !contactDetails.displayName && !contactDetails.email && !contactDetails.phone && !contactDetails.contactId;
      if (nothingToMatchOn) {
        return "noNameToMatchOn";
      }
      const match = leaderMatchResult(members, contactDetails, priorMatches);
      if (shouldAutoLinkLeaderMatch(match)) {
        await extendedGroupEvent.updateOne(
          {_id: event._id},
          {$set: {[EventField.CONTACT_DETAILS_MEMBER_ID]: match.member.id}}
        ).exec();
        return "matched";
      }
      return "unmatchedWithName";
    }));
    const summary: WalkLeaderBulkRematchSummary = {
      eventsWithoutLeaderLink: unlinkedEvents.length,
      matched: outcomes.filter(outcome => outcome === "matched").length,
      unmatchedWithName: outcomes.filter(outcome => outcome === "unmatchedWithName").length,
      noNameToMatchOn: outcomes.filter(outcome => outcome === "noNameToMatchOn").length,
      alreadyLinked,
      completedAt: dateTimeNow().toISO(),
      trigger
    };
    debugLog("rematchWalkLeaders:summary:", summary);
    return summary;
  } finally {
    rematchRunning = false;
  }
}
