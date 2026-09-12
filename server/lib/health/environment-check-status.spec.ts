import expect from "expect";
import { describe, it } from "mocha";
import { EnvironmentHealthCheckStatus, HealthStatus } from "../../../projects/ngx-ramblers/src/app/models/health.model";
import { environmentHealthFromProbes, publicHttpSucceeded, publicSiteFailureMessage } from "./environment-check-status";

describe("environmentHealthFromProbes", () => {
  it("is unreachable when the public hostname returns a Cloudflare 525 even if the Fly app is OK", () => {
    expect(environmentHealthFromProbes({
      publicHttpStatus: 525,
      machineHealthStatus: HealthStatus.OK,
      pendingMigrations: 0,
      failedMigrations: false
    })).toEqual(EnvironmentHealthCheckStatus.UNREACHABLE);
  });

  it("is unreachable when the public hostname cannot be reached over HTTPS", () => {
    expect(environmentHealthFromProbes({
      publicHttpStatus: 0,
      machineHealthStatus: HealthStatus.OK,
      pendingMigrations: 0,
      failedMigrations: false
    })).toEqual(EnvironmentHealthCheckStatus.UNREACHABLE);
  });

  it("is healthy when the public hostname and Fly app both succeed", () => {
    expect(environmentHealthFromProbes({
      publicHttpStatus: 200,
      machineHealthStatus: HealthStatus.OK,
      pendingMigrations: 0,
      failedMigrations: false
    })).toEqual(EnvironmentHealthCheckStatus.HEALTHY);
  });

  it("is pending when the public hostname works and migrations are waiting", () => {
    expect(environmentHealthFromProbes({
      publicHttpStatus: 200,
      machineHealthStatus: HealthStatus.DEGRADED,
      pendingMigrations: 2,
      failedMigrations: false
    })).toEqual(EnvironmentHealthCheckStatus.PENDING);
  });

  it("is degraded when the public hostname works and a migration has failed", () => {
    expect(environmentHealthFromProbes({
      publicHttpStatus: 200,
      machineHealthStatus: HealthStatus.DEGRADED,
      pendingMigrations: 0,
      failedMigrations: true
    })).toEqual(EnvironmentHealthCheckStatus.DEGRADED);
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
