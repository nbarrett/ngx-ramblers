import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import http from "http";
import { isArray, isNumber, isString, keys } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { dateTimeFromMillis } from "../../shared/dates";
import { createBottleneckWithRatePerSecond } from "../common/rate-limiting";
import { member } from "../../mongo/models/member";
import { mailListAudit } from "../../mongo/models/mail-list-audit";
import {
  BLOCKED_CONTACT_REASON_LABELS,
  BlockedContact,
  BlockedContactMemberMatch,
  BlockedContactReasonCode,
  BlockedContactsResponse,
  ClearAllBlocklistResult,
  MailListAuditListType,
  MailListAuditSource,
  SalesforceWritebackStatus,
  UnsubscribeActivity,
  UnsubscribeActivityResponse,
  UnsubscribeHistoryEntry
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { SortDirection } from "../../../../projects/ngx-ramblers/src/app/models/sort.model";
import { AuditStatus } from "../../../../projects/ngx-ramblers/src/app/models/audit";

const messageType = "brevo:unsubscribes";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const BREVO_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 100;
const MAX_FETCH_LIMIT = 1000;
const CONTACT_INFO_RATE_PER_SECOND = 10;

function parsePositiveInt(value: any, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSort(value: any): "asc" | "desc" {
  return value === SortDirection.ASC ? "asc" : "desc";
}

function parseSenders(value: any): string[] | undefined {
  if (!value) return undefined;
  if (isArray(value)) {
    const trimmed = value.map(entry => String(entry).trim()).filter(entry => entry.length > 0);
    return trimmed.length > 0 ? trimmed : undefined;
  }
  const stringValue = String(value).trim();
  if (stringValue.startsWith("[")) {
    try {
      const parsed = JSON.parse(stringValue);
      if (isArray(parsed)) {
        const fromJson = parsed.map(entry => String(entry).trim()).filter(entry => entry.length > 0);
        return fromJson.length > 0 ? fromJson : undefined;
      }
    } catch {
      // fall through to comma-separated parse
    }
  }
  const senders = stringValue.split(",").map(entry => entry.trim()).filter(entry => entry.length > 0);
  return senders.length > 0 ? senders : undefined;
}

async function fetchBlockedContactsPage(
  apiInstance: SibApiV3Sdk.TransactionalEmailsApi,
  startDate: string | undefined,
  endDate: string | undefined,
  senders: string[] | undefined,
  sort: "asc" | "desc",
  limit: number,
  offset: number
): Promise<{ contacts: BlockedContact[]; totalCount: number }> {
  const response: { response: http.IncomingMessage, body: any } = await apiInstance.getTransacBlockedContacts(
    startDate,
    endDate,
    limit,
    offset,
    senders,
    sort
  );
  const body = response.body || {};
  return {
    contacts: body.contacts || [],
    totalCount: body.count ?? 0
  };
}

interface AggregatedBlockedContacts {
  contacts: BlockedContact[];
  totalCount: number;
}

async function fetchAllBlockedContacts(
  apiInstance: SibApiV3Sdk.TransactionalEmailsApi,
  startDate: string | undefined,
  endDate: string | undefined,
  senders: string[] | undefined,
  sort: "asc" | "desc",
  requestedLimit: number,
  startOffset: number,
  accumulator: AggregatedBlockedContacts = { contacts: [], totalCount: 0 }
): Promise<AggregatedBlockedContacts> {
  if (accumulator.contacts.length >= requestedLimit) {
    return accumulator;
  }
  const pageLimit = Math.min(BREVO_PAGE_LIMIT, requestedLimit - accumulator.contacts.length);
  const page = await fetchBlockedContactsPage(apiInstance, startDate, endDate, senders, sort, pageLimit, startOffset);
  const nextAccumulator: AggregatedBlockedContacts = {
    contacts: [...accumulator.contacts, ...page.contacts],
    totalCount: page.totalCount || accumulator.totalCount
  };
  if (page.contacts.length === 0 || page.contacts.length < pageLimit) {
    return nextAccumulator;
  }
  return fetchAllBlockedContacts(
    apiInstance,
    startDate,
    endDate,
    senders,
    sort,
    requestedLimit,
    startOffset + page.contacts.length,
    nextAccumulator
  );
}

async function enrichWithMemberMatches(contacts: BlockedContact[]): Promise<BlockedContact[]> {
  const emails = [...new Set(contacts.map(contact => contact.email).filter(Boolean))];
  if (emails.length === 0) {
    return contacts;
  }
  try {
    const lowercaseEmails = emails.map(email => email.toLowerCase());
    const matches = await member.find(
      { email: { $in: lowercaseEmails } },
      { email: 1, membershipNumber: 1, displayName: 1, firstName: 1, lastName: 1 }
    ).lean().exec() as any[];
    const memberByEmail = new Map<string, BlockedContactMemberMatch>();
    matches.forEach(matchedMember => {
      const matchEmail = (matchedMember.email || "").toLowerCase();
      if (!matchEmail) return;
      memberByEmail.set(matchEmail, {
        id: matchedMember.id || matchedMember._id?.toString(),
        membershipNumber: matchedMember.membershipNumber,
        displayName: matchedMember.displayName,
        firstName: matchedMember.firstName,
        lastName: matchedMember.lastName
      });
    });
    return contacts.map(contact => {
      const match = memberByEmail.get((contact.email || "").toLowerCase());
      const salesforceWriteback = match?.membershipNumber
        ? { status: SalesforceWritebackStatus.PENDING }
        : { status: SalesforceWritebackStatus.NOT_APPLICABLE };
      return { ...contact, matchedMember: match, salesforceWriteback };
    });
  } catch (error) {
    debugLog("enrichWithMemberMatches:error:", error);
    return contacts;
  }
}

async function enrichWithContactInfo(
  contactsApi: SibApiV3Sdk.ContactsApi,
  contacts: BlockedContact[]
): Promise<BlockedContact[]> {
  if (contacts.length === 0) return contacts;
  const limiter = createBottleneckWithRatePerSecond(CONTACT_INFO_RATE_PER_SECOND);
  const lookups = contacts.map(contact => limiter.schedule(async () => {
    if (!contact.email) return contact;
    try {
      const response: { response: http.IncomingMessage, body: any } = await contactsApi.getContactInfo(contact.email);
      const body = response.body || {};
      return {
        ...contact,
        listIds: body.listIds || [],
        emailBlocked: !!body.emailBlacklisted,
        brevoContactId: isNumber(body.id) ? body.id : undefined
      };
    } catch (error: any) {
      debugLog("enrichWithContactInfo:lookup-failed", contact.email, error?.response?.statusCode || error?.message || error);
      return contact;
    }
  }));
  return Promise.all(lookups);
}

function reasonToAuditStatus(code: string | undefined): AuditStatus {
  if (
    code === BlockedContactReasonCode.HARD_BOUNCE
    || code === BlockedContactReasonCode.CONTACT_FLAGGED_AS_SPAM
    || code === BlockedContactReasonCode.ADMIN_BLOCKED
  ) {
    return AuditStatus.error;
  }
  return AuditStatus.warning;
}

function blockedAtToTimestamp(blockedAt: string | undefined): number {
  if (!blockedAt) return Date.now();
  const parsed = Date.parse(blockedAt);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function buildAuditMessage(contact: BlockedContact, listName: string | undefined): string {
  const reasonLabel = BLOCKED_CONTACT_REASON_LABELS[contact.reason?.code as string] || contact.reason?.code || "blocked";
  const listText = listName ? ` from ${listName} list` : "";
  const senderText = contact.senderEmail ? ` (Brevo sender: ${contact.senderEmail})` : "";
  return `${reasonLabel}${listText}${senderText}`;
}

async function loadBrevoListNames(contactsApi: SibApiV3Sdk.ContactsApi): Promise<Map<number, string>> {
  const namesById = new Map<number, string>();
  try {
    const response: { response: http.IncomingMessage, body: any } = await contactsApi.getLists(50, 0);
    const lists = (response.body?.lists || []) as Array<{ id: number; name: string }>;
    lists.forEach(list => {
      if (Number.isFinite(list?.id)) namesById.set(list.id, list.name);
    });
  } catch (error: any) {
    debugLog("loadBrevoListNames:failed", error?.response?.statusCode || error?.message || error);
  }
  return namesById;
}

async function persistAuditRows(
  contacts: BlockedContact[],
  listNamesById: Map<number, string>
): Promise<void> {
  for (const contact of contacts) {
    const memberId = contact.matchedMember?.id;
    if (!memberId) continue;
    const listIds = (contact.listIds && contact.listIds.length > 0) ? contact.listIds : [0];
    const timestamp = blockedAtToTimestamp(contact.blockedAt);
    const status = reasonToAuditStatus(contact.reason?.code);
    for (const listId of listIds) {
      const message = buildAuditMessage(contact, listNamesById.get(listId));
      try {
        await mailListAudit.updateOne(
          { memberId, listId, timestamp, createdBy: MailListAuditSource.BREVO_UNSUBSCRIBES_SYNC },
          {
            $setOnInsert: {
              memberId,
              listId,
              timestamp,
              createdBy: MailListAuditSource.BREVO_UNSUBSCRIBES_SYNC,
              listType: MailListAuditListType.BREVO_BLOCKED,
              status,
              audit: message
            }
          },
          { upsert: true }
        );
      } catch (error: any) {
        debugLog("persistAuditRows:failed", contact.email, listId, error?.message || error);
      }
    }
  }
}

async function selfHealMemberEmailBlocks(
  contacts: BlockedContact[],
  totalCount: number,
  fetchedCount: number,
  noFilters: boolean
): Promise<{ cleared: number; skipped: boolean }> {
  if (!noFilters) {
    debugLog("selfHealMemberEmailBlocks:skipping - filters in effect");
    return { cleared: 0, skipped: true };
  }
  if (fetchedCount < totalCount) {
    debugLog("selfHealMemberEmailBlocks:skipping - partial fetch", { fetchedCount, totalCount });
    return { cleared: 0, skipped: true };
  }
  const currentBlockedEmails = new Set(
    contacts.map(c => (c.email || "").toLowerCase()).filter(Boolean)
  );
  try {
    const candidates = await member.find(
      {
        "emailBlock.source": MailListAuditSource.BREVO_UNSUBSCRIBES_SYNC,
        ...(currentBlockedEmails.size > 0
          ? { email: { $nin: Array.from(currentBlockedEmails) } }
          : {})
      },
      { _id: 1, email: 1 }
    ).lean().exec() as any[];
    let cleared = 0;
    for (const memberDoc of candidates) {
      const memberId = memberDoc._id?.toString();
      try {
        await member.updateOne({ _id: memberDoc._id }, { $unset: { emailBlock: 1 } });
        await mailListAudit.create({
          memberId,
          listId: 0,
          timestamp: Date.now(),
          createdBy: MailListAuditSource.BREVO_UNSUBSCRIBES_SYNC,
          listType: MailListAuditListType.BREVO_BLOCKLIST_SELF_HEALED,
          status: AuditStatus.info,
          audit: `Brevo no longer reports this contact as blocked — auto-cleared emailBlock`
        });
        cleared++;
      } catch (error: any) {
        debugLog("selfHealMemberEmailBlocks:cleanup-failed", memberId, error?.message || error);
      }
    }
    return { cleared, skipped: false };
  } catch (error: any) {
    debugLog("selfHealMemberEmailBlocks:query-failed", error?.message || error);
    return { cleared: 0, skipped: true };
  }
}

function isoOrUndefined(value: number | string | undefined): string | undefined {
  if (isNumber(value) && Number.isFinite(value)) {
    return dateTimeFromMillis(value).toISO() ?? undefined;
  }
  if (isString(value) && value) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? (dateTimeFromMillis(parsed).toISO() ?? undefined) : undefined;
  }
  return undefined;
}

function startOfDayMillis(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function endOfDayMillis(value: string | undefined): number | undefined {
  const parsed = startOfDayMillis(value);
  if (parsed === undefined) return undefined;
  return parsed + 24 * 3600 * 1000 - 1;
}

async function fetchLocalOnlyBlockedContacts(
  excludeEmails: Set<string>,
  startDate: string | undefined,
  endDate: string | undefined,
  senders: string[] | undefined,
  hardLimit: number
): Promise<BlockedContact[]> {
  const startMs = startOfDayMillis(startDate);
  const endMs = endOfDayMillis(endDate);
  const blockedAtRange: Record<string, number> = {};
  if (startMs !== undefined) blockedAtRange.$gte = startMs;
  if (endMs !== undefined) blockedAtRange.$lte = endMs;
  const query: any = { emailBlock: { $exists: true } };
  if (keys(blockedAtRange).length > 0) query["emailBlock.blockedAt"] = blockedAtRange;
  if (senders && senders.length > 0) query["emailBlock.senderEmail"] = { $in: senders };
  let candidates: any[];
  try {
    candidates = await member.find(
      query,
      { _id: 1, email: 1, displayName: 1, firstName: 1, lastName: 1, membershipNumber: 1, emailBlock: 1 }
    ).limit(hardLimit).lean().exec() as any[];
  } catch (error: any) {
    debugLog("fetchLocalOnlyBlockedContacts:query-failed", error?.message || error);
    return [];
  }
  const synthesized: BlockedContact[] = [];
  for (const memberDoc of candidates) {
    const memberEmail = (memberDoc.email || "").toLowerCase();
    if (!memberEmail || excludeEmails.has(memberEmail)) continue;
    const emailBlock = memberDoc.emailBlock || {};
    const blockedAtIso = isoOrUndefined(emailBlock.blockedAt);
    if (!blockedAtIso) continue;
    const memberId = memberDoc.id || memberDoc._id?.toString();
    const matchedMember: BlockedContactMemberMatch = {
      id: memberId,
      membershipNumber: memberDoc.membershipNumber,
      displayName: memberDoc.displayName,
      firstName: memberDoc.firstName,
      lastName: memberDoc.lastName
    };
    const salesforceWriteback = matchedMember.membershipNumber
      ? { status: SalesforceWritebackStatus.PENDING }
      : { status: SalesforceWritebackStatus.NOT_APPLICABLE };
    synthesized.push({
      email: memberDoc.email,
      senderEmail: emailBlock.senderEmail || "",
      reason: { code: emailBlock.reasonCode, message: emailBlock.reasonMessage },
      blockedAt: blockedAtIso,
      matchedMember,
      salesforceWriteback
    });
  }
  return synthesized;
}

async function attachUnsubscribeFeedback(contacts: BlockedContact[]): Promise<BlockedContact[]> {
  const memberIds = [...new Set(
    contacts.map(contact => contact.matchedMember?.id).filter((id): id is string => !!id)
  )];
  if (memberIds.length === 0) return contacts;
  let feedbackRows: any[];
  try {
    feedbackRows = await mailListAudit.find(
      { memberId: { $in: memberIds }, createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE_FEEDBACK },
      { memberId: 1, timestamp: 1, audit: 1 }
    ).sort({ timestamp: -1 }).lean().exec() as any[];
  } catch (error: any) {
    debugLog("attachUnsubscribeFeedback:query-failed", error?.message || error);
    return contacts;
  }
  const latestByMember = new Map<string, { reason?: string; comment?: string; recordedAt?: string }>();
  for (const row of feedbackRows) {
    if (latestByMember.has(row.memberId)) continue;
    const audit: any = row.audit;
    const reason = (audit && isString(audit.reason)) ? audit.reason : undefined;
    if (!reason) continue;
    const comment = (audit && isString(audit.comment) && audit.comment.length > 0)
      ? audit.comment
      : undefined;
    const recordedAt = Number.isFinite(row.timestamp) ? (dateTimeFromMillis(row.timestamp).toISO() ?? undefined) : undefined;
    latestByMember.set(row.memberId, { reason, comment, recordedAt });
  }
  if (latestByMember.size === 0) return contacts;
  return contacts.map(contact => {
    const memberId = contact.matchedMember?.id;
    if (!memberId) return contact;
    const feedback = latestByMember.get(memberId);
    if (!feedback?.reason) return contact;
    return {
      ...contact,
      unsubscribeFeedback: {
        reason: feedback.reason,
        comment: feedback.comment,
        recordedAt: feedback.recordedAt
      }
    };
  });
}

function compareBlockedAt(a: BlockedContact, b: BlockedContact, sort: "asc" | "desc"): number {
  const aValue = a.blockedAt || "";
  const bValue = b.blockedAt || "";
  const comparison = aValue.localeCompare(bValue);
  return sort === "asc" ? comparison : -comparison;
}

async function persistMemberEmailBlocks(contacts: BlockedContact[]): Promise<void> {
  const syncedAt = Date.now();
  for (const contact of contacts) {
    const memberId = contact.matchedMember?.id;
    if (!memberId) continue;
    const blockedAt = blockedAtToTimestamp(contact.blockedAt);
    const emailBlock = {
      reasonCode: (contact.reason?.code as string) || "unknown",
      reasonMessage: contact.reason?.message,
      senderEmail: contact.senderEmail,
      blockedAt,
      syncedAt,
      source: MailListAuditSource.BREVO_UNSUBSCRIBES_SYNC
    };
    try {
      const memberDoc = await member.findById(memberId).lean().exec() as any;
      const existingSubscriptions: Array<{ id: number; subscribed: boolean }> =
        memberDoc?.mail?.subscriptions || [];
      const blockedListIds = new Set((contact.listIds || []).filter(id => Number.isFinite(id)));
      const updatedSubscriptions = existingSubscriptions.map(sub =>
        blockedListIds.has(sub.id) ? { ...sub, subscribed: false } : sub
      );
      const update: any = { $set: { emailBlock } };
      if (updatedSubscriptions.length > 0
        && JSON.stringify(updatedSubscriptions) !== JSON.stringify(existingSubscriptions)) {
        update.$set["mail.subscriptions"] = updatedSubscriptions;
      }
      await member.updateOne({ _id: memberId }, update);
    } catch (error: any) {
      debugLog("persistMemberEmailBlocks:failed", memberId, error?.message || error);
    }
  }
}

export async function removeFromBlocklist(req: Request, res: Response): Promise<void> {
  const removeMessageType = "brevo:unsubscribes:remove";
  try {
    const email = String(req.params.email || "").trim();
    if (!email) {
      res.status(400).json({ error: "email path param is required" });
      return;
    }
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    try {
      await apiInstance.smtpBlockedContactsEmailDelete(email);
    } catch (error: any) {
      const status = error?.response?.statusCode;
      if (status !== 404) {
        throw error;
      }
      debugLog("removeFromBlocklist:not-on-brevo-blocklist", email);
    }
    try {
      const update = new SibApiV3Sdk.UpdateContact();
      update.emailBlacklisted = false;
      await contactsApi.updateContact(email, update);
    } catch (error: any) {
      const status = error?.response?.statusCode;
      if (status !== 404) {
        throw error;
      }
      debugLog("removeFromBlocklist:contact-not-found-in-brevo", email);
    }

    const matchedMember = await member.findOne(
      { email: email.toLowerCase() },
      { _id: 1, displayName: 1 }
    ).lean().exec() as any;
    const memberId = matchedMember?.id || matchedMember?._id?.toString();
    const triggeredBy = (req as any).user?.userName || (req as any).user?.id || "admin-action";
    if (memberId) {
      try {
        await member.updateOne({ _id: memberId }, { $unset: { emailBlock: 1 } });
        await mailListAudit.create({
          memberId,
          listId: 0,
          timestamp: Date.now(),
          createdBy: triggeredBy,
          listType: MailListAuditListType.BREVO_BLOCKLIST_REMOVED,
          status: AuditStatus.info,
          audit: `Removed from Brevo blocklist by admin (${email})`
        });
      } catch (error: any) {
        debugLog("removeFromBlocklist:member-cleanup-failed", memberId, error?.message || error);
      }
    }
    successfulResponse({ req, res, response: { email, removed: true }, messageType: removeMessageType, debugLog });
  } catch (error) {
    handleError(req, res, removeMessageType, debugLog, error);
  }
}

export async function clearAllBlocklist(req: Request, res: Response): Promise<void> {
  const clearMessageType = "brevo:unsubscribes:clear-all";
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const aggregated = await fetchAllBlockedContacts(
      apiInstance,
      undefined,
      undefined,
      undefined,
      "desc",
      MAX_FETCH_LIMIT,
      0
    );
    const limiter = createBottleneckWithRatePerSecond(CONTACT_INFO_RATE_PER_SECOND);
    const result: ClearAllBlocklistResult = {
      brevoFound: aggregated.contacts.length,
      brevoCleared: 0,
      brevoFailed: 0,
      localCleared: 0,
      errors: []
    };
    await Promise.all(aggregated.contacts.map(contact => limiter.schedule(async () => {
      const email = contact.email;
      if (!email) return;
      try {
        try {
          await apiInstance.smtpBlockedContactsEmailDelete(email);
        } catch (error: any) {
          const status = error?.response?.statusCode;
          if (status !== 404) throw error;
        }
        try {
          const update = new SibApiV3Sdk.UpdateContact();
          update.emailBlacklisted = false;
          await contactsApi.updateContact(email, update);
        } catch (error: any) {
          const status = error?.response?.statusCode;
          if (status !== 404) throw error;
        }
        result.brevoCleared++;
      } catch (error: any) {
        result.brevoFailed++;
        result.errors.push({
          email,
          message: error?.response?.body?.message || error?.message || "unknown error"
        });
        debugLog("clearAllBlocklist:failed", email, error?.message || error);
      }
    })));
    const triggeredBy = (req as any).user?.userName || (req as any).user?.id || "admin-action";
    const localMembers = await member.find(
      { emailBlock: { $exists: true } },
      { _id: 1, email: 1 }
    ).lean().exec() as any[];
    for (const memberDoc of localMembers) {
      const memberId = memberDoc._id?.toString();
      try {
        await member.updateOne({ _id: memberDoc._id }, { $unset: { emailBlock: 1 } });
        await mailListAudit.create({
          memberId,
          listId: 0,
          timestamp: Date.now(),
          createdBy: triggeredBy,
          listType: MailListAuditListType.BREVO_BLOCKLIST_CLEARED,
          status: AuditStatus.info,
          audit: `Local emailBlock cleared by admin clear-all (${memberDoc.email || ""})`
        });
        result.localCleared++;
      } catch (error: any) {
        debugLog("clearAllBlocklist:local-cleanup-failed", memberId, error?.message || error);
      }
    }
    successfulResponse({ req, res, response: result, messageType: clearMessageType, debugLog });
  } catch (error) {
    handleError(req, res, clearMessageType, debugLog, error);
  }
}

export interface RunUnsubscribesSyncOptions {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  senders?: string[];
  sort?: "asc" | "desc";
}

export interface RunUnsubscribesSyncResult {
  response: BlockedContactsResponse;
  selfHealed: { cleared: number; skipped: boolean };
}

export async function runUnsubscribesSync(opts: RunUnsubscribesSyncOptions = {}): Promise<RunUnsubscribesSyncResult> {
  const brevoConfig = await configuredBrevo();
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
  const contactsApi = new SibApiV3Sdk.ContactsApi();
  contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);

  const requestedLimit = Math.min(opts.limit && opts.limit > 0 ? opts.limit : DEFAULT_PAGE_LIMIT, MAX_FETCH_LIMIT);
  const startOffset = opts.offset && opts.offset > 0 ? opts.offset : 0;
  const sort: "asc" | "desc" = opts.sort === "asc" ? "asc" : "desc";
  const noFilters = !opts.startDate && !opts.endDate && (!opts.senders || opts.senders.length === 0) && startOffset === 0;

  const aggregated = await fetchAllBlockedContacts(
    apiInstance,
    opts.startDate,
    opts.endDate,
    opts.senders,
    sort,
    requestedLimit,
    startOffset
  );

  const memberEnriched = await enrichWithMemberMatches(aggregated.contacts);
  const brevoEnriched = await enrichWithContactInfo(contactsApi, memberEnriched);
  const listNamesById = await loadBrevoListNames(contactsApi);
  await persistAuditRows(brevoEnriched, listNamesById);
  await persistMemberEmailBlocks(brevoEnriched);
  const selfHealed = await selfHealMemberEmailBlocks(
    brevoEnriched,
    aggregated.totalCount,
    brevoEnriched.length,
    noFilters
  );

  const brevoEmails = new Set<string>(
    brevoEnriched.map(contact => (contact.email || "").toLowerCase()).filter(Boolean)
  );
  const localOnly = await fetchLocalOnlyBlockedContacts(
    brevoEmails,
    opts.startDate,
    opts.endDate,
    opts.senders,
    MAX_FETCH_LIMIT
  );
  const localEnriched = await enrichWithContactInfo(contactsApi, localOnly);
  const combined = [...brevoEnriched, ...localEnriched];
  const withFeedback = await attachUnsubscribeFeedback(combined);
  const merged = withFeedback.sort((a, b) => compareBlockedAt(a, b, sort));

  return {
    response: { count: aggregated.totalCount + localEnriched.length, contacts: merged },
    selfHealed
  };
}

export async function unsubscribes(req: Request, res: Response): Promise<void> {
  try {
    const result = await runUnsubscribesSync({
      limit: parsePositiveInt(req.query.limit, DEFAULT_PAGE_LIMIT),
      offset: parsePositiveInt(req.query.offset, 0) || 0,
      startDate: isString(req.query.startDate) ? req.query.startDate : undefined,
      endDate: isString(req.query.endDate) ? req.query.endDate : undefined,
      senders: parseSenders(req.query.senders),
      sort: parseSort(req.query.sort)
    });
    successfulResponse({ req, res, response: result.response, messageType, debugLog });
  } catch (error: any) {
    console.error(`[${messageType}] failed:`, error?.response?.statusCode || error?.statusCode || "", error?.response?.body || error?.body || error?.message || error, error?.stack || "");
    handleError(req, res, messageType, debugLog, error);
  }
}

const ACTIVITY_FEEDBACK_WINDOW_MS = 60 * 1000;

export async function unsubscribeActivity(req: Request, res: Response): Promise<void> {
  const activityMessageType = "brevo:unsubscribe-activity";
  try {
    const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_PAGE_LIMIT), MAX_FETCH_LIMIT);
    const offset = parsePositiveInt(req.query.offset, 0) || 0;
    const sort = parseSort(req.query.sort);
    const sortDirection = sort === "asc" ? 1 : -1;
    const startMs = startOfDayMillis(isString(req.query.startDate) ? req.query.startDate : undefined);
    const endMs = endOfDayMillis(isString(req.query.endDate) ? req.query.endDate : undefined);
    const baseFilter: Record<string, any> = { createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE };
    if (isNumber(startMs) || isNumber(endMs)) {
      baseFilter.timestamp = {
        ...(isNumber(startMs) ? { $gte: startMs } : {}),
        ...(isNumber(endMs) ? { $lte: endMs } : {})
      };
    }
    const totalCount = await mailListAudit.countDocuments(baseFilter);
    const rows = await mailListAudit.find(
      baseFilter,
      { memberId: 1, listId: 1, timestamp: 1, audit: 1 }
    ).sort({ timestamp: sortDirection }).skip(offset).limit(limit).lean().exec() as any[];
    if (rows.length === 0) {
      const empty: UnsubscribeActivityResponse = { count: totalCount, activity: [] };
      successfulResponse({ req, res, response: empty, messageType: activityMessageType, debugLog });
      return;
    }
    const memberIds = [...new Set(rows.map(row => row.memberId).filter((id): id is string => !!id))];
    const memberDocs = await member.find(
      { _id: { $in: memberIds } },
      { _id: 1, email: 1, displayName: 1, firstName: 1, lastName: 1, membershipNumber: 1 }
    ).lean().exec() as any[];
    const memberById = new Map<string, any>();
    memberDocs.forEach(doc => {
      const id = doc.id || doc._id?.toString();
      if (id) memberById.set(id, doc);
    });
    const minTimestamp = Math.min(...rows.map(row => row.timestamp || 0));
    const maxTimestamp = Math.max(...rows.map(row => row.timestamp || 0));
    const feedbackRows = await mailListAudit.find(
      {
        createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE_FEEDBACK,
        memberId: { $in: memberIds },
        timestamp: {
          $gte: minTimestamp - ACTIVITY_FEEDBACK_WINDOW_MS,
          $lte: maxTimestamp + ACTIVITY_FEEDBACK_WINDOW_MS
        }
      },
      { memberId: 1, timestamp: 1, audit: 1 }
    ).lean().exec() as any[];
    const feedbackByMember = new Map<string, any[]>();
    feedbackRows.forEach(row => {
      const list = feedbackByMember.get(row.memberId) || [];
      list.push(row);
      feedbackByMember.set(row.memberId, list);
    });
    const brevoConfig = await configuredBrevo();
    const contactsApi = new SibApiV3Sdk.ContactsApi();
    contactsApi.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const listNamesById = await loadBrevoListNames(contactsApi);
    const activity: UnsubscribeActivity[] = rows.map(row => {
      const memberDoc = memberById.get(row.memberId);
      const candidates = feedbackByMember.get(row.memberId) || [];
      const closest = candidates.reduce<{ row: any; delta: number } | null>((acc, candidate) => {
        const delta = Math.abs((candidate.timestamp || 0) - (row.timestamp || 0));
        if (delta > ACTIVITY_FEEDBACK_WINDOW_MS) return acc;
        if (!acc || delta < acc.delta) return { row: candidate, delta };
        return acc;
      }, null);
      const feedbackAudit: any = closest?.row?.audit;
      const reason = (feedbackAudit && isString(feedbackAudit.reason)) ? feedbackAudit.reason : undefined;
      const comment = (feedbackAudit && isString(feedbackAudit.comment) && feedbackAudit.comment.length > 0) ? feedbackAudit.comment : undefined;
      const listId = Number.isFinite(row.listId) ? row.listId : 0;
      const listName = listId > 0 ? listNamesById.get(listId) : undefined;
      return {
        memberId: memberDoc ? (memberDoc.id || memberDoc._id?.toString()) : row.memberId,
        email: memberDoc?.email || "",
        displayName: memberDoc?.displayName,
        firstName: memberDoc?.firstName,
        lastName: memberDoc?.lastName,
        membershipNumber: memberDoc?.membershipNumber,
        listId,
        listName,
        unsubscribedAt: row.timestamp ? (dateTimeFromMillis(row.timestamp).toISO() ?? "") : "",
        reason,
        comment
      };
    });
    const response: UnsubscribeActivityResponse = { count: totalCount, activity };
    successfulResponse({ req, res, response, messageType: activityMessageType, debugLog });
  } catch (error: any) {
    console.error(`[${activityMessageType}] failed:`, error?.response?.statusCode || error?.statusCode || "", error?.response?.body || error?.body || error?.message || error, error?.stack || "");
    handleError(req, res, activityMessageType, debugLog, error);
  }
}

export async function unsubscribeHistory(req: Request, res: Response): Promise<void> {
  const historyMessageType = "brevo:unsubscribe-history";
  try {
    const rows = await mailListAudit.find(
      { createdBy: MailListAuditSource.BRANDED_UNSUBSCRIBE },
      { memberId: 1, listId: 1 }
    ).lean().exec() as any[];
    const byMember = new Map<string, Set<number>>();
    rows.forEach(row => {
      if (!row.memberId) return;
      const listId = Number.isFinite(row.listId) ? row.listId : 0;
      const set = byMember.get(row.memberId) || new Set<number>();
      set.add(listId);
      byMember.set(row.memberId, set);
    });
    const response: UnsubscribeHistoryEntry[] = Array.from(byMember.entries()).map(([memberId, listIds]) => ({
      memberId,
      listIds: Array.from(listIds.values())
    }));
    successfulResponse({ req, res, response, messageType: historyMessageType, debugLog });
  } catch (error) {
    handleError(req, res, historyMessageType, debugLog, error);
  }
}
