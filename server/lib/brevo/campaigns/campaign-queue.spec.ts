import expect from "expect";
import { describe, it } from "mocha";
import { Brevo } from "@getbrevo/brevo";
import { campaignProgress, isNgxCampaign, brevoRemainingDailyAllowance, campaignDateTimeFilter } from "./campaign-queue";
import { Account } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { NGX_BREVO_CAMPAIGN_TAG } from "../../../../projects/ngx-ramblers/src/app/models/brevo-campaign-queue.model";
import { clampDateRange } from "../common/date-range";
import { dateTimeFromIso } from "../../shared/dates";

describe("campaign queue", () => {
  const ngxCampaign = {
    id: 101,
    name: "Members bulletin",
    subject: "News",
    status: Brevo.GetEmailCampaignsResponse.Campaigns.Item.Status.Suspended,
    tag: NGX_BREVO_CAMPAIGN_TAG,
    createdAt: "2026-05-24T00:00:00.000Z",
    modifiedAt: "2026-05-25T00:00:00.000Z",
    statistics: {remaining: 25, globalStats: {sent: 300, delivered: 289}}
  } as Brevo.GetEmailCampaignsResponse.Campaigns.Item;

  it("only identifies campaigns created for the NGX release queue", () => {
    expect(isNgxCampaign(ngxCampaign)).toEqual(true);
    expect(isNgxCampaign({...ngxCampaign, tag: "another-system"} as Brevo.GetEmailCampaignsResponse.Campaigns.Item)).toEqual(false);
  });

  it("maps held and delivery progress from Brevo campaign statistics", () => {
    expect(campaignProgress(ngxCampaign)).toMatchObject({id: 101, sent: 300, delivered: 289, remaining: 25, uniqueClicks: 0, viewed: 0, uniqueViews: 0, hardBounces: 0, softBounces: 0, unsubscriptions: 0, complaints: 0});
  });

  it("uses the free email send-limit credits Brevo reports for today's remaining allowance", () => {
    const account: Account = {
      plan: [
        {type: "sms", creditsType: "sendLimit", credits: 999},
        {type: "free", creditsType: "sendLimit", credits: 120}
      ]
    };
    expect(brevoRemainingDailyAllowance(account)).toEqual(120);
  });

  it("returns null when the account has no free daily send-limit plan", () => {
    expect(brevoRemainingDailyAllowance({plan: []})).toBeNull();
  });

  it("converts day filters into Brevo campaign date-time bounds", () => {
    const now = dateTimeFromIso("2026-06-30T12:00:00.000+01:00");
    expect(campaignDateTimeFilter("2026-05-30", "2026-06-29", now)).toEqual({
      startDate: "2026-05-29T23:00:00.000Z",
      endDate: "2026-06-29T22:59:59.999Z"
    });
  });

  it("caps a current-day Brevo campaign date-time filter at now", () => {
    const now = dateTimeFromIso("2026-06-29T14:30:00.000+01:00");
    expect(campaignDateTimeFilter("2026-06-23", "2026-06-29", now)).toEqual({
      startDate: "2026-06-22T23:00:00.000Z",
      endDate: "2026-06-29T13:30:00.000Z"
    });
  });

  it("clamps Brevo report ranges to ninety inclusive calendar days", () => {
    expect(clampDateRange("2026-03-31", "2026-06-29")).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-06-29"
    });
  });
});
