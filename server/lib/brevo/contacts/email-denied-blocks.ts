import { BrevoClient } from "@getbrevo/brevo";
import {
  BlockedContact,
  BlockedContactReasonCode
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { scheduleBrevo } from "../common/rate-limiting";

const CONTACT_PAGE_LIMIT = 1000;

export function blockedAtWithinRange(
  blockedAtIso: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined
): boolean {
  const noRange = !startDate && !endDate;
  const blockedMs = blockedAtIso ? Date.parse(blockedAtIso) : NaN;
  const hasBlockedAt = Number.isFinite(blockedMs);
  const startMs = startDate ? Date.parse(startDate) : NaN;
  const endMs = endDate ? Date.parse(endDate) : NaN;
  const afterStart = !Number.isFinite(startMs) || (hasBlockedAt && blockedMs >= startMs);
  const beforeEnd = !Number.isFinite(endMs) || (hasBlockedAt && blockedMs <= endMs + 24 * 3600 * 1000 - 1);
  return noRange || (hasBlockedAt && afterStart && beforeEnd);
}

export function blockedContactFromDeniedBrevoContact(contact: {
  email?: string;
  id?: number;
  listIds?: number[];
  emailBlacklisted?: boolean;
  createdAt?: string;
  modifiedAt?: string;
}): BlockedContact | null {
  const blockedAt = contact?.modifiedAt || contact?.createdAt;
  const eligible = !!(contact?.emailBlacklisted && contact.email && blockedAt);
  return eligible
    ? {
        email: contact.email as string,
        senderEmail: "",
        reason: {
          code: BlockedContactReasonCode.EMAIL_DENIED,
          message: "Global email denied on the Brevo contact"
        },
        blockedAt: blockedAt as string,
        listIds: contact.listIds ?? [],
        emailBlocked: true,
        brevoContactId: Number.isFinite(contact.id) ? contact.id : undefined
      }
    : null;
}

async function fetchEmailDeniedContactsPage(
  client: BrevoClient,
  excludeEmails: Set<string>,
  startDate: string | undefined,
  endDate: string | undefined,
  offset: number,
  accumulated: BlockedContact[]
): Promise<BlockedContact[]> {
  const response = await scheduleBrevo(() => client.contacts.getContacts({
    limit: CONTACT_PAGE_LIMIT,
    offset
  }));
  const page = response?.contacts ?? [];
  const pageDenied = page
    .map(contact => blockedContactFromDeniedBrevoContact(contact as {
      email?: string;
      id?: number;
      listIds?: number[];
      emailBlacklisted?: boolean;
      createdAt?: string;
      modifiedAt?: string;
    }))
    .filter((mapped): mapped is BlockedContact =>
      !!mapped
      && !excludeEmails.has(mapped.email.toLowerCase())
      && blockedAtWithinRange(mapped.blockedAt, startDate, endDate)
    );
  const next = [...accumulated, ...pageDenied];
  return page.length < CONTACT_PAGE_LIMIT
    ? next
    : fetchEmailDeniedContactsPage(
      client,
      excludeEmails,
      startDate,
      endDate,
      offset + page.length,
      next
    );
}

export async function fetchEmailDeniedContacts(
  client: BrevoClient,
  excludeEmails: Set<string>,
  startDate: string | undefined,
  endDate: string | undefined
): Promise<BlockedContact[]> {
  return fetchEmailDeniedContactsPage(client, excludeEmails, startDate, endDate, 0, []);
}

export function mergeBlockedContactLists(
  primary: BlockedContact[],
  extra: BlockedContact[]
): BlockedContact[] {
  const seen = new Set(
    primary.map(contact => (contact.email || "").toLowerCase()).filter(Boolean)
  );
  const additions = extra.filter(contact => {
    const email = (contact.email || "").toLowerCase();
    const isNew = !!email && !seen.has(email);
    if (isNew) {
      seen.add(email);
    }
    return isNew;
  });
  return [...primary, ...additions];
}

export interface DenialHistoryHint {
  reasonCode: BlockedContactReasonCode;
  eventTime: string;
  campaignId?: number;
}

interface ContactStatisticsSlice {
  complaints?: {campaignId?: number; eventTime?: string}[];
  hardBounces?: {campaignId?: number; eventTime?: string}[];
  unsubscriptions?: {
    userUnsubscription?: {campaignId?: number; eventTime?: string}[];
    adminUnsubscription?: {eventTime?: string}[];
  };
}

function eventMs(eventTime: string | undefined): number {
  const parsed = eventTime ? Date.parse(eventTime) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestHint(candidates: DenialHistoryHint[]): DenialHistoryHint | null {
  return candidates.length === 0
    ? null
    : candidates.reduce((best, candidate) =>
      eventMs(candidate.eventTime) > eventMs(best.eventTime) ? candidate : best
    );
}

export function denialHintFromContactStatistics(
  statistics: ContactStatisticsSlice | undefined
): DenialHistoryHint | null {
  const complaints = (statistics?.complaints || [])
    .filter(item => !!item.eventTime)
    .map(item => ({
      reasonCode: BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM,
      eventTime: item.eventTime as string,
      campaignId: item.campaignId
    }));
  const hardBounces = (statistics?.hardBounces || [])
    .filter(item => !!item.eventTime)
    .map(item => ({
      reasonCode: BlockedContactReasonCode.HARD_BOUNCE,
      eventTime: item.eventTime as string,
      campaignId: item.campaignId
    }));
  const userUnsubs = (statistics?.unsubscriptions?.userUnsubscription || [])
    .filter(item => !!item.eventTime)
    .map(item => ({
      reasonCode: BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL,
      eventTime: item.eventTime as string,
      campaignId: item.campaignId
    }));
  const adminUnsubs = (statistics?.unsubscriptions?.adminUnsubscription || [])
    .filter(item => !!item.eventTime)
    .map(item => ({
      reasonCode: BlockedContactReasonCode.UNSUBSCRIBED_VIA_API,
      eventTime: item.eventTime as string
    }));
  const all = [...complaints, ...hardBounces, ...userUnsubs, ...adminUnsubs];
  const latestTime = all.length > 0 ? Math.max(...all.map(hint => eventMs(hint.eventTime))) : 0;
  const nearLatest = all.filter(hint => latestTime - eventMs(hint.eventTime) <= 5 * 60 * 1000);
  const preferred = [
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM)),
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.HARD_BOUNCE)),
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL)),
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.UNSUBSCRIBED_VIA_API))
  ].find((hint): hint is DenialHistoryHint => !!hint);
  return all.length === 0 ? null : (preferred || latestHint(all));
}

