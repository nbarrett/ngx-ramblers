export interface SourceSiteLimits {
  maxConcurrentRequests: number;
  minimumGapMs: number;
  maximumGapMs: number;
  slowResponseGapFactor: number;
  retryAttempts: number;
  baseBackoffMs: number;
  maximumBackoffMs: number;
  maximumRetryAfterMs: number;
  unavailableAfterConsecutiveFailures: number;
  unavailableCooldownMs: number;
}

export interface SourceSiteHostState {
  active: number;
  waiting: (() => void)[];
  nextStartAt: number;
  gapMs: number;
  requests: number;
  retries: number;
  failures: number;
  consecutiveFailures: number;
  totalElapsedMs: number;
  unavailableUntil: number;
  unavailableReason: string;
}

export interface SourceSiteRequestSummary {
  host: string;
  requests: number;
  retries: number;
  failures: number;
  averageResponseMs: number;
}
