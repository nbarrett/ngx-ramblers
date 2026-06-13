import Bottleneck from "bottleneck";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("brevo:rate-limiting"));
debugLog.enabled = true;

const MAX_RETRIES = 8;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const MIN_RETRY_DELAY_MS = 250;
const RESERVOIR_REFRESH_INTERVAL_MS = 1000;

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

export function createBottleneckWithRatePerSecond(ratePerSecond: number): Bottleneck {
  const limiter = new Bottleneck({
    reservoir: ratePerSecond,
    reservoirRefreshAmount: ratePerSecond,
    reservoirRefreshInterval: RESERVOIR_REFRESH_INTERVAL_MS,
    maxConcurrent: ratePerSecond,
    minTime: Math.ceil(RESERVOIR_REFRESH_INTERVAL_MS / ratePerSecond)
  });
  limiter.on("failed", async (error: any, jobInfo: { retryCount: number }) => {
    if (statusCodeOf(error) !== 429) {
      return undefined;
    }
    if (jobInfo.retryCount >= MAX_RETRIES) {
      debugLog("Brevo rate limit (429); giving up after", MAX_RETRIES, "retries");
      return undefined;
    }
    const delay = retryDelayMs(jobInfo.retryCount, error);
    debugLog("Brevo rate limit (429); retry", jobInfo.retryCount + 1, "of", MAX_RETRIES, "in", delay, "ms");
    return delay;
  });
  return limiter;
}

const brevoLimiter = createBottleneckWithRatePerSecond(BREVO_RATE_PER_SECOND);

export function scheduleBrevo<T>(task: () => Promise<T>): Promise<T> {
  return brevoLimiter.schedule(task);
}