export function applyDenialHintToBlockedContact(
  contact: BlockedContact,
  hint: DenialHistoryHint | null,
  campaign?: {subject?: string; name?: string; senderEmail?: string; senderName?: string} | null,
  detail?: string | null
): BlockedContact {
  const subject = campaign?.subject || campaign?.name;
  const reasonMessage = subject || contact.reason?.message || undefined;
  return hint
    ? {
        ...contact,
        blockedAt: hint.eventTime || contact.blockedAt,
        senderEmail: campaign?.senderEmail || contact.senderEmail || "",
        senderName: campaign?.senderName || contact.senderName,
        detail: detail || contact.detail,
        emailBlocked: true,
        reason: {
          code: hint.reasonCode,
          message: reasonMessage
        }
      }
    : contact;
}

export function relatedDenialDetail(
  primary: DenialHistoryHint | null,
  ...hints: (DenialHistoryHint | null | undefined)[]
): string | undefined {
  const primaryMs = primary ? eventMs(primary.eventTime) : 0;
  const related = primary
    ? hints
      .filter((hint): hint is DenialHistoryHint =>
        !!hint
        && hint.reasonCode !== primary.reasonCode
        && Math.abs(eventMs(hint.eventTime) - primaryMs) <= 5 * 60 * 1000
      )
      .map(hint => {
        const label = hint.reasonCode === BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM
          ? "Flagged as spam"
          : hint.reasonCode === BlockedContactReasonCode.HARD_BOUNCE
            ? "Hard bounce"
            : hint.reasonCode === BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL
              ? "Unsubscribed"
              : hint.reasonCode === BlockedContactReasonCode.UNSUBSCRIBED_VIA_API
                ? "Unsubscribed by admin"
                : hint.reasonCode === BlockedContactReasonCode.ADMIN_BLOCKED
                  ? "Blocked"
                  : null;
        return label ? `${label} at ${hint.eventTime}` : null;
      })
      .filter((line): line is string => !!line)
    : [];
  return related.length > 0 ? related.join(" · ") : undefined;
}

export function denialHintFromTransactionalEvents(
  events: {event?: string; date?: string; subject?: string; from?: string}[] | undefined
): DenialHistoryHint | null {
  const mapped: DenialHistoryHint[] = (events || [])
    .filter(item => !!item.date && !!item.event)
    .map(item => {
      const event = String(item.event).toLowerCase();
      const reasonCode = event === "spam" || event === "complaint"
        ? BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM
        : event === "hardbounces" || event === "hard_bounce" || event === "bounces"
          ? BlockedContactReasonCode.HARD_BOUNCE
          : event === "blocked"
            ? BlockedContactReasonCode.ADMIN_BLOCKED
            : event === "unsubscribed"
              ? BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL
              : null;
      return reasonCode
        ? {reasonCode, eventTime: item.date as string}
        : null;
    })
    .filter((hint): hint is DenialHistoryHint => !!hint);
  return preferredDenialHint(...mapped);
}

export function mergeDenialHints(
  ...hints: (DenialHistoryHint | null | undefined)[]
): DenialHistoryHint | null {
  return latestHint(hints.filter((hint): hint is DenialHistoryHint => !!hint));
}

export function preferredDenialHint(
  ...hints: (DenialHistoryHint | null | undefined)[]
): DenialHistoryHint | null {
  const present = hints.filter((hint): hint is DenialHistoryHint => !!hint);
  const latestTime = present.length > 0 ? Math.max(...present.map(hint => eventMs(hint.eventTime))) : 0;
  const nearLatest = present.filter(hint => latestTime - eventMs(hint.eventTime) <= 5 * 60 * 1000);
  const ordered = [
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM)),
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.HARD_BOUNCE)),
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.ADMIN_BLOCKED)),
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.UNSUBSCRIBED_VIA_EMAIL)),
    latestHint(nearLatest.filter(hint => hint.reasonCode === BlockedContactReasonCode.UNSUBSCRIBED_VIA_API))
  ].find((hint): hint is DenialHistoryHint => !!hint);
  return present.length === 0 ? null : (ordered || latestHint(present));
}
