import expect from "expect";
import { describe, it } from "mocha";
import { DEFAULT_DMARC_POLICY, dmarcReportingConfigured, withBrevoDmarcReporting } from "./cloudflare-email-auth-records";

describe("cloudflare email auth records", () => {

  describe("DMARC aggregate reporting", () => {

    it("includes Brevo aggregate reporting in new monitoring policies", () => {
      expect(DEFAULT_DMARC_POLICY).toBe("v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com;");
    });

    it("preserves an existing policy when aggregate reporting is added", () => {
      expect(withBrevoDmarcReporting("v=DMARC1; p=quarantine; pct=25;"))
        .toBe("v=DMARC1; p=quarantine; pct=25; rua=mailto:rua@dmarc.brevo.com;");
    });

    it("replaces a domain-local rua mailbox with Brevo and drops ruf", () => {
      expect(withBrevoDmarcReporting("v=DMARC1; p=reject; sp=reject; adkim=r; aspf=r; pct=100; rf=afrf; ri=86400; rua=mailto:rua@group.example.org.uk; ruf=mailto:ruf@group.example.org.uk"))
        .toBe("v=DMARC1; p=reject; sp=reject; adkim=r; aspf=r; pct=100; rf=afrf; ri=86400; rua=mailto:rua@dmarc.brevo.com;");
    });

    it("is idempotent when reporting is already only Brevo", () => {
      expect(withBrevoDmarcReporting("v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com;"))
        .toBe("v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com;");
    });

    it("treats only a sole Brevo rua and no ruf as configured", () => {
      expect(dmarcReportingConfigured("v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com;")).toBe(true);
      expect(dmarcReportingConfigured("v=DMARC1; p=reject; rua=mailto:rua@group.example.org.uk;")).toBe(false);
      expect(dmarcReportingConfigured("v=DMARC1; p=reject; rua=mailto:rua@dmarc.brevo.com; ruf=mailto:ruf@group.example.org.uk")).toBe(false);
      expect(dmarcReportingConfigured("v=DMARC1; p=none;")).toBe(false);
    });
  });
});
