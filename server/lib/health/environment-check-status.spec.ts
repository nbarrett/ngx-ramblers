import expect from "expect";
import { describe, it } from "mocha";
import { dateTimeFromIso } from "../shared/dates";
import { CertificateInfo } from "../fly/fly.model";
import {
  EnvironmentHealthCheckName,
  EnvironmentHealthCheckStatus,
  EnvironmentHealthFindingSeverity,
  HealthStatus
} from "../../../projects/ngx-ramblers/src/app/models/health.model";
import {
  CERT_EXPIRY_WARNING_DAYS,
  certificateFinding,
  environmentHealthFromFindings,
  visitorHostnameFromSiteUrl,
  publicHttpSucceeded,
  publicSiteFailureMessage
} from "./environment-check-status";

const nowMillis = dateTimeFromIso("2026-09-12T19:00:00Z").toMillis();

function cert(overrides: Partial<CertificateInfo> & { expiresAt?: string }): CertificateInfo {
  return {
    hostname: "berkshire-weekend-walkers.ngx-ramblers.org.uk",
    clientStatus: "Ready",
    acmeDnsConfigured: true,
    configured: true,
    issued: [{ type: "rsa", expiresAt: overrides.expiresAt || "2026-12-11T18:09:06Z" }],
    ...overrides
  };
}

describe("certificateFinding", () => {
  it("does not treat a missing Fly certificate as a problem when TLS may be provided elsewhere", () => {
    const finding = certificateFinding({
      hostname: "canterburyramblers.org.uk",
      nowMillis,
      warningDays: CERT_EXPIRY_WARNING_DAYS
    });
    expect(finding.severity).toEqual(EnvironmentHealthFindingSeverity.OK);
  });

  it("fails when the issued certificate has already expired", () => {
    const finding = certificateFinding({
      hostname: "berkshire-weekend-walkers.ngx-ramblers.org.uk",
      cert: cert({ expiresAt: "2026-09-05T12:00:00Z" }),
      nowMillis,
      warningDays: CERT_EXPIRY_WARNING_DAYS
    });
    expect(finding.severity).toEqual(EnvironmentHealthFindingSeverity.FAIL);
    expect(finding.message).toContain("expired on");
  });

  it("warns when the certificate expires within the warning window", () => {
    const finding = certificateFinding({
      hostname: "berkshire-weekend-walkers.ngx-ramblers.org.uk",
      cert: cert({ expiresAt: "2026-09-20T12:00:00Z" }),
      nowMillis,
      warningDays: CERT_EXPIRY_WARNING_DAYS
    });
    expect(finding.severity).toEqual(EnvironmentHealthFindingSeverity.WARNING);
    expect(finding.message).toContain("expires in");
  });

  it("is ok when the site can still be visited and the certificate is not close to expiry, even if ACME DNS is unset", () => {
    const finding = certificateFinding({
      hostname: "bolton.ngx-ramblers.org.uk",
      cert: cert({
        hostname: "bolton.ngx-ramblers.org.uk",
        acmeDnsConfigured: false,
        acmeAlpnConfigured: true,
        expiresAt: "2026-11-01T23:35:13Z"
      }),
      nowMillis,
      warningDays: CERT_EXPIRY_WARNING_DAYS
    });
    expect(finding.severity).toEqual(EnvironmentHealthFindingSeverity.OK);
  });

  it("is ok when the certificate is valid, far from expiry, and ACME DNS is configured", () => {
    const finding = certificateFinding({
      hostname: "berkshire-weekend-walkers.ngx-ramblers.org.uk",
      cert: cert({ expiresAt: "2026-12-11T18:09:06Z" }),
      nowMillis,
      warningDays: CERT_EXPIRY_WARNING_DAYS
    });
    expect(finding.severity).toEqual(EnvironmentHealthFindingSeverity.OK);
  });
});

