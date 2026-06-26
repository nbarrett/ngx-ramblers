import debug from "debug";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { MailListAuditListType, MailSubscription } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { AuditStatus } from "../../../projects/ngx-ramblers/src/app/models/audit";
import { envConfig } from "../env-config/env-config";
import { mailListAudit } from "../mongo/models/mail-list-audit";
import { dateTimeNowAsValue } from "../shared/dates";
import { notifySalesforceFullyOptedOut } from "./salesforce-consent";

const debugLog = debug(envConfig.logNamespace("salesforce:member-consent-writeback"));
debugLog.enabled = true;

const FULL_OPT_OUT_REASON = "all-list-subscriptions-removed";

function activeSubscribedCount(subscriptions: MailSubscription[] | undefined): number {
  return (subscriptions ?? []).filter(subscription => subscription.subscribed).length;
}

export function becameFullyUnsubscribed(prior: MailSubscription[] | undefined, next: MailSubscription[] | undefined): boolean {
  return activeSubscribedCount(prior) > 0 && activeSubscribedCount(next) === 0;
}

export async function writeBackFullOptOuts(savedMembers: Member[], priorSubscriptionsById: Map<string, MailSubscription[]>, createdBy: string): Promise<void> {
  const fullOptOuts = savedMembers.filter(member =>
    !!member.membershipNumber && becameFullyUnsubscribed(priorSubscriptionsById.get(member.id ?? ""), member.mail?.subscriptions));
  await Promise.all(fullOptOuts.map(member => writeBackOne(member, createdBy)));
}

export async function writeBackOptOutsForRemovedMembers(removedMembers: Member[], createdBy: string): Promise<void> {
  const optOuts = removedMembers.filter(member => !!member.membershipNumber && activeSubscribedCount(member.mail?.subscriptions) > 0);
  await Promise.all(optOuts.map(member => writeBackOne(member, createdBy)));
}

async function writeBackOne(member: Member, createdBy: string): Promise<void> {
  try {
    const outcome = await notifySalesforceFullyOptedOut({membershipNumber: member.membershipNumber, reason: FULL_OPT_OUT_REASON});
    if (!outcome.attempted) {
      return;
    }
    debugLog("writeBackOne:outcome", member.membershipNumber, outcome.success ? "success" : "failed", `HTTP ${outcome.status ?? "n/a"}`, `${outcome.latencyMs}ms`, outcome.errorCode ?? "", outcome.errorMessage ?? "");
    const auditMessage = outcome.success
      ? `Email marketing consent withdrawal sent to Ramblers Head Office after all mailing list subscriptions were removed (${outcome.latencyMs}ms).`
      : `Email marketing consent withdrawal could not be sent to Ramblers Head Office after all mailing list subscriptions were removed (${outcome.latencyMs}ms)${outcome.errorMessage ? `: ${outcome.errorMessage}` : ""}.`;
    await mailListAudit.create({
      memberId: member.id,
      listId: 0,
      timestamp: dateTimeNowAsValue(),
      createdBy,
      listType: MailListAuditListType.USER_INITIATED,
      status: outcome.success ? AuditStatus.info : AuditStatus.warning,
      audit: auditMessage
    });
  } catch (error: any) {
    debugLog("writeBackOne:failed", member.membershipNumber, error?.message ?? error);
  }
}
