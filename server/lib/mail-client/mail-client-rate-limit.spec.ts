import expect from "expect";
import { describe, it } from "mocha";
import { mailClientSendAllowed, recordMailClientSend, resetMailClientRateLimits } from "./mail-client-rate-limit";
import { MAIL_CLIENT_MAX_SENDS_PER_HOUR } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";

describe("mail client rate limit", () => {
  it("allows up to the hourly cap and then refuses", () => {
    resetMailClientRateLimits();
    const memberId = "member-1";
    Array.from({length: MAIL_CLIENT_MAX_SENDS_PER_HOUR}).forEach(() => {
      expect(mailClientSendAllowed(memberId)).toEqual(true);
      recordMailClientSend(memberId);
    });
    expect(mailClientSendAllowed(memberId)).toEqual(false);
  });
});