describe("environmentHealthFromFindings", () => {
  it("is unreachable when the public hostname returns a Cloudflare 525 even if the Fly app is OK", () => {
    expect(environmentHealthFromFindings({
      findings: [{
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.FAIL,
        message: "525"
      }, {
        name: EnvironmentHealthCheckName.MACHINE,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "up"
      }],
      pendingMigrations: 0,
      failedMigrations: false,
      machineHealthStatus: HealthStatus.OK
    })).toEqual(EnvironmentHealthCheckStatus.UNREACHABLE);
  });

  it("is unreachable when the public certificate has expired", () => {
    expect(environmentHealthFromFindings({
      findings: [{
        name: EnvironmentHealthCheckName.CERTIFICATE,
        severity: EnvironmentHealthFindingSeverity.FAIL,
        message: "expired"
      }, {
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.FAIL,
        message: "525"
      }],
      pendingMigrations: 0,
      failedMigrations: false,
      machineHealthStatus: HealthStatus.OK
    })).toEqual(EnvironmentHealthCheckStatus.UNREACHABLE);
  });

  it("is healthy when visitors can reach the site and the certificate is not close to expiry", () => {
    expect(environmentHealthFromFindings({
      findings: [{
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "200"
      }, {
        name: EnvironmentHealthCheckName.CERTIFICATE,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "valid until 1 November 2026"
      }],
      pendingMigrations: 0,
      failedMigrations: false,
      machineHealthStatus: HealthStatus.OK
    })).toEqual(EnvironmentHealthCheckStatus.HEALTHY);
  });

  it("is healthy when public HTTP, certificate and migrations are all fine", () => {
    expect(environmentHealthFromFindings({
      findings: [{
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "200"
      }, {
        name: EnvironmentHealthCheckName.CERTIFICATE,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "valid"
      }, {
        name: EnvironmentHealthCheckName.MACHINE,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "up"
      }],
      pendingMigrations: 0,
      failedMigrations: false,
      machineHealthStatus: HealthStatus.OK
    })).toEqual(EnvironmentHealthCheckStatus.HEALTHY);
  });

  it("is healthy when the configured site URL responds, even if Fly has no certificate for that hostname", () => {
    expect(environmentHealthFromFindings({
      findings: [{
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "200"
      }, {
        name: EnvironmentHealthCheckName.CERTIFICATE,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "No Fly-managed certificate for canterburyramblers.org.uk"
      }],
      pendingMigrations: 0,
      failedMigrations: false,
      machineHealthStatus: HealthStatus.OK
    })).toEqual(EnvironmentHealthCheckStatus.HEALTHY);
  });

  it("is pending when the public site is fine and migrations are waiting", () => {
    expect(environmentHealthFromFindings({
      findings: [{
        name: EnvironmentHealthCheckName.PUBLIC_HTTP,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: "200"
      }],
      pendingMigrations: 2,
      failedMigrations: false,
      machineHealthStatus: HealthStatus.DEGRADED
    })).toEqual(EnvironmentHealthCheckStatus.PENDING);
  });
});

describe("visitorHostnameFromSiteUrl", () => {
  it("uses the configured site URL, not an invented NGX subdomain", () => {
    expect(visitorHostnameFromSiteUrl("https://canterburyramblers.org.uk", "canterbury", "ngx-ramblers.org.uk"))
      .toEqual("canterburyramblers.org.uk");
    expect(visitorHostnameFromSiteUrl("https://www.ekwg.co.uk", "ekwg", "ngx-ramblers.org.uk"))
      .toEqual("www.ekwg.co.uk");
  });

  it("falls back to the NGX subdomain only when no site URL is set", () => {
    expect(visitorHostnameFromSiteUrl(undefined, "bolton", "ngx-ramblers.org.uk"))
      .toEqual("bolton.ngx-ramblers.org.uk");
  });
});

describe("publicHttpSucceeded", () => {
  it("accepts 2xx and 3xx and rejects Cloudflare 5xx", () => {
    expect(publicHttpSucceeded(200)).toEqual(true);
    expect(publicHttpSucceeded(302)).toEqual(true);
    expect(publicHttpSucceeded(525)).toEqual(false);
    expect(publicHttpSucceeded(0)).toEqual(false);
  });
});

describe("publicSiteFailureMessage", () => {
  it("explains a 525 as origin TLS and notes that the Fly app responded", () => {
    expect(publicSiteFailureMessage("https://berkshire-weekend-walkers.ngx-ramblers.org.uk", 525, true))
      .toEqual("https://berkshire-weekend-walkers.ngx-ramblers.org.uk returned HTTP 525 (Cloudflare could not complete TLS to the origin). The Fly app itself responded, so this is the public hostname (DNS, TLS or Cloudflare), not a stopped machine.");
  });
});
