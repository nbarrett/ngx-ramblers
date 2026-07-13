import debug from "debug";
import { ExtendedGroupEvent, InputSource } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { EventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import {
  contactDetailsForLeaderRematch,
  contactDetailsWithLeaderMatch,
  leaderMatchResult,
  memberContactDetailsForLeaderMatch,
  shouldAutoLinkLeaderMatch
} from "../../../projects/ngx-ramblers/src/app/functions/walks/walk-leader-member-match";
import { PriorContactMemberMatch, WalkLeaderBulkRematchSummary } from "../../../projects/ngx-ramblers/src/app/models/walk-leader-match.model";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { WalksConfig } from "../../../projects/ngx-ramblers/src/app/models/walks-config.model";
import { memberFullName, trimmedNamePart } from "../../../projects/ngx-ramblers/src/app/functions/member-names";
import { queryKey } from "../mongo/controllers/config";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { memberBulkLoadAudit } from "../mongo/models/member-bulk-load-audit";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { membersForLeaderMatching, priorMatchesForLeaderMatching } from "./walks-manager-cache";
import { cloneDeep, keys, set } from "es-toolkit/compat";
import { systemWalkDetailsUpdatedEvent, walkEventSnapshotEvent } from "../../../projects/ngx-ramblers/src/app/functions/walks/walk-event-snapshot";
import { EventType } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";

const debugLog = debug(envConfig.logNamespace("walk-leader-rematch"));
debugLog.enabled = true;

async function updateWalkAndRecordEvent(event: ExtendedGroupEvent & {_id: unknown}, criteria: object, fieldsToSet: Record<string, unknown>, reason: string): Promise<void> {
  const updatedEvent = cloneDeep(event);
  keys(fieldsToSet).forEach(fieldName => set(updatedEvent, fieldName, fieldsToSet[fieldName]));
  const updateDate = dateTimeNowAsValue();
  const historyEvent = systemWalkDetailsUpdatedEvent(updatedEvent, updateDate, reason);
  const historyEvents = event.events?.length > 0
    ? [historyEvent]
    : [
      walkEventSnapshotEvent(event, EventType.APPROVED, updateDate - 1, "system", "Baseline captured before automatic walk leader update"),
      historyEvent
    ];
  await extendedGroupEvent.updateOne(
    {_id: event._id, ...criteria},
    {$set: fieldsToSet, $push: {events: {$each: historyEvents}}}
  ).exec();
}

export async function rematchWalkLeadersAfterMemberChange(trigger: string, uploadSessionId: string | null = null): Promise<WalkLeaderBulkRematchSummary | null> {
  if (await rematchOnMemberChangeEnabled()) {
    const summary = await rematchWalkLeaders(trigger);
    await appendRematchSummaryToUpload(uploadSessionId, summary);
    return summary;
  } else {
    debugLog("rematch skipped: automatic walk leader matching is switched off in walks config");
    return null;
  }
}

async function appendRematchSummaryToUpload(uploadSessionId: string | null, summary: WalkLeaderBulkRematchSummary): Promise<void> {
  if (uploadSessionId) {
    const message = `Walk leader matching completed: ${summary.matched} newly matched, ${summary.contactDetailsRefreshed} linked events refreshed, ${summary.unmatchedWithName} unmatched with leader details, and ${summary.noNameToMatchOn} with no leader details`;
    await memberBulkLoadAudit.updateOne(
      {_id: uploadSessionId},
      {$push: {auditLog: {status: "complete", message}}}
    ).exec();
  }
}

async function rematchOnMemberChangeEnabled(): Promise<boolean> {
  const walksConfig: WalksConfig = (await queryKey(ConfigKey.WALKS))?.value;
  return walksConfig?.rematchWalkLeadersOnMemberChange !== false;
}

async function rematchSelectedEvents(members: Member[], priorMatches: PriorContactMemberMatch[], linkedEvents: (ExtendedGroupEvent & {_id: unknown})[], unlinkedEvents: (ExtendedGroupEvent & {_id: unknown})[], trigger: string): Promise<WalkLeaderBulkRematchSummary> {
  const membersById = new Map(members.map(existingMember => [String(existingMember.id), existingMember]));
  const refreshedContactDetails = await Promise.all(linkedEvents.map(async event => {
    const existingMemberId = event.fields.contactDetails.memberId;
    const existingMember = membersById.get(String(existingMemberId));
    const contactEmail = trimmedNamePart(event.fields.contactDetails.email);
    const currentContactId = trimmedNamePart(event.fields.contactDetails.contactId);
    const currentContactName = trimmedNamePart(event.fields.publishing?.ramblers?.contactName);
    const expectedContactName = memberFullName(existingMember);
    const refreshEmail = /^https?:\/\//i.test(contactEmail);
    const refreshContactName = !!expectedContactName && (currentContactName !== expectedContactName || currentContactId !== expectedContactName);
    if (existingMember && (refreshEmail || refreshContactName)) {
      const matchedContactDetails = contactDetailsWithLeaderMatch(event.fields.contactDetails, existingMember);
      const fieldsToSet = refreshEmail ? {
        [EventField.CONTACT_DETAILS_EMAIL]: matchedContactDetails.email
      } : {};
      const contactNameFieldsToSet = refreshContactName ? {
        [EventField.CONTACT_DETAILS_CONTACT_ID]: expectedContactName,
        [EventField.PUBLISHING_RAMBLERS_CONTACT_NAME]: expectedContactName
      } : {};
      await updateWalkAndRecordEvent(
        event,
        {[EventField.CONTACT_DETAILS_MEMBER_ID]: existingMemberId},
        {...fieldsToSet, ...contactNameFieldsToSet},
        "Walk leader contact details automatically refreshed from Member Admin"
      );
    }
    return !!existingMember && (refreshEmail || refreshContactName);
  }));
  const outcomes = await Promise.all(unlinkedEvents.map(async event => {
    const contactDetails = contactDetailsForLeaderRematch(event);
    const nothingToMatchOn = !contactDetails.displayName && !contactDetails.email && !contactDetails.phone && !contactDetails.contactId;
    if (nothingToMatchOn) {
      return "noNameToMatchOn";
    }
    const match = leaderMatchResult(members, contactDetails, priorMatches);
    if (shouldAutoLinkLeaderMatch(match)) {
      const matchedContactDetails = contactDetailsWithLeaderMatch(event.fields.contactDetails, match.member);
      const walksManagerContactName = memberFullName(match.member);
      const currentEmail = trimmedNamePart(event.fields.contactDetails.email);
      const invalidEmailFields = /^https?:\/\//i.test(currentEmail) ? {
        [EventField.CONTACT_DETAILS_EMAIL]: matchedContactDetails.email
      } : {};
      await updateWalkAndRecordEvent(
        event,
        {[EventField.CONTACT_DETAILS_MEMBER_ID]: {$in: [null, ""]}},
        {
          [EventField.CONTACT_DETAILS_MEMBER_ID]: matchedContactDetails.memberId,
          [EventField.CONTACT_DETAILS_CONTACT_ID]: walksManagerContactName,
          [EventField.PUBLISHING_RAMBLERS_CONTACT_NAME]: walksManagerContactName,
          ...invalidEmailFields
        },
        "Walk leader automatically matched to Member Admin"
      );
      return "matched";
    }
    return "unmatchedWithName";
  }));
  const summary: WalkLeaderBulkRematchSummary = {
    eventsWithoutLeaderLink: unlinkedEvents.length,
    matched: outcomes.filter(outcome => outcome === "matched").length,
    contactDetailsRefreshed: refreshedContactDetails.filter(Boolean).length,
    unmatchedWithName: outcomes.filter(outcome => outcome === "unmatchedWithName").length,
    noNameToMatchOn: outcomes.filter(outcome => outcome === "noNameToMatchOn").length,
    alreadyLinked: linkedEvents.length,
    completedAt: dateTimeNow().toISO(),
    trigger
  };
  debugLog("rematchSelectedEvents:summary:", summary);
  return summary;
}

