import Bottleneck from "bottleneck";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { dateTimeNowAsValue } from "../../shared/dates";

const debugLog = debug(envConfig.logNamespace("brevo:rate-limiting"));
debugLog.enabled = true;

const MAX_RETRIES = 8;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const MIN_RETRY_DELAY_MS = 250;
const RESERVOIR_REFRESH_INTERVAL_MS = 1000;
const MIN_RATE_PER_SECOND = 1;
const RATE_RECOVERY_QUIET_PERIOD_MS = 5000;

const BREVO_CONTACTS_DOCUMENTED_RPS = 10;
const BREVO_RATE_SAFETY_FACTOR = 0.8;
const BREVO_RATE_PER_SECOND = Math.max(1, Math.floor(BREVO_CONTACTS_DOCUMENTED_RPS * BREVO_RATE_SAFETY_FACTOR));

function statusCodeOf(error: any): number {
  return error?.statusCode ?? error?.rawResponse?.status;
}

function retryAfterMsOf(error: any): number | null {
  const header = error?.rawResponse?.headers?.get?.("retry-after");
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

function retryDelayMs(retryCount: number, error: any): number {
  const retryAfter = retryAfterMsOf(error);
  if (retryAfter) {
    return retryAfter;
  }
  const ceiling = Math.min(BASE_RETRY_DELAY_MS * 2 ** retryCount, MAX_RETRY_DELAY_MS);
  return Math.max(MIN_RETRY_DELAY_MS, Math.floor(Math.random() * ceiling));
}

function settingsForRate(ratePerSecond: number): Bottleneck.ConstructorOptions {
  return {
    reservoir: ratePerSecond,
    reservoirRefreshAmount: ratePerSecond,
    reservoirRefreshInterval: RESERVOIR_REFRESH_INTERVAL_MS,
    maxConcurrent: ratePerSecond,
    minTime: Math.ceil(RESERVOIR_REFRESH_INTERVAL_MS / ratePerSecond)
  };
}

export function createBottleneckWithRatePerSecond(ratePerSecond: number): Bottleneck {
  const limiter = new Bottleneck(settingsForRate(ratePerSecond));
  const rateState = {current: ratePerSecond, lastThrottledAt: 0, lastRecoveredAt: 0};

  function applyRate(rate: number, reason: string): void {
    rateState.current = rate;
    limiter.updateSettings(settingsForRate(rate));
    debugLog("Brevo request rate now", rate, "per second", reason);
  }

  function throttleBack(): void {
    rateState.lastThrottledAt = dateTimeNowAsValue();
    const reduced = Math.max(MIN_RATE_PER_SECOND, Math.floor(rateState.current / 2));
    if (reduced < rateState.current) {
      applyRate(reduced, "(backing off after 429)");
    }
  }

  function recoverIfSettled(): void {
    const now = dateTimeNowAsValue();
    const settled = now - rateState.lastThrottledAt > RATE_RECOVERY_QUIET_PERIOD_MS;
    const dueToRecover = now - rateState.lastRecoveredAt > RATE_RECOVERY_QUIET_PERIOD_MS;
    if (settled && dueToRecover && rateState.current < ratePerSecond) {
      rateState.lastRecoveredAt = now;
      applyRate(Math.min(ratePerSecond, rateState.current + 1), "(recovering after quiet period)");
    }
  }

  limiter.on("failed", async (error: any, jobInfo: { retryCount: number }) => {
    if (statusCodeOf(error) !== 429) {
      return undefined;
    }
    throttleBack();
    if (jobInfo.retryCount >= MAX_RETRIES) {
      debugLog("Brevo rate limit (429); giving up after", MAX_RETRIES, "retries");
      return undefined;
    }
    const delay = retryDelayMs(jobInfo.retryCount, error);
    debugLog("Brevo rate limit (429); retry", jobInfo.retryCount + 1, "of", MAX_RETRIES, "in", delay, "ms");
    return delay;
  });

  limiter.on("done", () => recoverIfSettled());
  return limiter;
}

const brevoLimiter = createBottleneckWithRatePerSecond(BREVO_RATE_PER_SECOND);

export function scheduleBrevo<T>(task: () => Promise<T>, endpoint?: string): Promise<T> {
  return brevoLimiter.schedule(async () => {
    try {
      return await task();
    } catch (error: any) {
      if (endpoint && statusCodeOf(error) === 429) {
        debugLog("Brevo rate limit (429) from endpoint:", endpoint);
      }
      throw error;
    }
  });
}
