import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { HttpError } from "../shared/http-error";
import { dateTimeNowAsValue } from "../shared/dates";
import { SourceSiteHostState, SourceSiteLimits, SourceSiteRequestSummary } from "../models/source-site-limiter.model";

const debugLog = debug(envConfig.logNamespace("source-site-limiter"));

export const DEFAULT_SOURCE_SITE_LIMITS: SourceSiteLimits = {
  maxConcurrentRequests: 2,
  minimumGapMs: 300,
  maximumGapMs: 10000,
  slowResponseGapFactor: 0.5,
  retryAttempts: 4,
  baseBackoffMs: 2000,
  maximumBackoffMs: 60000,
  maximumRetryAfterMs: 120000,
  unavailableAfterConsecutiveFailures: 5,
  unavailableCooldownMs: 10 * 60 * 1000
};

const TRANSIENT_HTTP_STATUSES = [429, 502, 503, 504];
const TRANSIENT_NETWORK_CODES = ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNABORTED", "EPIPE", "EHOSTUNREACH", "ENETUNREACH"];

export class SourceSiteUnavailableError extends Error {
  constructor(readonly host: string, detail: string) {
    super(`The current website ${host} stopped responding (${detail}), so the import stopped to avoid overloading it. Retry once the website is working again.`);
  }
}

export function transientSourceSiteFailure(error: unknown): boolean {
  const code = (error as {code?: string})?.code;
  return (error instanceof HttpError && TRANSIENT_HTTP_STATUSES.includes(error.status)) || TRANSIENT_NETWORK_CODES.includes(code);
}

export function sourceSiteHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (error) {
    return String(url || "").toLowerCase();
  }
}

export class SourceSiteLimiter {
  private readonly hosts = new Map<string, SourceSiteHostState>();

  constructor(
    private readonly limits: SourceSiteLimits = DEFAULT_SOURCE_SITE_LIMITS,
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
    private readonly now: () => number = () => dateTimeNowAsValue()
  ) {}

  async request<T>(url: string, action: () => Promise<T>): Promise<T> {
    const host = sourceSiteHost(url);
    const state = this.stateFor(host);
    this.assertAvailable(host, state);
    await this.acquire(state);
    try {
      this.assertAvailable(host, state);
      return await this.attempt(host, state, action, 1);
    } finally {
      this.release(state);
    }
  }

  summary(url: string): SourceSiteRequestSummary {
    const host = sourceSiteHost(url);
    const state = this.stateFor(host);
    return {
      host,
      requests: state.requests,
      retries: state.retries,
      failures: state.failures,
      averageResponseMs: state.requests ? Math.round(state.totalElapsedMs / state.requests) : 0
    };
  }

  private stateFor(host: string): SourceSiteHostState {
    if (!this.hosts.has(host)) {
      this.hosts.set(host, {active: 0, waiting: [], nextStartAt: 0, gapMs: this.limits.minimumGapMs, requests: 0, retries: 0, failures: 0, consecutiveFailures: 0, totalElapsedMs: 0, unavailableUntil: 0, unavailableReason: ""});
    }
    return this.hosts.get(host);
  }

  private assertAvailable(host: string, state: SourceSiteHostState): void {
    if (state.unavailableUntil > this.now()) {
      throw new SourceSiteUnavailableError(host, state.unavailableReason);
    } else if (state.unavailableUntil > 0) {
      state.unavailableUntil = 0;
      state.unavailableReason = "";
      state.consecutiveFailures = 0;
    }
  }

  private async acquire(state: SourceSiteHostState): Promise<void> {
    if (state.active >= this.limits.maxConcurrentRequests) {
      await new Promise<void>(resolve => state.waiting.push(resolve));
    } else {
      state.active++;
    }
    const wait = state.nextStartAt - this.now();
    state.nextStartAt = Math.max(state.nextStartAt, this.now()) + state.gapMs;
    if (wait > 0) {
      await this.sleep(wait);
    }
  }

  private release(state: SourceSiteHostState): void {
    const next = state.waiting.shift();
    if (next) {
      next();
    } else {
      state.active--;
    }
  }

  private async attempt<T>(host: string, state: SourceSiteHostState, action: () => Promise<T>, attemptNumber: number): Promise<T> {
    const startedAt = this.now();
    try {
      const result = await action();
      this.recordResponse(state, startedAt);
      state.consecutiveFailures = 0;
      return result;
    } catch (error) {
      this.recordResponse(state, startedAt);
      if (!transientSourceSiteFailure(error)) {
        state.consecutiveFailures = 0;
        throw error;
      } else {
        state.failures++;
        state.consecutiveFailures++;
        const detail = (error as Error)?.message || String(error);
        if (state.consecutiveFailures >= this.limits.unavailableAfterConsecutiveFailures) {
          state.unavailableUntil = this.now() + this.limits.unavailableCooldownMs;
          state.unavailableReason = detail;
          debugLog("%s marked unavailable after %d consecutive failures: %s", host, state.consecutiveFailures, detail);
          throw new SourceSiteUnavailableError(host, detail);
        } else if (attemptNumber >= this.limits.retryAttempts) {
          throw error;
        } else {
          const backoffMs = this.backoffMs(error, attemptNumber);
          state.retries++;
          state.gapMs = Math.min(this.limits.maximumGapMs, Math.max(state.gapMs * 2, this.limits.minimumGapMs));
          debugLog("%s request failed (%s), waiting %dms before attempt %d", host, detail, backoffMs, attemptNumber + 1);
          await this.sleep(backoffMs);
          this.assertAvailable(host, state);
          return this.attempt(host, state, action, attemptNumber + 1);
        }
      }
    }
  }

  private recordResponse(state: SourceSiteHostState, startedAt: number): void {
    const elapsedMs = this.now() - startedAt;
    state.requests++;
    state.totalElapsedMs += elapsedMs;
    state.gapMs = Math.min(this.limits.maximumGapMs, Math.max(this.limits.minimumGapMs, Math.round(elapsedMs * this.limits.slowResponseGapFactor)));
    state.nextStartAt = Math.max(state.nextStartAt, this.now() + state.gapMs);
  }

  private backoffMs(error: unknown, attemptNumber: number): number {
    const retryAfterSeconds = (error as {retryAfterSeconds?: number})?.retryAfterSeconds;
    if (retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, this.limits.maximumRetryAfterMs);
    } else {
      return Math.min(this.limits.baseBackoffMs * Math.pow(2, attemptNumber - 1), this.limits.maximumBackoffMs);
    }
  }
}

export const sourceSiteLimiter = new SourceSiteLimiter();
