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

  it("reports the remaining daily allowance the account returns", () => {
    expect(campaignDailyAllowance(freeEmailAccount)).toEqual(125);
  });

  it("does not report a daily allowance when the account has no free daily send-limit plan", () => {
    expect(campaignDailyAllowance({plan: [{type: "subscription", creditsType: "sendLimit", credits: 10000}]})).toBeNull();
  });

  it("warns using the remaining credits and following daily releases", () => {
    expect(campaignOverflowNotice(650, freeEmailAccount)).toEqual({title: "125 recipients can be sent today.", message: "Brevo will hold the remaining 525 recipients and release them automatically over the following 2 days."});
  });

  it("warns when automatic releases are disabled", () => {
    expect(campaignOverflowNotice(650, freeEmailAccount, false)).toEqual({title: "125 recipients can be sent today.", message: "Brevo will hold the remaining 525 recipients. Automatic release is currently paused in Scheduled Tasks."});
    expect(campaignOverflowNotice(650, freeEmailAccount, null)).toEqual({title: "125 recipients can be sent today.", message: "Brevo will hold the remaining 525 recipients. Automatic release status is still loading; check Scheduled Tasks before sending."});
  });
});
