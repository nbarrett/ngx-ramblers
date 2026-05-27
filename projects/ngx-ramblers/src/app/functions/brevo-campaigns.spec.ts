import { brevoEmailsSentToday, campaignDailyAllowance, campaignOverflowNotice, brevoRemainingDailyEmailCredits } from "./brevo-campaigns";
import { Account } from "../models/mail.model";

describe("brevo campaign allowance", () => {
  const freeEmailAccount: Account = {
    plan: [
      {type: "free", creditsType: "sendLimit", credits: 125},
      {type: "sms", creditsType: "sendLimit", credits: 999}
    ]
  };

  it("reads the free email daily credits used by Mail API Settings", () => {
    expect(brevoRemainingDailyEmailCredits(freeEmailAccount)).toEqual(125);
    expect(brevoEmailsSentToday(freeEmailAccount)).toEqual(175);
  });

  it("subtracts today's usage when enforcing configured caps", () => {
    expect(campaignDailyAllowance(freeEmailAccount, 300)).toEqual(125);
    expect(campaignDailyAllowance(freeEmailAccount, 200)).toEqual(25);
    expect(campaignDailyAllowance(freeEmailAccount, 100)).toEqual(0);
  });

  it("does not report a daily allowance for an unlimited paid configuration", () => {
    expect(campaignDailyAllowance({plan: [{type: "subscription", creditsType: "sendLimit", credits: 10000}]}, null)).toBeNull();
  });

  it("warns using the remaining credits and following daily releases", () => {
    expect(campaignOverflowNotice(650, freeEmailAccount, 300)).toEqual({title: "125 recipients can be sent today.", message: "Brevo will hold the remaining 525 recipients and release them automatically over the following 2 days."});
  });

  it("warns when automatic releases are disabled", () => {
    expect(campaignOverflowNotice(650, freeEmailAccount, 300, false)).toEqual({title: "125 recipients can be sent today.", message: "Brevo will hold the remaining 525 recipients. Automatic release is currently paused in Scheduled Tasks."});
    expect(campaignOverflowNotice(650, freeEmailAccount, 300, null)).toEqual({title: "125 recipients can be sent today.", message: "Brevo will hold the remaining 525 recipients. Automatic release status is still loading; check Scheduled Tasks before sending."});
  });
});
