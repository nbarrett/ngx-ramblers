import debug from "debug";
import { pluraliseWithCount } from "../../shared/string-utils";
import { isNumber } from "es-toolkit/compat";
import { BrevoError } from "@getbrevo/brevo";
import { envConfig } from "../../env-config/env-config";
import { mailListAudit } from "../models/mail-list-audit";
import { brevoClient } from "../../brevo/brevo-config";
import { scheduleBrevo } from "../../brevo/common/rate-limiting";
import { dateTimeNowAsValue } from "../../shared/dates";
import { AuditStatus } from "../../../../projects/ngx-ramblers/src/app/models/audit";
import { MailListAuditListType, MailSubscription, MemberSubscriptionChange, SubscriptionTransition } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const debugLog = debug(envConfig.logNamespace("member:subscription-audit"));
debugLog.enabled = false;

const LIST_NAME_CACHE_TTL_MS = 300000;

function subscribedByListId(subscriptions: MailSubscription[] | undefined): Map<number, boolean> {
  return new Map(subscriptions?.filter(item => isNumber(item.id)).map(item => [item.id as number, !!item.subscribed]));
}

export function subscriptionTransitions(prior: MailSubscription[] | undefined, next: MailSubscription[] | undefined): SubscriptionTransition[] {
  const priorMap = subscribedByListId(prior);
  const nextMap = subscribedByListId(next);
  const changed: SubscriptionTransition[] = Array.from(nextMap)
    .filter(([listId, subscribed]) => (priorMap.get(listId) ?? false) !== subscribed)
    .map(([listId, subscribed]) => ({listId, subscribed}));
  const removed: SubscriptionTransition[] = Array.from(priorMap)
    .filter(([listId, subscribed]) => subscribed && !nextMap.has(listId))
    .map(([listId]) => ({listId, subscribed: false}));
  return [...changed, ...removed];
}

let listNameCache: { at: number; namesById: Map<number, string> } | null = null;

async function listNamesById(): Promise<Map<number, string>> {
  const now = dateTimeNowAsValue();
  if (listNameCache && now - listNameCache.at < LIST_NAME_CACHE_TTL_MS) {
    return listNameCache.namesById;
  }
  const namesById = new Map<number, string>();
  try {
    const client = await brevoClient();
    const data = await scheduleBrevo(() => client.contacts.getLists({limit: 50, offset: 0}));
    (data.lists ?? []).forEach(list => {
      if (Number.isFinite(list?.id)) {
        namesById.set(list.id, list.name);
      }
    });
    listNameCache = {at: now, namesById};
  } catch (error: any) {
    const status = error instanceof BrevoError ? error.statusCode : undefined;
    debugLog("listNamesById:failed", status ?? error?.message ?? error);
  }
  return namesById;
}

function auditMessageFor(transition: SubscriptionTransition, namesById: Map<number, string>): string {
  const listName = namesById.get(transition.listId) ?? `list #${transition.listId}`;
  return `${transition.subscribed ? "Subscribed to" : "Unsubscribed from"} ${listName} list`;
}

export async function auditSubscriptionChanges(changes: MemberSubscriptionChange[], createdBy: string): Promise<void> {
  try {
    const withTransitions = changes
      .filter(change => !!change.memberId)
      .map(change => ({memberId: change.memberId, transitions: subscriptionTransitions(change.prior, change.next)}))
      .filter(item => item.transitions.length > 0);
    if (withTransitions.length === 0) {
      return;
    }
    const namesById = await listNamesById();
    const timestamp = dateTimeNowAsValue();
    const rows = withTransitions.flatMap(item => item.transitions.map(transition => ({
      memberId: item.memberId,
      listId: transition.listId,
      timestamp,
      createdBy,
      listType: MailListAuditListType.USER_INITIATED,
      status: AuditStatus.info,
      audit: auditMessageFor(transition, namesById)
    })));
    await mailListAudit.insertMany(rows);
    debugLog("wrote", rows.length, "subscription audit rows for", pluraliseWithCount(withTransitions.length, "member"), "by", createdBy);
  } catch (error: any) {
    debugLog("auditSubscriptionChanges:failed", error?.message ?? error);
  }
}
