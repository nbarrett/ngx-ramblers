import expect from "expect";
import { describe, it } from "mocha";
import { DEFAULT_DMARC_POLICY, withBrevoDmarcReporting } from "./cloudflare-email-auth-records";

describe("cloudflare email auth records", () => {

  describe("DMARC aggregate reporting", () => {

    it("includes Brevo aggregate reporting in new monitoring policies", () => {
      expect(DEFAULT_DMARC_POLICY).toBe("v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com;");
    });

    it("preserves an existing policy when aggregate reporting is added", () => {
      expect(withBrevoDmarcReporting("v=DMARC1; p=quarantine; pct=25;"))
        .toBe("v=DMARC1; p=quarantine; pct=25; rua=mailto:rua@dmarc.brevo.com;");
    });
  });
});
