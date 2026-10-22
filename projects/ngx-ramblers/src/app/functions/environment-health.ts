import {CrossEnvironmentHealthSummary, EnvironmentHealthCheck, EnvironmentHealthCheckStatus} from "../models/health.model";

export function environmentHealthSummary(environments: EnvironmentHealthCheck[], total = environments.length): CrossEnvironmentHealthSummary {
  return {
    total,
    healthy: environments.filter(environment => environment.checkStatus === EnvironmentHealthCheckStatus.HEALTHY).length,
    degraded: environments.filter(environment => environment.checkStatus === EnvironmentHealthCheckStatus.DEGRADED).length,
    unreachable: environments.filter(environment => environment.checkStatus === EnvironmentHealthCheckStatus.UNREACHABLE).length,
    pending: environments.filter(environment => environment.checkStatus === EnvironmentHealthCheckStatus.PENDING).length
  };
}
