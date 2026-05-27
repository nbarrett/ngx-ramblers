import expect from "expect";
import { describe, it } from "mocha";
import { GetEmailCampaignsCampaignsInner } from "@getbrevo/brevo";
import { campaignProgress, isNgxCampaign, brevoRemainingDailyAllowance } from "./campaign-queue";
import { Account } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { NGX_BREVO_CAMPAIGN_TAG } from "../../../../projects/ngx-ramblers/src/app/models/brevo-campaign-queue.model";

describe("campaign queue", () => {
  const ngxCampaign = {
    id: 101,
    name: "Members bulletin",
    subject: "News",
    status: GetEmailCampaignsCampaignsInner.StatusEnum.Suspended,
    tag: NGX_BREVO_CAMPAIGN_TAG,
    createdAt: "2026-05-24T00:00:00.000Z",
    modifiedAt: "2026-05-25T00:00:00.000Z",
    statistics: {remaining: 25, globalStats: {sent: 300, delivered: 289}}
  } as GetEmailCampaignsCampaignsInner;

  it("only identifies campaigns created for the NGX release queue", () => {
    expect(isNgxCampaign(ngxCampaign)).toEqual(true);
    expect(isNgxCampaign({...ngxCampaign, tag: "another-system"} as GetEmailCampaignsCampaignsInner)).toEqual(false);
  });

  it("maps held and delivery progress from Brevo campaign statistics", () => {
    expect(campaignProgress(ngxCampaign)).toMatchObject({id: 101, sent: 300, delivered: 289, remaining: 25});
  });

  it("uses the free email send-limit credits for today's remaining allowance", () => {
    const account: Account = {
      plan: [
        {type: "sms", creditsType: "sendLimit", credits: 999},
        {type: "free", creditsType: "sendLimit", credits: 120}
      ]
    };
    expect(brevoRemainingDailyAllowance(account, 300)).toEqual(120);
    expect(brevoRemainingDailyAllowance(account, 200)).toEqual(20);
    expect(brevoRemainingDailyAllowance(account, 100)).toEqual(0);
  });

  it("does not infer daily usage for a paid no-daily-limit configuration", () => {
    expect(brevoRemainingDailyAllowance({plan: []}, null)).toBeNull();
  });
});