export async function rematchWalkLeaders(trigger: string): Promise<WalkLeaderBulkRematchSummary> {
  const walksManagerCache = {[EventField.INPUT_SOURCE]: InputSource.WALKS_MANAGER_CACHE};
  const unlinkedCriteria = {...walksManagerCache, [EventField.CONTACT_DETAILS_MEMBER_ID]: {$in: [null, ""]}};
  const linkedCriteria = {...walksManagerCache, [EventField.CONTACT_DETAILS_MEMBER_ID]: {$nin: [null, ""]}};
  const [members, priorMatches, unlinkedEvents, linkedEvents] = await Promise.all([
    membersForLeaderMatching(),
    priorMatchesForLeaderMatching(),
    extendedGroupEvent.find(unlinkedCriteria).lean().exec() as Promise<(ExtendedGroupEvent & {_id: unknown})[]>,
    extendedGroupEvent.find(linkedCriteria).lean().exec() as Promise<(ExtendedGroupEvent & {_id: unknown})[]>
  ]);
  debugLog("rematchWalkLeaders:trigger:", trigger, "members:", members.length, "priorMatches:", priorMatches.length, "alreadyLinked:", linkedEvents.length, "eventsWithoutLeaderLink:", unlinkedEvents.length);
  return rematchSelectedEvents(members, priorMatches, linkedEvents, unlinkedEvents, trigger);
}
