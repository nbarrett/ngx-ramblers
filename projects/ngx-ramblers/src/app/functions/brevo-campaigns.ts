import { isNumber } from "es-toolkit/compat";
import { Account } from "../models/mail.model";
import { CampaignOverflowNotice } from "../models/brevo-campaign-queue.model";

export const BREVO_FREE_DAILY_EMAIL_ALLOWANCE = 300;

export function brevoRemainingDailyEmailCredits(account: Account | null): number | null {
  const credits = account?.plan?.find(plan => plan.type === "free" && plan.creditsType === "sendLimit")?.credits;
  return isNumber(credits) ? credits : null;
}

export function brevoEmailsSentToday(account: Account | null): number | null {
  const remainingCredits = brevoRemainingDailyEmailCredits(account);
  return isNumber(remainingCredits) ? Math.max(0, BREVO_FREE_DAILY_EMAIL_ALLOWANCE - remainingCredits) : null;
}

export function campaignDailyAllowance(account: Account | null): number | null {
  return brevoRemainingDailyEmailCredits(account);
}

export function campaignOverflowNotice(recipientCount: number, account: Account | null, automaticReleaseEnabled: boolean | null = true): CampaignOverflowNotice | null {
  const allowance = campaignDailyAllowance(account);
  if (allowance === null) {
    return null;
  }
  const dailyLimit = BREVO_FREE_DAILY_EMAIL_ALLOWANCE;
  const queuedRecipients = Math.max(0, recipientCount - allowance);
  if (queuedRecipients === 0) {
    return null;
  }
  const followingDays = Math.ceil(queuedRecipients / dailyLimit);
  const dayLabel = followingDays === 1 ? "day" : "days";
  const title = `${allowance} recipients can be sent today.`;
  if (automaticReleaseEnabled) {
    return {title, message: `Brevo will hold the remaining ${queuedRecipients} recipients and release them automatically over the following ${followingDays} ${dayLabel}.`};
  } else if (automaticReleaseEnabled === false) {
    return {title, message: `Brevo will hold the remaining ${queuedRecipients} recipients. Automatic release is currently paused in Scheduled Tasks.`};
  } else {
    return {title, message: `Brevo will hold the remaining ${queuedRecipients} recipients. Automatic release status is still loading; check Scheduled Tasks before sending.`};
  }
}
