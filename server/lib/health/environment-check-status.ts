import { EnvironmentHealthCheckStatus, HealthStatus } from "../../../projects/ngx-ramblers/src/app/models/health.model";

export function publicHttpSucceeded(httpStatus: number): boolean {
  return httpStatus >= 200 && httpStatus < 400;
}

export function environmentHealthFromProbes(input: {
  publicHttpStatus: number;
  machineHealthStatus?: HealthStatus;
  pendingMigrations: number;
  failedMigrations: boolean;
}): EnvironmentHealthCheckStatus {
  const publicOk = publicHttpSucceeded(input.publicHttpStatus);
  if (!publicOk) {
    return EnvironmentHealthCheckStatus.UNREACHABLE;
  } else if (input.machineHealthStatus === HealthStatus.OK) {
    return EnvironmentHealthCheckStatus.HEALTHY;
  } else if (input.pendingMigrations > 0 && !input.failedMigrations) {
    return EnvironmentHealthCheckStatus.PENDING;
  } else if (input.machineHealthStatus) {
    return EnvironmentHealthCheckStatus.DEGRADED;
  } else {
    return EnvironmentHealthCheckStatus.HEALTHY;
  }
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
