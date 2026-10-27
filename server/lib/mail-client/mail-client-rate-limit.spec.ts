import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { mailClientSendAllowed } from "./mail-client-rate-limit";
import { MAIL_CLIENT_MAX_SENDS_PER_HOUR } from "../../../projects/ngx-ramblers/src/app/models/mail-client.model";
import { mailClientSubmission } from "../mongo/models/mail-client-submission";

describe("mail client rate limit", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("allows up to the hourly cap and then refuses", async () => {
    sandbox.stub(mailClientSubmission, "countDocuments")
      .onFirstCall().resolves(MAIL_CLIENT_MAX_SENDS_PER_HOUR - 1)
      .onSecondCall().resolves(MAIL_CLIENT_MAX_SENDS_PER_HOUR);
    expect(await mailClientSendAllowed("member-1")).toEqual(true);
    expect(await mailClientSendAllowed("member-1")).toEqual(false);
  });
});
