import { AuditStatus } from "../../../projects/ngx-ramblers/src/app/models/audit";
import { MailListAuditListType, MailListAuditSource } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { systemConfig } from "../config/system-config";
import { mailListAudit } from "../mongo/models/mail-list-audit";
import { member } from "../mongo/models/member";
import { dateTimeNowAsValue } from "../shared/dates";
import { activeGroupCodeWithToken, pushSalesforceBounce } from "./salesforce-client";
import { configuredSalesforce } from "./salesforce-config";
import {
  SalesforceBounceContext,
  SalesforceBounceStatus,
  SalesforceClientResult,
} from "./salesforce.model";
import { BounceType, SupporterUpdateSuccess } from "@ramblers/sf-contract";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 1000];

export function bounceTypeForBrevoEvent(event: string): BounceType | null {
  if (event === "hard_bounce") {
    return "Hard";
  } else if (event === "soft_bounce") {
    return "Soft";
  }
  return null;
}

export function salesforceBounceRetryable(result: SalesforceClientResult<SupporterUpdateSuccess>): boolean {
  return result.status === 0 || result.status === 408 || result.status === 429 || result.status >= 500;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function recordOutcome(context: SalesforceBounceContext, status: SalesforceBounceStatus, attempts: number, error?: string): Promise<void> {
  const timestamp = dateTimeNowAsValue();
  await member.updateOne({ _id: context.memberId }, { $set: {
    "emailBlock.salesforceBounceEventKey": context.eventKey,
    "emailBlock.salesforceBounceStatus": status,
    "emailBlock.salesforceBounceAttempts": attempts,
    "emailBlock.salesforceBounceLastAttemptAt": timestamp,
    "emailBlock.salesforceBounceError": error ?? null,
  } });
  await mailListAudit.updateOne(
    { memberId: context.memberId, listId: 0, createdBy: MailListAuditSource.BREVO_EVENTS_WEBHOOK, "audit.eventKey": context.eventKey },
    { $set: {
      memberId: context.memberId,
      listId: 0,
      timestamp,
      createdBy: MailListAuditSource.BREVO_EVENTS_WEBHOOK,
      listType: MailListAuditListType.BREVO_BLOCKED,
      status: status === SalesforceBounceStatus.Delivered ? AuditStatus.info : status === SalesforceBounceStatus.Failed ? AuditStatus.error : AuditStatus.warning,
      audit: { eventKey: context.eventKey, bounceType: context.bounceType, salesforceStatus: status, attempts, error: error ?? null },
    } },
    { upsert: true },
  );
}

export async function reportSalesforceBounce(context: SalesforceBounceContext): Promise<void> {
  const deliveredAudit = await mailListAudit.findOne({
    memberId: context.memberId,
    listId: 0,
    createdBy: MailListAuditSource.BREVO_EVENTS_WEBHOOK,
    "audit.eventKey": context.eventKey,
    "audit.salesforceStatus": SalesforceBounceStatus.Delivered,
  }).lean().exec();
  if (deliveredAudit) {
    return;
  } else if (!context.memberRef) {
    await recordOutcome(context, SalesforceBounceStatus.MissingReference, 0, "Supporter has no memberRef");
    return;
  }
  const salesforceConfig = await configuredSalesforce();
  const siteConfig = await systemConfig();
  const active = salesforceConfig ? activeGroupCodeWithToken(salesforceConfig, siteConfig?.group?.groupCode ?? "") : null;
  if (!salesforceConfig?.enabled || !salesforceConfig.endpointBaseUrl || !active) {
    await recordOutcome(context, SalesforceBounceStatus.NotConfigured, 0, "Ramblers Team Emails is not configured");
    return;
  }
  const attemptWriteback = async (attempt: number): Promise<void> => {
    const result = await pushSalesforceBounce(salesforceConfig, {
      emailAddress: context.email,
      memberRef: context.memberRef,
      bounceType: context.bounceType,
    }, active.groupCode);
    if (result.data || !salesforceBounceRetryable(result) || attempt === MAX_ATTEMPTS) {
      await recordOutcome(
        context,
        result.data ? SalesforceBounceStatus.Delivered : SalesforceBounceStatus.Failed,
        attempt,
        result.data ? undefined : `${result.errorCode ?? "UNKNOWN"}: ${result.errorMessage ?? "No detail"}`,
      );
    } else {
      await delay(RETRY_DELAYS_MS[attempt - 1]);
      await attemptWriteback(attempt + 1);
    }
  };
  await attemptWriteback(1);
}
