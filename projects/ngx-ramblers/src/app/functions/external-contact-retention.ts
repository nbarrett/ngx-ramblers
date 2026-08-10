import {
  ExternalContactRetentionReview,
  ExternalContactRetentionStatus,
  ExternalRecipient
} from "../models/external-recipient.model";
import { isNumber } from "es-toolkit/compat";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export function externalContactRetentionConfigured(retentionDays: number | null | undefined): boolean {
  return isNumber(retentionDays) && retentionDays > 0;
}

export function externalContactLastActivity(contact: ExternalRecipient): number {
  return Math.max(contact.createdAt ?? 0, contact.updatedAt ?? 0, contact.lastUsedAt ?? 0);
}

export function externalContactLinkCount(contact: ExternalRecipient): number {
  return [contact.parishCodes, contact.localAuthorityCodes, contact.sectorCodes, contact.rightsOfWayGroupCodes]
    .reduce((total, codes) => total + (codes ?? []).length, 0);
}

export function externalContactRetentionReview(contact: ExternalRecipient, retentionDays: number, now: number): ExternalContactRetentionReview {
  if (contact.supporterId) {
    return {contact, status: ExternalContactRetentionStatus.LINKED_TO_SUPPORTER, reason: "Linked to a supporter record"};
  } else if (externalContactLinkCount(contact) > 0) {
    return {contact, status: ExternalContactRetentionStatus.RETAINED, reason: "Has parish, authority, sector or group links"};
  } else if (externalContactRetentionConfigured(retentionDays) && now - externalContactLastActivity(contact) > retentionDays * DAY_MILLISECONDS) {
    return {contact, status: ExternalContactRetentionStatus.STALE, reason: `No parish, authority or group links and not updated within the retention window of ${retentionDays} days`};
  } else {
    return {contact, status: ExternalContactRetentionStatus.RETAINED, reason: "Updated within the retention window"};
  }
}

export function externalContactRetentionReviews(contacts: ExternalRecipient[], retentionDays: number, now: number): ExternalContactRetentionReview[] {
  return contacts.map(contact => externalContactRetentionReview(contact, retentionDays, now));
}

export function staleExternalContacts(contacts: ExternalRecipient[], retentionDays: number, now: number): ExternalRecipient[] {
  return externalContactRetentionReviews(contacts, retentionDays, now)
    .filter(review => review.status === ExternalContactRetentionStatus.STALE)
    .map(review => review.contact);
}
