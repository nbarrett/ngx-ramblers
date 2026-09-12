import { CertificateInfo } from "../fly/fly.model";
import { hostFromUrl, ramblersNationalUrl } from "../../../projects/ngx-ramblers/src/app/functions/hosts";
import { dateTimeFromIso, formatDateTime } from "../shared/dates";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import {
  EnvironmentHealthCheckName,
  EnvironmentHealthCheckStatus,
  EnvironmentHealthFinding,
  EnvironmentHealthFindingSeverity,
  HealthStatus
} from "../../../projects/ngx-ramblers/src/app/models/health.model";

export const CERT_EXPIRY_WARNING_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function publicHttpSucceeded(httpStatus: number): boolean {
  return httpStatus >= 200 && httpStatus < 400;
}

export function publicSiteFailureMessage(publicUrl: string, httpStatus: number, machineResponded: boolean): string {
  const machineNote = machineResponded
    ? " The Fly app itself responded, so this is the public hostname (DNS, TLS or Cloudflare), not a stopped machine."
    : "";
  if (httpStatus === 525) {
    return `${publicUrl} returned HTTP 525 (Cloudflare could not complete TLS to the origin).${machineNote}`;
  } else if (httpStatus === 0) {
    return `${publicUrl} could not be reached over HTTPS.${machineNote}`;
  } else {
    return `${publicUrl} returned HTTP ${httpStatus}.${machineNote}`;
  }
}

export function visitorHostnameFromSiteUrl(siteHref: string | undefined, environmentName: string, baseDomain: string): string {
  const fromHref = hostFromUrl(siteHref).toLowerCase();
  if (fromHref && !ramblersNationalUrl(siteHref)) {
    return fromHref;
  } else {
    return `${environmentName}.${baseDomain}`.toLowerCase();
  }
}

export function certificateFinding(input: {
  hostname: string;
  cert?: CertificateInfo;
  nowMillis: number;
  warningDays: number;
}): EnvironmentHealthFinding {
  const name = EnvironmentHealthCheckName.CERTIFICATE;
  if (!input.cert || !input.cert.issued?.length) {
    return {
      name,
      severity: EnvironmentHealthFindingSeverity.OK,
      message: `No Fly-managed certificate for ${input.hostname}`
    };
  } else {
    const earliestIssued = input.cert.issued.reduce((earliest, issued) => {
      if (dateTimeFromIso(issued.expiresAt).toMillis() < dateTimeFromIso(earliest.expiresAt).toMillis()) {
        return issued;
      } else {
        return earliest;
      }
    });
    const remainingDays = Math.floor((dateTimeFromIso(earliestIssued.expiresAt).toMillis() - input.nowMillis) / MS_PER_DAY);
    const earliestLabel = formatDateTime(dateTimeFromIso(earliestIssued.expiresAt), UIDateFormat.DISPLAY_DATE_NO_DAY);
    if (remainingDays < 0) {
      return {
        name,
        severity: EnvironmentHealthFindingSeverity.FAIL,
        message: `Certificate for ${input.hostname} expired on ${earliestLabel}`
      };
    } else if (remainingDays < input.warningDays) {
      return {
        name,
        severity: EnvironmentHealthFindingSeverity.WARNING,
        message: `Certificate for ${input.hostname} expires in ${remainingDays} day${remainingDays === 1 ? "" : "s"} (${earliestLabel})`
      };
    } else {
      return {
        name,
        severity: EnvironmentHealthFindingSeverity.OK,
        message: `Certificate for ${input.hostname} is valid until ${earliestLabel}`
      };
    }
  }
}

export function environmentHealthFromFindings(input: {
  findings: EnvironmentHealthFinding[];
  pendingMigrations: number;
  failedMigrations: boolean;
  machineHealthStatus?: HealthStatus;
}): EnvironmentHealthCheckStatus {
  const fails = input.findings.filter(finding => finding.severity === EnvironmentHealthFindingSeverity.FAIL);
  const warnings = input.findings.filter(finding => finding.severity === EnvironmentHealthFindingSeverity.WARNING);
  const publicFailed = fails.some(finding => finding.name === EnvironmentHealthCheckName.PUBLIC_HTTP);
  if (publicFailed) {
    return EnvironmentHealthCheckStatus.UNREACHABLE;
  } else if (input.failedMigrations || warnings.length > 0 || fails.length > 0) {
    return EnvironmentHealthCheckStatus.DEGRADED;
  } else if (input.pendingMigrations > 0) {
    return EnvironmentHealthCheckStatus.PENDING;
  } else if (input.machineHealthStatus === HealthStatus.OK || !input.machineHealthStatus) {
    return EnvironmentHealthCheckStatus.HEALTHY;
  } else {
    return EnvironmentHealthCheckStatus.DEGRADED;
  }
}
