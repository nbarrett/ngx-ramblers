import expect from "expect";
import { describe, it } from "mocha";
import { ConsentWritebackSkipReason } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { notifySalesforceFullyOptedOut } from "./salesforce-consent";

describe("salesforce-consent", () => {
  it("does not call unsubscribe without the published member reference and email", async () => {
    const outcome = await notifySalesforceFullyOptedOut({ membershipNumber: "1234567" });

    expect(outcome).toEqual({
      attempted: false,
      skippedReason: ConsentWritebackSkipReason.MissingScope,
    });
  });
});
